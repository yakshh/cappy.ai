"""
services/pdf_service.py — Extracts text from PDF files using pdfplumber with OCR Fallback.
Handles both digital text PDFs and scanned image/handwritten notes PDFs.
"""

import os
import shutil
import logging
from pathlib import Path
from typing import List, Dict

import pdfplumber
from PIL import Image

logger = logging.getLogger(__name__)

try:
    import pytesseract
    HAS_PYTESSERACT = True
except ImportError:
    HAS_PYTESSERACT = False
    pytesseract = None


def _configure_tesseract():
    if not HAS_PYTESSERACT or pytesseract is None:
        return
    if shutil.which("tesseract"):
        return
    possible_paths = [
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        os.path.expanduser(r"~\AppData\Local\Programs\Tesseract-OCR\tesseract.exe"),
        r"D:\Program Files\Tesseract-OCR\tesseract.exe",
    ]
    for p in possible_paths:
        if os.path.exists(p):
            pytesseract.pytesseract.tesseract_cmd = p
            break

_configure_tesseract()


def _ocr_page_image(page) -> str:
    """Run Tesseract OCR on a pdfplumber page image if pytesseract is available."""
    if not HAS_PYTESSERACT or pytesseract is None:
        return ""
    try:
        pil_img = page.to_image(resolution=200).original
        text = pytesseract.image_to_string(pil_img)
        return text.strip()
    except Exception as e:
        logger.warning(f"[OCR] Warning during page OCR extraction: {e}")
        return ""


def extract_text_from_pdf(file_path: str) -> List[Dict]:
    """
    Extract text from each page of a PDF.
    Uses native text extraction first; if page text is empty/scanned, runs OCR automatically.
    """
    pages = []
    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"PDF not found: {file_path}")

    with pdfplumber.open(str(path)) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            text = (page.extract_text() or "").strip()

            if len(text) < 15 and HAS_PYTESSERACT:
                ocr_text = _ocr_page_image(page)
                if ocr_text:
                    text = ocr_text

            if text:
                pages.append({
                    "page": page_num,
                    "text": text,
                    "char_count": len(text),
                })

    return pages


def get_page_count(file_path: str) -> int:
    """Return the total page count of a PDF."""
    with pdfplumber.open(file_path) as pdf:
        return len(pdf.pages)
