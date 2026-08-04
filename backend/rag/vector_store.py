"""
rag/vector_store.py — Vector store operations with ChromaDB & lightweight fallback for Vercel.
"""

from typing import List, Dict
import numpy as np
import random
from config import settings
from rag.embeddings import embed_texts, embed_query

try:
    import chromadb
    HAS_CHROMADB = True
except ImportError:
    HAS_CHROMADB = False

_client = None
_fallback_store: Dict[int, List[Dict]] = {}  # user_id -> list of chunk dicts


def get_chroma_client():
    """Return the singleton ChromaDB persistent client if available."""
    global _client
    if HAS_CHROMADB and _client is None:
        try:
            _client = chromadb.PersistentClient(path=str(settings.CHROMA_PERSIST_DIR))
        except Exception as e:
            print(f"[VectorStore] ChromaDB init failed: {e}")
            _client = None
    return _client


def _collection_name(user_id: int) -> str:
    return f"user_{user_id}_docs"


def add_chunks_to_store(
    user_id: int,
    document_id: int,
    document_name: str,
    chunks: List[Dict],
) -> int:
    client = get_chroma_client()
    texts = [c["text"] for c in chunks]
    embeddings = embed_texts(texts)

    if client is not None:
        try:
            collection = client.get_or_create_collection(
                name=_collection_name(user_id),
                metadata={"hnsw:space": "cosine"},
            )
            ids = [f"doc{document_id}_chunk{c['chunk_index']}" for c in chunks]
            metadatas = [
                {
                    "document_id": document_id,
                    "document_name": document_name,
                    "page": c["page"],
                    "chunk_index": c["chunk_index"],
                }
                for c in chunks
            ]
            collection.add(
                ids=ids,
                embeddings=embeddings,
                documents=texts,
                metadatas=metadatas,
            )
            return len(chunks)
        except Exception as e:
            print(f"[VectorStore Error]: {e}")

    # Fallback in-memory store for serverless Vercel
    if user_id not in _fallback_store:
        _fallback_store[user_id] = []
    
    for c, emb in zip(chunks, embeddings):
        _fallback_store[user_id].append({
            "text": c["text"],
            "document_id": document_id,
            "document_name": document_name,
            "page": c["page"],
            "chunk_index": c["chunk_index"],
            "embedding": emb,
        })
    return len(chunks)


