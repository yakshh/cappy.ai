"""
routes/summary.py — Generate summaries from uploaded documents.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models.user import User
from models.document import Document
from rag.vector_store import query_store
from rag.generator import generate_summary

router = APIRouter(prefix="/api/summary", tags=["Summary"])


class SummaryRequest(BaseModel):
    document_ids: List[int]
    mode: str = "short"  # short | detailed | bullets
    topic: Optional[str] = None  # Optional topic to focus on


@router.post("/")
def create_summary(
    payload: SummaryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a summary of selected documents using retrieved chunks."""
    if payload.mode not in ("short", "detailed", "bullets"):
        raise HTTPException(status_code=422, detail="mode must be: short, detailed, or bullets")

    # Verify all documents belong to current user
    docs = (
        db.query(Document)
        .filter(
            Document.id.in_(payload.document_ids),
            Document.user_id == current_user.id,
            Document.status == "ready",
        )
        .all()
    )
    if not docs:
        raise HTTPException(status_code=404, detail="No ready documents found.")

    # Use a broad query to retrieve representative chunks
    search_query = payload.topic or "main concepts key topics overview summary"
    chunks = query_store(
        user_id=current_user.id,
        query_text=search_query,
        n_results=15,
        document_ids=payload.document_ids,
    )

    if not chunks:
        raise HTTPException(status_code=404, detail="No content found in selected documents.")

    combined_text = "\n\n".join(c["text"] for c in chunks)
    summary = generate_summary(combined_text, mode=payload.mode, topic=payload.topic)

    return {
        "summary": summary,
        "mode": payload.mode,
        "documents": [{"id": d.id, "filename": d.filename} for d in docs],
        "chunks_used": len(chunks),
    }
