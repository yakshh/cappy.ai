"""
routes/quiz.py — Generate quiz questions from uploaded documents.
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
from rag.generator import generate_quiz, generate_flashcards, parse_json_robust

router = APIRouter(prefix="/api/quiz", tags=["Quiz"])


class QuizRequest(BaseModel):
    document_ids: List[int]
    quiz_type: str = "mcq"       # mcq | flashcards
    num_questions: int = 5
    topic: Optional[str] = None


@router.post("/")
def create_quiz(
    payload: QuizRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate MCQ or Flashcards quiz from selected documents."""
    valid_types = ("mcq", "flashcards")
    if payload.quiz_type not in valid_types:
        raise HTTPException(status_code=422, detail=f"quiz_type must be one of: {valid_types}")

    if not 1 <= payload.num_questions <= 30:
        raise HTTPException(status_code=422, detail="num_questions must be between 1 and 30.")

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

    search_query = payload.topic or ("definitions terms concepts key facts" if payload.quiz_type == "flashcards" else "key concepts definitions principles examples")
    chunks = query_store(
        user_id=current_user.id,
        query_text=search_query,
        n_results=5,
        document_ids=payload.document_ids,
    )

    if not chunks:
        raise HTTPException(status_code=404, detail="No content found.")

    combined_text = "\n\n".join(c["text"] for c in chunks)
    if payload.quiz_type == "flashcards":
        raw_json = generate_flashcards(combined_text, num_cards=payload.num_questions)
    else:
        raw_json = generate_quiz(combined_text, quiz_type="mcq", num_questions=payload.num_questions)

    try:
        questions = parse_json_robust(raw_json)
        if not isinstance(questions, list):
            questions = [questions]
    except Exception as e:
        print(f"[Quiz Error]: {e} | Raw output: {raw_json[:200]}")
        raise HTTPException(status_code=500, detail="AI returned invalid format. Please try again.")

    return {
        "quiz_type": payload.quiz_type,
        "num_questions": len(questions),
        "questions": questions,
        "documents": [{"id": d.id, "filename": d.filename} for d in docs],
    }
