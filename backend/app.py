"""
app.py — FastAPI application entry point.
Registers all routers, configures CORS, and initializes the database.
"""

import sys
from pathlib import Path

# Ensure backend directory is in sys.path for Vercel Serverless Function imports
BASE_BACKEND_DIR = Path(__file__).resolve().parent
if str(BASE_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_BACKEND_DIR))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from config import settings
from database import init_db

# Always ensure database tables are created upon module import
try:
    init_db()
    print("[Database] Tables initialized successfully.")
except Exception as e:
    print(f"[Database Error]: {e}")

# ── Routers ───────────────────────────────────────────────────────────────────
from routes.auth import router as auth_router
from routes.documents import router as documents_router
from routes.chat import router as chat_router
from routes.summary import router as summary_router
from routes.quiz import router as quiz_router
from routes.flashcards import router as flashcards_router
from routes.sample_paper import router as sample_paper_router
from routes.search import router as search_router
from routes.users import router as users_router


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: verify DB tables."""
    print(f"[Startup] {settings.APP_NAME} starting...")
    try:
        init_db()
    except Exception:
        pass
    yield
    print("[Shutdown] Application shutting down.")


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    description="RAG-powered study assistant — answers questions from your uploaded PDFs.",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register routers (both with and without /api prefix for Vercel route compatibility) ──
routers = [
    auth_router,
    documents_router,
    chat_router,
    summary_router,
    quiz_router,
    flashcards_router,
    sample_paper_router,
    search_router,
    users_router,
]

for r in routers:
    app.include_router(r)


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/api/health", tags=["Health"])
@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "app": settings.APP_NAME, "version": "1.0.0"}


# ── Dev server entry ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