def query_store(
    user_id: int,
    query_text: str,
    n_results: int = None,
    document_ids: List[int] = None,
    randomize: bool = True,
) -> List[Dict]:
    client = get_chroma_client()
    n_results = n_results or settings.TOP_K_RESULTS
    query_embedding = embed_query(query_text)

    if client is not None:
        try:
            collection = client.get_collection(_collection_name(user_id))
            where_filter = None
            if document_ids:
                if len(document_ids) == 1:
                    where_filter = {"document_id": document_ids[0]}
                else:
                    where_filter = {"document_id": {"$in": document_ids}}

            count = collection.count()
            if count > 0:
                fetch_n = min(n_results * 2, count) if randomize else n_results
                actual_n = max(1, min(fetch_n, count))

                results = collection.query(
                    query_embeddings=[query_embedding],
                    n_results=actual_n,
                    where=where_filter,
                    include=["documents", "metadatas", "distances"],
                )

                output = []
                if results["documents"] and results["documents"][0]:
                    for doc, meta, dist in zip(
                        results["documents"][0],
                        results["metadatas"][0],
                        results["distances"][0],
                    ):
                        output.append({
                            "text": doc,
                            "document_id": meta.get("document_id"),
                            "document_name": meta.get("document_name"),
                            "page": meta.get("page"),
                            "chunk_index": meta.get("chunk_index"),
                            "score": round(1 - dist, 4),
                        })

                if randomize and len(output) > n_results:
                    output = random.sample(output, n_results)

                if output:
                    return output
        except Exception:
            pass

    # Fallback in-memory query handling
    user_chunks = _fallback_store.get(user_id, [])
    if document_ids:
        user_chunks = [c for c in user_chunks if c["document_id"] in document_ids]

    if user_chunks:
        q_vec = np.array(query_embedding, dtype=np.float32)
        scores = []
        for c in user_chunks:
            c_vec = np.array(c["embedding"], dtype=np.float32)
            norm_product = (np.linalg.norm(q_vec) * np.linalg.norm(c_vec))
            sim = float(np.dot(q_vec, c_vec) / norm_product) if norm_product > 0 else 0.0
            scores.append((sim, c))

        scores.sort(key=lambda x: x[0], reverse=True)
        top_items = scores[:n_results * 2] if randomize else scores[:n_results]

        output = []
        for sim, c in top_items:
            output.append({
                "text": c["text"],
                "document_id": c["document_id"],
                "document_name": c["document_name"],
                "page": c["page"],
                "chunk_index": c["chunk_index"],
                "score": round(sim, 4),
            })

        if randomize and len(output) > n_results:
            output = random.sample(output, n_results)

        if output:
            return output

    # Permanent fallback: Query DocumentChunk table from PostgreSQL database
    try:
        import os, re
        from database import SessionLocal
        from models.document_chunk import DocumentChunk
        from models.document import Document

        db = SessionLocal()
        try:
            query = db.query(DocumentChunk).filter(DocumentChunk.user_id == user_id)
            if document_ids:
                query = query.filter(DocumentChunk.document_id.in_(document_ids))

            db_chunks = query.all()

            # If chunks are missing for selected documents, backfill from stored file_path if available
            if not db_chunks and document_ids:
                docs_to_backfill = db.query(Document).filter(
                    Document.id.in_(document_ids),
                    Document.user_id == user_id,
                ).all()

                for doc in docs_to_backfill:
                    if doc.file_path and os.path.exists(doc.file_path):
                        try:
                            from services.pdf_service import extract_text_from_pdf
                            from services.chunking_service import chunk_pages

                            pages = extract_text_from_pdf(doc.file_path)
                            c_list = chunk_pages(pages)
                            new_records = [
                                DocumentChunk(
                                    document_id=doc.id,
                                    user_id=user_id,
                                    document_name=doc.filename,
                                    page=c["page"],
                                    chunk_index=c["chunk_index"],
                                    text=c["text"],
                                )
                                for c in c_list
                            ]
                            db.add_all(new_records)
                            db.commit()
                            doc.chunk_count = len(c_list)
                            doc.status = "ready"
                            db.commit()
                        except Exception as ex:
                            print(f"[Backfill Error] doc {doc.id}: {ex}")

                # Re-query after backfill
                query = db.query(DocumentChunk).filter(DocumentChunk.user_id == user_id)
                if document_ids:
                    query = query.filter(DocumentChunk.document_id.in_(document_ids))
                db_chunks = query.all()

            if not db_chunks:
                return []

            # Match chunks against query_text using keyword overlap & phrase matching
            q_clean = query_text.strip().lower()
            raw_terms = [t.lower() for t in re.findall(r"\w+", q_clean) if len(t) >= 2]

            scored = []
            for c in db_chunks:
                text_lower = c.text.lower()

                kw_score = 0.0
                if raw_terms:
                    word_matches = sum(1 for term in raw_terms if term in text_lower)
                    kw_score = word_matches / len(raw_terms)
                    if q_clean in text_lower:
                        kw_score = min(1.0, kw_score + 0.35)

                if kw_score > 0:
                    score = round(kw_score, 4)
                else:
                    score = 0.0

                if randomize:
                    score = max(score, 0.5)

                scored.append((score, c))

            # For search queries (randomize=False), filter out 0-match chunks (< 0.10)
            if not randomize:
                scored = [(s, c) for s, c in scored if s >= 0.10]

            scored.sort(key=lambda x: x[0], reverse=True)
            selected = scored[:n_results * 2] if randomize else scored[:n_results]

            output = []
            for score, c in selected:
                output.append({
                    "text": c.text,
                    "document_id": c.document_id,
                    "document_name": c.document_name,
                    "page": c.page,
                    "chunk_index": c.chunk_index,
                    "score": score,
                })

            if randomize and len(output) > n_results:
                output = random.sample(output, n_results)

            return output
        finally:
            db.close()
    except Exception as e:
        print(f"[PostgreSQL Chunk Search Error]: {e}")

    return []


def delete_document_from_store(user_id: int, document_id: int) -> None:
    client = get_chroma_client()
    if client is not None:
        try:
            collection = client.get_collection(_collection_name(user_id))
            results = collection.get(where={"document_id": document_id})
            if results["ids"]:
                collection.delete(ids=results["ids"])
        except Exception:
            pass

    if user_id in _fallback_store:
        _fallback_store[user_id] = [
            c for c in _fallback_store[user_id] if c["document_id"] != document_id
        ]
