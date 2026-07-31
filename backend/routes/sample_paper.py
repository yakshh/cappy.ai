"""
routes/sample_paper.py — Generate GTU examination sample papers from uploaded documents.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session
import os
import json
import io
import pdfplumber
from datetime import date
from typing import List, Optional

from auth import get_current_user
from database import get_db
from models.user import User
from models.document import Document
from rag.vector_store import query_store
from rag.generator import generate_sample_paper, solve_question_paper, parse_json_robust

router = APIRouter(prefix="/api/sample-paper", tags=["Sample Paper"])

USAGE_FILE = "usage.json"
GENERATED_PAPERS_FILE = "generated_papers.json"

import uuid
import re

def save_generated_paper(paper_id: str, text: str):
    data = {}
    if os.path.exists(GENERATED_PAPERS_FILE):
        try:
            with open(GENERATED_PAPERS_FILE, 'r') as f:
                data = json.load(f)
        except:
            pass
    data[paper_id] = text
    with open(GENERATED_PAPERS_FILE, 'w') as f:
        json.dump(data, f)

def get_generated_paper(paper_id: str) -> Optional[str]:
    if os.path.exists(GENERATED_PAPERS_FILE):
        try:
            with open(GENERATED_PAPERS_FILE, 'r') as f:
                data = json.load(f)
                return data.get(paper_id)
        except:
            pass
    return None

def check_daily_limit(user_id: int):
    today = str(date.today())
    usage = {}
    if os.path.exists(USAGE_FILE):
        try:
            with open(USAGE_FILE, 'r') as f:
                usage = json.load(f)
        except:
            pass
            
    uid_str = str(user_id)
    user_usage = usage.get(uid_str, {"date": today, "count": 0})
    if user_usage["date"] != today:
        user_usage = {"date": today, "count": 0}
        
    if user_usage["count"] >= 50:
        raise HTTPException(status_code=429, detail="Daily limit of 5 paper solves reached. Please try again tomorrow.")
        
    user_usage["count"] += 1
    usage[uid_str] = user_usage
    with open(USAGE_FILE, 'w') as f:
        json.dump(usage, f)


class SamplePaperRequest(BaseModel):
    document_ids: List[int]
    university_name: Optional[str] = "UNIVERSITY EXAMINATION"
    subject_code: str = "3160716"
    subject_name: str = "IOT and Applications"
    exam_term: str = "SUMMER 2024"
    total_marks: int = 70


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
        
        # Build raw markdown if not present
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
        print(f"[Sample Paper Error]: {e} | Raw output: {raw_json[:200]}")
        raise HTTPException(status_code=500, detail="AI returned invalid sample paper format. Please try again.")

    # Save the generated paper so we can solve it later without OCR
    paper_id = str(uuid.uuid4())[:8]
    paper_data["paper_id"] = paper_id
    save_generated_paper(paper_id, paper_data.get("raw_markdown", paper_data.get("content", "")))

    return {
        "paper": paper_data,
        "documents": [{"id": d.id, "filename": d.filename} for d in docs],
    }


@router.post("/solve-upload")
def solve_uploaded_pdf_paper(
    file: UploadFile = File(...),
    document_ids: List[int] = Form(...),
    subject_name: Optional[str] = Form("Subject Exam"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Extract text from PDF and generate model solutions."""
    check_daily_limit(current_user.id)

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")
        
    pdf_text = ""
    content = file.file.read()
    
    # 1. MAGIC CHECK: Did they upload a paper generated by our system?
    match = re.search(r"ID-([a-zA-Z0-9]+)\.pdf", file.filename, re.IGNORECASE)
    if match:
        paper_id = match.group(1)
        saved_text = get_generated_paper(paper_id)
        if saved_text:
            pdf_text = saved_text
            
    # 2. STANDARD CHECK: If not one of ours, try to extract text normally
    if not pdf_text:
        try:
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                for page in pdf.pages:
                    ext = page.extract_text()
                    if ext:
                        pdf_text += ext + "\n"
        except Exception:
            pass
        
    if not pdf_text.strip():
        # Fallback for image-based PDFs (like those generated by html2pdf)
        from config import settings
        if not settings.GEMINI_API_KEY:
            raise HTTPException(status_code=400, detail="No readable text found in PDF. To read image-based PDFs, please add GEMINI_API_KEY in backend/.env.")
            
        import tempfile
        import google.generativeai as genai
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                tmp.write(content)
                tmp_path = tmp.name
                
            genai.configure(api_key=settings.GEMINI_API_KEY)
            sample_file = genai.upload_file(path=tmp_path)
            model = genai.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content([sample_file, "Extract all the text from this exam question paper accurately. Preserve all questions, marks, and structure."])
            pdf_text = response.text
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to read image PDF with Gemini: {e}")
        finally:
            if 'tmp_path' in locals() and os.path.exists(tmp_path):
                os.remove(tmp_path)
                
    if not pdf_text.strip():
        raise HTTPException(status_code=400, detail="No readable text found in PDF, even after AI fallback.")

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

    search_query = pdf_text[:250]
    chunks = query_store(
        user_id=current_user.id,
        query_text=search_query,
        n_results=5,
        document_ids=document_ids,
    )

    if not chunks:
        raise HTTPException(status_code=404, detail="No content found in selected study documents.")

    combined_text = "\n\n".join(c["text"] for c in chunks)
    raw_markdown = solve_question_paper(
        paper_text=pdf_text,
        context=combined_text,
        subject_name=subject_name or "Subject Exam",
    )

    return {
        "solutions": {"raw_markdown": raw_markdown},
        "documents": [{"id": d.id, "filename": d.filename} for d in docs],
    }



