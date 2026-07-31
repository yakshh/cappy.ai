"""
models/document_chunk.py — PostgreSQL persistence for document text chunks.
Ensures Deep Search and RAG work permanently on Vercel.
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from database import Base


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    document_name = Column(String(255), nullable=False)
    page = Column(Integer, default=1)
    chunk_index = Column(Integer, default=0)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
