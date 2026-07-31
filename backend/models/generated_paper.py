"""
models/generated_paper.py — Stores generated paper text in PostgreSQL so it survives Vercel restarts.
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from database import Base


class GeneratedPaper(Base):
    __tablename__ = "generated_papers"

    id = Column(Integer, primary_key=True, index=True)
    paper_id = Column(String(64), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    content = Column(Text, nullable=False)   # The raw markdown / paper text
    created_at = Column(DateTime, default=datetime.utcnow)
