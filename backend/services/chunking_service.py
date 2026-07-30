"""
services/chunking_service.py — Splits extracted PDF pages into overlapping chunks.
Each chunk retains its source page number for citation.
"""

from typing import List, Dict
from config import settings


def chunk_pages(pages: List[Dict]) -> List[Dict]:
    """
    Split page texts into overlapping chunks for embedding.

    Args:
        pages: Output from pdf_service.extract_text_from_pdf()

    Returns:
        List of chunk dicts:
        [{"chunk_index": 0, "text": "...", "page": 1, "char_count": 500}, ...]
    """
    chunk_size = settings.CHUNK_SIZE
    overlap = settings.CHUNK_OVERLAP

    chunks = []
    chunk_index = 0

    for page_data in pages:
        text = page_data["text"]
        page_num = page_data["page"]

        # Slide a window over the page text
        start = 0
        while start < len(text):
            end = start + chunk_size
            chunk_text = text[start:end].strip()

            if chunk_text:
                chunks.append({
                    "chunk_index": chunk_index,
                    "text": chunk_text,
                    "page": page_num,
                    "char_count": len(chunk_text),
                })
                chunk_index += 1

            # Move forward by (chunk_size - overlap)
            start += chunk_size - overlap

            # If remaining text is shorter than overlap, stop to avoid duplicate tiny chunk
            if end >= len(text):
                break

    return chunks
