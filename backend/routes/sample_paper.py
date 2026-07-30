"""
routes/sample_paper.py — Generate GTU examination sample papers from uploaded documents.
"""

import json
import re
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models.user import User
from models.document import Document
from rag.vector_store import query_store
from rag.generator import generate_sample_paper, solve_question_paper, parse_json_robust

router = APIRouter(prefix="/api/sample-paper", tags=["Sample Paper"])


class SamplePaperRequest(BaseModel):
    document_ids: List[int]
    university_name: Optional[str] = "UNIVERSITY EXAMINATION"
    subject_code: str = "3160716"
    subject_name: str = "IOT and Applications"
    exam_term: str = "SUMMER 2024"
    total_marks: int = 70


class SolvePaperRequest(BaseModel):
    document_ids: List[int]
    paper_text: str
    subject_name: Optional[str] = "Subject"


@router.post("/")
def create_sample_paper(
    payload: SamplePaperRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a structured sample question paper from selected documents."""
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

    search_query = f"{payload.subject_name} key concepts principles applications architectures algorithms protocols security"
    chunks = query_store(
        user_id=current_user.id,
        query_text=search_query,
        n_results=5,
        document_ids=payload.document_ids,
    )

    if not chunks:
        raise HTTPException(status_code=404, detail="No content found in selected documents.")

    combined_text = "\n\n".join(c["text"] for c in chunks)
    try:
        raw_json = generate_sample_paper(
            text=combined_text,
            university_name=payload.university_name or "UNIVERSITY EXAMINATION",
            subject_code=payload.subject_code,
            subject_name=payload.subject_name,
            exam_term=payload.exam_term,
            total_marks=payload.total_marks,
        )
    except Exception as e:
        print(f"[Sample Paper Generation Error]: {e}")
        raise HTTPException(
            status_code=503,
            detail="AI generation is unavailable. Add a valid GROQ_API_KEY or GEMINI_API_KEY in Vercel and redeploy.",
        )

    try:
        paper_data = parse_json_robust(raw_json)
    except Exception as e:
        print(f"[Sample Paper Error]: {e} | Raw output: {raw_json[:200]}")
        raise HTTPException(status_code=500, detail="AI returned invalid sample paper format. Please try again.")

    return {
        "paper": paper_data,
        "documents": [{"id": d.id, "filename": d.filename} for d in docs],
    }


@router.post("/solve")
def solve_uploaded_paper(
    payload: SolvePaperRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate step-by-step model solutions for an uploaded/pasted question paper."""
    if not payload.paper_text.strip():
        raise HTTPException(status_code=400, detail="Question paper text cannot be empty.")

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
        raise HTTPException(status_code=404, detail="No ready study documents selected.")

    search_query = payload.paper_text[:250]
    chunks = query_store(
        user_id=current_user.id,
        query_text=search_query,
        n_results=5,
        document_ids=payload.document_ids,
    )

    if not chunks:
        raise HTTPException(status_code=404, detail="No content found in selected study documents.")

    combined_text = "\n\n".join(c["text"] for c in chunks)
    raw_json = solve_question_paper(
        paper_text=payload.paper_text,
        context=combined_text,
        subject_name=payload.subject_name or "Subject Exam",
    )

    try:
        solution_data = parse_json_robust(raw_json)
    except Exception as e:
        print(f"[Solve Paper Error]: {e} | Raw output: {raw_json[:200]}")
        raise HTTPException(status_code=500, detail="AI returned invalid solution format. Please try again.")

    return {
        "solutions": solution_data,
        "documents": [{"id": d.id, "filename": d.filename} for d in docs],
    }
