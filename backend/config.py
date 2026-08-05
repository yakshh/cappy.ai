"""
config.py — Centralized application configuration.
Reads settings from environment variables with safe defaults.
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
    APP_NAME: str = os.getenv("APP_NAME", "cappy.ai")
    DEBUG: bool = os.getenv("DEBUG", "True").lower() == "true"

    SECRET_KEY: str = os.getenv(
        "SECRET_KEY",
        "i_do_what_i_love_eventually_i_find_people_who_love_me_for_what_i_do_2026",
    )
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 10080)
    )

    # Multi-provider API Keys
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_API_KEY_2: str = os.getenv("GEMINI_API_KEY_2", "")
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_API_KEY_2: str = os.getenv("GROQ_API_KEY_2", "")

    # Storage & Upload limits
    MAX_UPLOAD_SIZE_BYTES: int = int(os.getenv("MAX_UPLOAD_SIZE_MB", 25)) * 1024 * 1024
    UPLOAD_DIR: Path = BASE_DIR / os.getenv("UPLOAD_DIR", "uploads")
    ALLOWED_EXTENSIONS: set = {".pdf"}

    CHROMA_PERSIST_DIR: Path = BASE_DIR / os.getenv("CHROMA_PERSIST_DIR", "chroma_db")

    # Database configuration
    _raw_db_url: str = os.getenv("DATABASE_URL", os.getenv("POSTGRES_URL", ""))
    if _raw_db_url:
        DATABASE_URL: str = _raw_db_url.replace("postgres://", "postgresql://", 1)
    else:
        DATABASE_URL: str = (
            f"sqlite:///{BASE_DIR}/cappy.db" if IS_VERCEL else "sqlite:///./cappy.db"
        )

    # Processing limits
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    TOP_K_RESULTS: int = 5

    def __init__(self):
        try:
            self.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
            self.CHROMA_PERSIST_DIR.mkdir(parents=True, exist_ok=True)
        except Exception:
            pass


settings = Settings()
