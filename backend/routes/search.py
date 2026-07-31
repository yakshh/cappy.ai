"""
routes/search.py — Semantic search over uploaded documents.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models.user import User
from rag.vector_store import query_store

router = APIRouter(prefix="/api/search", tags=["Search"])


class SearchRequest(BaseModel):
    query: str
    document_ids: Optional[List[int]] = None
    n_results: int = 10


@router.post("/")
def semantic_search(
    payload: SearchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Perform semantic search over the user's document collection."""
    if not payload.query.strip():
        raise HTTPException(status_code=422, detail="Query cannot be empty.")

    if not 1 <= payload.n_results <= 50:
        raise HTTPException(status_code=422, detail="n_results must be between 1 and 50.")

    try:
        results = query_store(
            user_id=current_user.id,
            query_text=payload.query,
            n_results=payload.n_results,
            document_ids=payload.document_ids,
            randomize=False,
        )
    except Exception as e:
        print(f"[Search] ChromaDB error: {e}")
        results = []

    # Sort results strictly by Semantic Relevance Match Score (SRMS) descending
    results = sorted(results, key=lambda x: x.get("score", 0), reverse=True)

    return {
        "query": payload.query,
        "total_results": len(results),
        "results": results,
    }

