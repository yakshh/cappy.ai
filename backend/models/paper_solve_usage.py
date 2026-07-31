"""
models/paper_solve_usage.py — Tracks daily paper solve counts per user in PostgreSQL.
"""

from datetime import date
from sqlalchemy import Column, Integer, Date, ForeignKey, UniqueConstraint
from database import Base


class PaperSolveUsage(Base):
    __tablename__ = "paper_solve_usage"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    solve_date = Column(Date, default=date.today, nullable=False)
    solve_count = Column(Integer, default=1, nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "solve_date", name="unique_user_solve_date"),
    )
