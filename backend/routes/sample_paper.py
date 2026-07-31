"""
routes/sample_paper.py — Generate GTU examination sample papers from uploaded documents.
"""

import os
import json
import io
import uuid
import re
import traceback
from datetime import date
from typing import List, Optional

import pdfplumber
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models.user import User
from models.document import Document
from models.generated_paper import GeneratedPaper
from rag.vector_store import query_store
from rag.generator import generate_sample_paper, solve_question_paper, parse_json_robust

router = APIRouter(prefix="/api/sample-paper", tags=["Sample Paper"])

# ── DB helpers for generated papers ───────────────────────────────────────────

def save_generated_paper_db(db: Session, user_id: int, paper_id: str, text: str):
    """Persist paper text to PostgreSQL so it survives serverless restarts."""
    existing = db.query(GeneratedPaper).filter(GeneratedPaper.paper_id == paper_id).first()
    if existing:
        existing.content = text
    else:
        db.add(GeneratedPaper(paper_id=paper_id, user_id=user_id, content=text))
    db.commit()

def get_generated_paper_db(db: Session, paper_id: str) -> Optional[str]:
    """Retrieve paper text from PostgreSQL."""
    row = db.query(GeneratedPaper).filter(GeneratedPaper.paper_id == paper_id).first()
    return row.content if row else None


class SamplePaperRequest(BaseModel):
    document_ids: List[int]
    university_name: Optional[str] = "UNIVERSITY EXAMINATION"
    subject_code: str = "3160716"
    subject_name: str = "IOT and Applications"
    exam_term: str = "SUMMER 2024"
    total_marks: int = 70


# ── Generate ───────────────────────────────────────────────────────────────────

@router.post("/")
def create_sample_paper(
    payload: SamplePaperRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a structured sample question paper from selected documents."""
    try:
        return _create_sample_paper_impl(payload, db, current_user)
    except HTTPException:
        raise
    except Exception as e:
        tb = traceback.format_exc()
        print(f"[Sample Paper CRASH]: {tb}")
        raise HTTPException(status_code=500, detail=f"Internal error: {type(e).__name__}: {e}")


def _create_sample_paper_impl(payload, db, current_user):
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

    # Try ChromaDB — it's empty on Vercel (ephemeral /tmp), so fall back gracefully
    search_query = f"{payload.subject_name} key concepts principles applications architectures algorithms protocols security"
    chunks = query_store(
        user_id=current_user.id,
        query_text=search_query,
        n_results=5,
        document_ids=payload.document_ids,
    )

    if chunks:
        combined_text = "\n\n".join(c["text"] for c in chunks)
    else:
        doc_names = ", ".join(d.filename for d in docs)
        combined_text = (
            f"Subject: {payload.subject_name} (Code: {payload.subject_code})\n"
            f"Study Materials: {doc_names}\n"
            f"Generate a comprehensive {payload.total_marks}-mark university examination paper "
            f"covering all major topics of {payload.subject_name}."
        )

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
        raise HTTPException(status_code=503, detail=f"AI generation failed: {e}")

    try:
        paper_data = parse_json_robust(raw_json)

        # Build raw markdown
        if "raw_markdown" not in paper_data and "questions" in paper_data:
            md = []
            if "instructions" in paper_data:
                md.append("**Instructions:**")
                for inst in paper_data["instructions"]:
                    md.append(f"- {inst}")
                md.append("\n---")
            for q in paper_data["questions"]:
                md.append(f"\n### {q.get('q_no', '')}")
                for item in q.get("items", []):
                    md.append(f"**{item.get('part', '')}** {item.get('question', '')} *(Marks: {item.get('marks', '')})*")
                if q.get("or_items"):
                    md.append("\n**OR**\n")
                    for item in q["or_items"]:
                        md.append(f"**{item.get('part', '')}** {item.get('question', '')} *(Marks: {item.get('marks', '')})*")
            paper_data["raw_markdown"] = "\n\n".join(md)

    except Exception as e:
        raise HTTPException(status_code=500, detail="AI returned invalid format. Please try again.")

    # Persist paper text to DB so Solve can retrieve it without OCR
    paper_id = str(uuid.uuid4())[:8]
    paper_data["paper_id"] = paper_id
    paper_text = paper_data.get("raw_markdown", paper_data.get("content", ""))
    try:
        save_generated_paper_db(db, current_user.id, paper_id, paper_text)
    except Exception as e:
        print(f"[Generated Paper DB Save Warning]: {e}")

    return {
        "paper": paper_data,
        "documents": [{"id": d.id, "filename": d.filename} for d in docs],
    }


# ── Solve ──────────────────────────────────────────────────────────────────────

@router.post("/solve-upload")
def solve_uploaded_pdf_paper(
    file: UploadFile = File(...),
    document_ids: List[int] = Form(...),
    subject_name: Optional[str] = Form("Subject Exam"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Extract text from PDF and generate model solutions."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")

    pdf_text = ""
    content = file.file.read()

    # 1. Check if this is one of our generated papers — retrieve text from DB
    match = re.search(r"ID-([a-zA-Z0-9]+)\.pdf", file.filename, re.IGNORECASE)
    if match:
        paper_id = match.group(1)
        saved_text = get_generated_paper_db(db, paper_id)
        if saved_text:
            pdf_text = saved_text
            print(f"[Solve] Retrieved generated paper from DB: {paper_id}")

    # 2. Standard pdfplumber text extraction
    if not pdf_text:
        try:
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                for page in pdf.pages:
                    ext = page.extract_text()
                    if ext:
                        pdf_text += ext + "\n"
        except Exception:
            pass

    # 3. If still no text (image-based PDF) — fail gracefully with a useful message
    if not pdf_text.strip():
        raise HTTPException(
            status_code=400,
            detail=(
                "This PDF appears to be image-based and cannot be read directly. "
                "Please upload the original question paper PDF (not a screenshot or scanned copy). "
                "Our AI-generated papers can be solved directly — try re-downloading and uploading one of those."
            )
        )

    docs = (
        db.query(Document)
        .filter(
            Document.id.in_(document_ids),
            Document.user_id == current_user.id,
            Document.status == "ready",
        )
        .all()
    )
    if not docs:
        raise HTTPException(status_code=404, detail="No ready study documents selected.")

    # Try ChromaDB, fall back to subject name if empty
    chunks = query_store(
        user_id=current_user.id,
        query_text=pdf_text[:250],
        n_results=5,
        document_ids=document_ids,
    )

    if chunks:
        combined_text = "\n\n".join(c["text"] for c in chunks)
    else:
        doc_names = ", ".join(d.filename for d in docs)
        combined_text = (
            f"Study materials: {doc_names}\n"
            f"Subject: {subject_name}\n"
            f"Answer all questions based on your knowledge of {subject_name}."
        )

    raw_json = solve_question_paper(
        paper_text=pdf_text,
        context=combined_text,
        subject_name=subject_name or "Subject Exam",
    )

    return {
        "solutions": {"raw_markdown": raw_json},
        "documents": [{"id": d.id, "filename": d.filename} for d in docs],
    }
