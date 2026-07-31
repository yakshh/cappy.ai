"""
routes/documents.py — Upload, list, and delete document endpoints.
"""

import uuid
import os
import base64
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status, BackgroundTasks, Header
from pydantic import BaseModel
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


# ── Chunked upload endpoints ───────────────────────────────────────────────────
# The browser splits the PDF into 3MB pieces and POSTs them one by one.
# The final chunk triggers processing.

class ChunkUploadResponse(BaseModel):
    upload_id: str
    chunk_index: int
    received: bool

class ChunkFinalizeResponse(BaseModel):
    document: dict

@router.post("/upload-chunk", status_code=status.HTTP_200_OK)
async def upload_chunk(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    upload_id: str = Header(...),
    chunk_index: int = Header(...),
    total_chunks: int = Header(...),
    original_filename: str = Header(...),
    file: UploadFile = File(...),
):
    """Receive one chunk of a PDF upload. When all chunks arrive, reassemble and process."""
    # Decode the original_filename in case it was URL-encoded
    from urllib.parse import unquote
    original_filename = unquote(original_filename)

    # Validate extension
    suffix = Path(original_filename).suffix.lower()
    if suffix not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")

    # Store chunk in temp directory
    tmp_dir = settings.UPLOAD_DIR / "tmp" / upload_id
    tmp_dir.mkdir(parents=True, exist_ok=True)
    chunk_path = tmp_dir / f"chunk_{chunk_index:05d}"

    content = await file.read()
    with open(chunk_path, "wb") as f:
        f.write(content)

    # Check if all chunks have arrived
    received_chunks = sorted(tmp_dir.glob("chunk_*"))
    if len(received_chunks) < total_chunks:
        # Not done yet
        return {"upload_id": upload_id, "chunk_index": chunk_index, "received": True, "done": False}

    # All chunks received — reassemble
    user_upload_dir = settings.UPLOAD_DIR / str(current_user.id)
    user_upload_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}{suffix}"
    file_path = user_upload_dir / stored_name

    total_size = 0
    with open(file_path, "wb") as out:
        for chunk_file in received_chunks:
            data = chunk_file.read_bytes()
            out.write(data)
            total_size += len(data)

    # Clean up temp chunks
    import shutil
    shutil.rmtree(tmp_dir, ignore_errors=True)

    # Validate total size
    if total_size > settings.MAX_UPLOAD_SIZE_BYTES:
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=413, detail="File exceeds 10MB limit.")

    # Create DB record
    from fastapi import BackgroundTasks
    background_tasks = BackgroundTasks()

    doc = Document(
        user_id=current_user.id,
        filename=original_filename,
        stored_filename=stored_name,
        file_path=str(file_path),
        file_size=total_size,
        status="processing",
        category="General",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Process in background
    import threading
    t = threading.Thread(
        target=_process_document,
        args=(doc.id, str(file_path), current_user.id, original_filename, settings.DATABASE_URL),
        daemon=True,
    )
    t.start()

    return {
        "done": True,
        "document": {
            "id": doc.id,
            "filename": doc.filename,
            "file_size": doc.file_size,
            "status": doc.status,
            "category": doc.category,
            "created_at": doc.created_at.isoformat(),
        }
    }


# ── Legacy single-file upload (kept for backwards compat) ─────────────────────

@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_documents(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload PDFs and start background processing (extraction + embedding)."""
    uploaded_docs = []

    for file in files:
        suffix = Path(file.filename).suffix.lower()
        if suffix not in settings.ALLOWED_EXTENSIONS:
            continue

        content = await file.read()

        if len(content) > settings.MAX_UPLOAD_SIZE_BYTES:
            continue

        stored_name = f"{uuid.uuid4().hex}{suffix}"
        user_upload_dir = settings.UPLOAD_DIR / str(current_user.id)
        user_upload_dir.mkdir(parents=True, exist_ok=True)
        file_path = user_upload_dir / stored_name

        with open(file_path, "wb") as f:
            f.write(content)

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

        background_tasks.add_task(
            _process_document,
            doc.id,
            str(file_path),
            current_user.id,
            file.filename,
            settings.DATABASE_URL,
        )

        uploaded_docs.append({
            "id": doc.id,
            "filename": doc.filename,
            "file_size": doc.file_size,
            "status": doc.status,
            "category": doc.category or "General",
            "created_at": doc.created_at.isoformat(),
        })

    if not uploaded_docs:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="No valid PDF files were uploaded.",
        )

    return {
        "message": f"{len(uploaded_docs)} document(s) uploaded. Processing started in background.",
        "documents": uploaded_docs
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

    delete_document_from_store(current_user.id, document_id)

    try:
        if os.path.exists(doc.file_path):
            os.remove(doc.file_path)
    except Exception as e:
        print(f"[Delete] Could not remove file: {e}")

    db.delete(doc)
    db.commit()
