"""
models/document.py — SQLAlchemy Document model for uploaded PDFs.
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, BigInteger
from sqlalchemy.orm import relationship
from database import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    filename = Column(String(255), nullable=False)          # original filename
    stored_filename = Column(String(255), nullable=False)   # UUID filename on disk
    file_path = Column(String(500), nullable=False)
    file_size = Column(BigInteger, default=0)               # bytes
    page_count = Column(Integer, default=0)
    chunk_count = Column(Integer, default=0)
    status = Column(String(50), default="processing")       # processing | ready | failed
    category = Column(String(100), default="General", index=True) # category / subject tag
    chroma_collection_id = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", backref="documents")

    def __repr__(self):
        return f"<Document id={self.id} filename={self.filename} status={self.status}>"
