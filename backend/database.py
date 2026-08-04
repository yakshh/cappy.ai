"""
database.py — SQLAlchemy database setup and session management.
"""

from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from config import settings

engine_options = {}
if settings.DATABASE_URL.startswith("sqlite"):
    engine_options["connect_args"] = {"check_same_thread": False}

engine = create_engine(settings.DATABASE_URL, **engine_options)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency — yields a DB session and closes it after use."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_db_schema():
    """Ensure missing table columns exist in database."""
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS field VARCHAR(120);"))
            conn.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS category VARCHAR(100);"))
            conn.commit()
    except Exception as e:
        print(f"[Database Schema Notice]: {e}")


def init_db():
    """Create all tables defined in models and migrate missing columns."""
    ensure_db_schema()
    import models  # noqa: F401 — import to register all models
    Base.metadata.create_all(bind=engine)
