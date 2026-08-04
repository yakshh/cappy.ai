"""
config.py — Centralized application configuration.
Reads all settings from environment variables via .env file.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Detect Vercel serverless environment
IS_VERCEL = os.getenv("VERCEL") == "1" or os.getenv("VERCEL_ENV") is not None
BASE_DIR = Path("/tmp") if IS_VERCEL else Path(__file__).resolve().parent

# Load .env from backend directory if present
env_path = Path(__file__).resolve().parent / ".env"
if env_path.exists():
    load_dotenv(env_path)


class Settings:
    # ── App ──────────────────────────────────────────────────
    APP_NAME: str = os.getenv("APP_NAME", "cappy.ai")
    DEBUG: bool = os.getenv("DEBUG", "True").lower() == "true"

    # ── JWT ──────────────────────────────────────────────────
    SECRET_KEY: str = os.getenv("SECRET_KEY", "i_do_what_i_love_eventually_i_find_people_who_love_me_for_what_i_do_2026")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 10080)
    )

    # ── Gemini & Groq AI ──────────────────────────────────────
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_API_KEY_2: str = os.getenv("GEMINI_API_KEY_2", "")
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_API_KEY_2: str = os.getenv("GROQ_API_KEY_2", "")

    # ── File Upload ──────────────────────────────────────────
    MAX_UPLOAD_SIZE_BYTES: int = int(os.getenv("MAX_UPLOAD_SIZE_MB", 25)) * 1024 * 1024
    UPLOAD_DIR: Path = BASE_DIR / os.getenv("UPLOAD_DIR", "uploads")
    ALLOWED_EXTENSIONS: set = {".pdf"}

    # ── ChromaDB ─────────────────────────────────────────────
    CHROMA_PERSIST_DIR: Path = BASE_DIR / os.getenv("CHROMA_PERSIST_DIR", "chroma_db")

    # ── Database ─────────────────────────────────────────────
    # Vercel's filesystem is ephemeral. Configure DATABASE_URL with a hosted
    # PostgreSQL connection string in Vercel for persistent accounts/data.
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        os.getenv(
            "POSTGRES_URL",
            f"sqlite:///{BASE_DIR}/cappy.db" if IS_VERCEL else "sqlite:///./cappy.db",
        ),
    ).replace("postgres://", "postgresql+psycopg://", 1).replace(
        "postgresql://", "postgresql+psycopg://", 1
    )

    # ── Chunking ─────────────────────────────────────────────
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200

    # ── Embeddings ───────────────────────────────────────────
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"

    # ── Retrieval ────────────────────────────────────────────
    TOP_K_RESULTS: int = 5

    def __init__(self):
        # Ensure required directories exist
        try:
            self.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
            self.CHROMA_PERSIST_DIR.mkdir(parents=True, exist_ok=True)
        except Exception:
            pass


settings = Settings()
