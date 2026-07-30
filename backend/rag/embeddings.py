"""
rag/embeddings.py — Singleton wrapper around embedding models.
Supports local sentence-transformers when available, and lightweight API/numpy fallback for serverless deployments (Vercel).
"""

from typing import List
import numpy as np
from config import settings

_model = None

try:
    from sentence_transformers import SentenceTransformer
    HAS_ST = True
except ImportError:
    HAS_ST = False


def get_embedding_model():
    """Load and cache local sentence-transformer model if available."""
    global _model
    if HAS_ST and _model is None:
        try:
            print(f"[Embeddings] Loading local model: {settings.EMBEDDING_MODEL}")
            _model = SentenceTransformer(settings.EMBEDDING_MODEL)
            print("[Embeddings] Model loaded successfully.")
        except Exception as e:
            print(f"[Embeddings] Failed to load local SentenceTransformer: {e}")
            _model = None
    return _model


def _lightweight_hash_embedding(text: str, dim: int = 384) -> List[float]:
    """Fallback pure-Python 384D normalized vector embedding for serverless environments."""
    import hashlib
    vec = np.zeros(dim, dtype=np.float32)
    words = text.lower().split()
    for word in words:
        h = int(hashlib.md5(word.encode('utf-8')).hexdigest(), 16)
        idx = h % dim
        val = 1.0 if (h & 1) else -1.0
        vec[idx] += val
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec /= norm
    return vec.tolist()


def embed_texts(texts: List[str]) -> List[List[float]]:
    """
    Generate embeddings for a list of text strings.
    Uses local SentenceTransformer if available, or lightweight API/numpy fallback.
    """
    model = get_embedding_model()
    if model is not None:
        try:
            embeddings = model.encode(texts, show_progress_bar=False, convert_to_numpy=True)
            return embeddings.tolist()
        except Exception as e:
            print(f"[Embeddings Error]: {e}")

    # Fallback for serverless Vercel deployment
    return [_lightweight_hash_embedding(t) for t in texts]


def embed_query(query: str) -> List[float]:
    """Generate a single embedding vector for a search query."""
    return embed_texts([query])[0]
