"""
routes/flashcards.py — Generate flashcards from uploaded documents.
"""

import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models.user import User
from models.document import Document
from rag.vector_store import query_store
from rag.generator import generate_flashcards, parse_json_robust

router = APIRouter(prefix="/api/flashcards", tags=["Flashcards"])


class FlashcardRequest(BaseModel):
    document_ids: List[int]
    num_cards: int = 10
    topic: Optional[str] = None


@router.post("/")
def create_flashcards(
    payload: FlashcardRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate flashcards from selected documents."""
    if not 1 <= payload.num_cards <= 30:
        raise HTTPException(status_code=422, detail="num_cards must be between 1 and 30.")

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

    search_query = payload.topic or "definitions terms concepts key facts vocabulary"
    chunks = query_store(
        user_id=current_user.id,
        query_text=search_query,
        n_results=5,
        document_ids=payload.document_ids,
    )

    if not chunks:
        raise HTTPException(status_code=404, detail="No content found.")

    combined_text = "\n\n".join(c["text"] for c in chunks)
    raw_json = generate_flashcards(combined_text, num_cards=payload.num_cards)

    try:
        cards = parse_json_robust(raw_json)
        if not isinstance(cards, list):
            cards = [cards]
    except Exception as e:
        print(f"[Flashcards Error]: {e} | Raw output: {raw_json[:200]}")
        raise HTTPException(status_code=500, detail="AI returned invalid flashcard format. Please try again.")

    return {
        "num_cards": len(cards),
        "flashcards": cards,
        "documents": [{"id": d.id, "filename": d.filename} for d in docs],
    }
