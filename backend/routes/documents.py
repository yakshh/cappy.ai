"""
routes/documents.py — Upload, list, and delete document endpoints.
"""

import uuid
import os
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status, BackgroundTasks
from sqlalchemy.orm import Session

from auth import get_current_user
from config import settings
from database import get_db
from models.document import Document
from models.user import User
from services.pdf_service import extract_text_from_pdf, get_page_count
from services.chunking_service import chunk_pages
from rag.vector_store import add_chunks_to_store, delete_document_from_store

router = APIRouter(prefix="/api/documents", tags=["Documents"])


# ── Background task: process and embed a PDF ─────────────────────────────────

def _process_document(document_id: int, file_path: str, user_id: int, filename: str, db_url: str):
    """
    Run PDF extraction + embedding in the background.
    Uses its own DB session since it runs in a thread.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine_options = {}
    if db_url.startswith("sqlite"):
        engine_options["connect_args"] = {"check_same_thread": False}
    engine = create_engine(db_url, **engine_options)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        db.close()
        return

    try:
        # 1. Extract text
        pages = extract_text_from_pdf(file_path)
        doc.page_count = len(pages)

        # 2. Chunk text
        chunks = chunk_pages(pages)

        # 3. Store embeddings in ChromaDB
        stored = add_chunks_to_store(
            user_id=user_id,
            document_id=document_id,
            document_name=filename,
            chunks=chunks,
        )
        doc.chunk_count = stored
        doc.status = "ready"

    except Exception as e:
        print(f"[Document Processing] ERROR for doc {document_id}: {e}")
        doc.status = "failed"

    finally:
        db.commit()
        db.close()


# ── Upload endpoint ────────────────────────────────────────────────────────────

@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a PDF and start background processing (extraction + embedding)."""
    # Validate file type
    suffix = Path(file.filename).suffix.lower()
    if suffix not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only PDF files are allowed.",
        )

    # Read file content
    content = await file.read()

    # Validate file size
    if len(content) > settings.MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the {settings.MAX_UPLOAD_SIZE_BYTES // (1024*1024)} MB limit.",
        )

    # Save file with UUID name to prevent collisions
    stored_name = f"{uuid.uuid4().hex}{suffix}"
    user_upload_dir = settings.UPLOAD_DIR / str(current_user.id)
    user_upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = user_upload_dir / stored_name

    with open(file_path, "wb") as f:
        f.write(content)

    # Create DB record
    doc = Document(
        user_id=current_user.id,
        filename=file.filename,
        stored_filename=stored_name,
        file_path=str(file_path),
        file_size=len(content),
        status="processing",
        category="General",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Queue background processing
    background_tasks.add_task(
        _process_document,
        doc.id,
        str(file_path),
        current_user.id,
        file.filename,
        settings.DATABASE_URL,
    )

    return {
        "id": doc.id,
        "filename": doc.filename,
        "file_size": doc.file_size,
        "status": doc.status,
        "category": doc.category or "General",
        "created_at": doc.created_at.isoformat(),
        "message": "Document uploaded. Processing started in background.",
    }


# ── List documents ─────────────────────────────────────────────────────────────

@router.get("/")
def list_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all documents belonging to the current user."""
    docs = (
        db.query(Document)
        .filter(Document.user_id == current_user.id)
        .order_by(Document.created_at.desc())
        .all()
    )
    return [
        {
            "id": d.id,
            "filename": d.filename,
            "file_size": d.file_size,
            "page_count": d.page_count,
            "chunk_count": d.chunk_count,
            "status": d.status,
            "category": d.category or "General",
            "created_at": d.created_at.isoformat(),
        }
        for d in docs
    ]


# ── Get single document ────────────────────────────────────────────────────────

@router.get("/{document_id}")
def get_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return metadata for a single document."""
    doc = (
        db.query(Document)
        .filter(Document.id == document_id, Document.user_id == current_user.id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    return {
        "id": doc.id,
        "filename": doc.filename,
        "file_size": doc.file_size,
        "page_count": doc.page_count,
        "chunk_count": doc.chunk_count,
        "status": doc.status,
        "category": doc.category or "General",
        "created_at": doc.created_at.isoformat(),
    }


from pydantic import BaseModel

class UpdateCategoryRequest(BaseModel):
    category: str

@router.patch("/{document_id}/category")
def update_document_category(
    document_id: int,
    payload: UpdateCategoryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update category for a document."""
    doc = (
        db.query(Document)
        .filter(Document.id == document_id, Document.user_id == current_user.id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    new_cat = payload.category.strip() or "General"
    doc.category = new_cat
    db.commit()
    return {"id": doc.id, "category": doc.category}


# ── Delete document ────────────────────────────────────────────────────────────

@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a document, its file on disk, and its ChromaDB embeddings."""
    doc = (
        db.query(Document)
        .filter(Document.id == document_id, Document.user_id == current_user.id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    # Remove from ChromaDB
    delete_document_from_store(current_user.id, document_id)

    # Remove file from disk
    try:
        if os.path.exists(doc.file_path):
            os.remove(doc.file_path)
    except Exception as e:
        print(f"[Delete] Could not remove file: {e}")

    # Remove from DB
    db.delete(doc)
    db.commit()
