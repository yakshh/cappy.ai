"""
routes/documents.py — Upload, list, and delete document endpoints.
"""

import uuid
import os
import shutil
import urllib.parse
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status, BackgroundTasks, Header
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

        # 3. Store chunks permanently in PostgreSQL for Vercel RAG persistence
        try:
            from models.document_chunk import DocumentChunk
            db.query(DocumentChunk).filter(DocumentChunk.document_id == document_id).delete()
            chunk_records = [
                DocumentChunk(
                    document_id=document_id,
                    user_id=user_id,
                    document_name=filename,
                    page=c["page"],
                    chunk_index=c["chunk_index"],
                    text=c["text"],
                )
                for c in chunks
            ]
            db.add_all(chunk_records)
            db.commit()
            print(f"[Document Processing] Saved {len(chunk_records)} chunks to PostgreSQL for doc {document_id}")
        except Exception as e_db:
            print(f"[Document Processing] DB Chunk Save Warning: {e_db}")

        # 4. Store embeddings in ChromaDB
        stored = add_chunks_to_store(
            user_id=user_id,
            document_id=document_id,
            document_name=filename,
            chunks=chunks,
        )
        doc.chunk_count = len(chunks)
        doc.status = "ready"

    except Exception as e:
        print(f"[Document Processing] ERROR for doc {document_id}: {e}")
        doc.status = "failed"

    finally:
        db.commit()
        db.close()


from typing import List

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
        # Validate file type
        suffix = Path(file.filename).suffix.lower()
        if suffix not in settings.ALLOWED_EXTENSIONS:
            continue

        # Read file content
        content = await file.read()

        # Validate file size
        if len(content) > settings.MAX_UPLOAD_SIZE_BYTES:
            continue

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
        # Process document synchronously so chunks are written to PostgreSQL before serverless function completes
        try:
            _process_document(
                doc.id,
                str(file_path),
                current_user.id,
                file.filename,
                settings.DATABASE_URL,
            )
            db.refresh(doc)
        except Exception as e_proc:
            print(f"[Upload Sync Processing Error]: {e_proc}")

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


@router.post("/upload-chunk")
async def upload_chunk(
    file: UploadFile = File(...),
    upload_id: str = Header(None, alias="upload-id"),
    chunk_index: int = Header(0, alias="chunk-index"),
    total_chunks: int = Header(1, alias="total-chunks"),
    original_filename: str = Header(None, alias="original-filename"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Handle chunked upload of large PDF files for Vercel serverless body size limits."""
    filename = urllib.parse.unquote(original_filename) if original_filename else file.filename
    suffix = Path(filename).suffix.lower()
    if suffix not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")

    temp_dir = settings.UPLOAD_DIR / str(current_user.id) / "chunks" / (upload_id or "default")
    temp_dir.mkdir(parents=True, exist_ok=True)
    chunk_file = temp_dir / f"chunk_{chunk_index}.bin"

    content = await file.read()
    with open(chunk_file, "wb") as f:
        f.write(content)

    # Check how many chunks have arrived
    existing_chunks = list(temp_dir.glob("chunk_*.bin"))
    if len(existing_chunks) < total_chunks:
        return {"done": False, "chunk_index": chunk_index, "chunks_received": len(existing_chunks)}

    # All chunks received — reassemble full PDF file
    stored_name = f"{uuid.uuid4().hex}{suffix}"
    user_upload_dir = settings.UPLOAD_DIR / str(current_user.id)
    user_upload_dir.mkdir(parents=True, exist_ok=True)
    final_file_path = user_upload_dir / stored_name

    with open(final_file_path, "wb") as outfile:
        for i in range(total_chunks):
            c_path = temp_dir / f"chunk_{i}.bin"
            if c_path.exists():
                with open(c_path, "rb") as infile:
                    outfile.write(infile.read())

    # Clean up temp chunks
    try:
        shutil.rmtree(temp_dir, ignore_errors=True)
    except Exception:
        pass

    file_size = final_file_path.stat().st_size
    doc = Document(
        user_id=current_user.id,
        filename=filename,
        stored_filename=stored_name,
        file_path=str(final_file_path),
        file_size=file_size,
        status="processing",
        category="General",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Process synchronously right now on Vercel
    try:
        _process_document(
            doc.id,
            str(final_file_path),
            current_user.id,
            filename,
            settings.DATABASE_URL,
        )
        db.refresh(doc)
    except Exception as e_proc:
        print(f"[Chunk Upload Processing Error]: {e_proc}")

    return {
        "done": True,
        "document": {
            "id": doc.id,
            "filename": doc.filename,
            "file_size": doc.file_size,
            "status": doc.status,
            "category": doc.category or "General",
            "created_at": doc.created_at.isoformat(),
        }
    }


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


@router.delete("/{document_id}", status_code=status.HTTP_200_OK)
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a document, its chunks in PostgreSQL, its file on disk, and vector store entries."""
    try:
        doc = (
            db.query(Document)
            .filter(Document.id == document_id, Document.user_id == current_user.id)
            .first()
        )
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found.")

        # 1. Delete chunks from PostgreSQL DocumentChunk table
        try:
            from models.document_chunk import DocumentChunk
            db.query(DocumentChunk).filter(DocumentChunk.document_id == document_id).delete()
            db.commit()
        except Exception as e_chunk:
            print(f"[Delete] Could not remove document_chunks: {e_chunk}")
            db.rollback()

        # 2. Remove from ChromaDB / in-memory store
        try:
            delete_document_from_store(current_user.id, document_id)
        except Exception as e_store:
            print(f"[Delete] Could not remove vector store chunks: {e_store}")

        # 3. Remove file from disk
        try:
            if doc.file_path and os.path.exists(doc.file_path):
                os.remove(doc.file_path)
        except Exception as e_file:
            print(f"[Delete] Could not remove file: {e_file}")

        # 4. Remove Document record from DB
        db.delete(doc)
        db.commit()

        return {"message": "Document deleted successfully.", "id": document_id}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        import traceback
        print(f"[Delete Error]: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Delete error: {str(e)}")
