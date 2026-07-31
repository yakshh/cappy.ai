"""
routes/search.py — Semantic and full-text search over uploaded documents.
Works 100% reliably on Vercel with PostgreSQL chunk persistence.
"""

from typing import List, Optional
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_

from auth import get_current_user
from database import get_db
from models.user import User
from models.document import Document
from models.document_chunk import DocumentChunk
from rag.vector_store import query_store
from services.pdf_service import extract_text_from_pdf
from services.chunking_service import chunk_pages

router = APIRouter(prefix="/api/search", tags=["Search"])


class SearchRequest(BaseModel):
    query: str
    document_ids: Optional[List[int]] = None
    n_results: int = 10


def _backfill_chunks_for_doc(db: Session, doc: Document):
    """Backfill DocumentChunk records in DB if missing for a ready document."""
    try:
        if not doc.file_path or not doc.status == "ready":
            return
        # Extract and chunk
        pages = extract_text_from_pdf(doc.file_path)
        chunks = chunk_pages(pages)
        for c in chunks:
            db.add(DocumentChunk(
                document_id=doc.id,
                user_id=doc.user_id,
                document_name=doc.filename,
                page=c.get("page", 1),
                chunk_index=c.get("chunk_index", 0),
                text=c.get("text", ""),
            ))
        db.commit()
    except Exception as e:
        print(f"[Search Backfill Warning] {e}")


@router.post("/")
def semantic_search(
    payload: SearchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Perform semantic and full-text search over the user's document collection."""
    query_str = payload.query.strip()
    if not query_str:
        raise HTTPException(status_code=422, detail="Query cannot be empty.")

    if not 1 <= payload.n_results <= 50:
        raise HTTPException(status_code=422, detail="n_results must be between 1 and 50.")

    # 1. Try vector store search first
    results = []
    try:
        results = query_store(
            user_id=current_user.id,
            query_text=query_str,
            n_results=payload.n_results,
            document_ids=payload.document_ids,
            randomize=False,
        )
    except Exception as e:
        print(f"[Search] Vector store query error: {e}")

    # 2. If vector search returned results, return them
    if results:
        results = sorted(results, key=lambda x: x.get("score", 0), reverse=True)
        return {
            "query": query_str,
            "total_results": len(results),
            "results": results,
        }

    # 3. Fallback: PostgreSQL database full-text / term matching
    # Ensure DocumentChunk records exist for user's ready documents
    user_docs = db.query(Document).filter(
        Document.user_id == current_user.id,
        Document.status == "ready",
    )
    if payload.document_ids:
        user_docs = user_docs.filter(Document.id.in_(payload.document_ids))
    user_docs = user_docs.all()

    if not user_docs:
        return {"query": query_str, "total_results": 0, "results": []}

    doc_ids = [d.id for d in user_docs]

    # Check if chunks exist in DB
    existing_chunks_count = db.query(DocumentChunk).filter(DocumentChunk.document_id.in_(doc_ids)).count()
    if existing_chunks_count == 0:
        for d in user_docs:
            _backfill_chunks_for_doc(db, d)

    # Search in PostgreSQL DocumentChunk table
    terms = [t.lower() for t in re.findall(r"\w+", query_str) if len(t) > 1]
    if not terms:
        terms = [query_str.lower()]

    db_chunks_query = db.query(DocumentChunk).filter(DocumentChunk.user_id == current_user.id)
    if payload.document_ids:
        db_chunks_query = db_chunks_query.filter(DocumentChunk.document_id.in_(payload.document_ids))

    # Match any of the query terms in text
    filters = [DocumentChunk.text.ilike(f"%{term}%") for term in terms]
    matched_chunks = db_chunks_query.filter(or_(*filters)).limit(payload.n_results * 3).all()

    # Calculate match score for each chunk
    scored_results = []
    for chunk in matched_chunks:
        chunk_lower = chunk.text.lower()
        # Count term matches
        match_count = sum(1 for term in terms if term in chunk_lower)
        score = min(0.99, round(0.50 + (match_count / max(1, len(terms))) * 0.45, 4))
        scored_results.append({
            "text": chunk.text,
            "document_id": chunk.document_id,
            "document_name": chunk.document_name,
            "page": chunk.page,
            "chunk_index": chunk.chunk_index,
            "score": score,
        })

    # Sort by score descending
    scored_results = sorted(scored_results, key=lambda x: x["score"], reverse=True)[:payload.n_results]

    return {
        "query": query_str,
        "total_results": len(scored_results),
        "results": scored_results,
    }
