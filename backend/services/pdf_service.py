"""
services/pdf_service.py — Hybrid 3-Tier PDF Text Extraction Engine.
Handles digital PDFs, scanned images, and handwritten study notes:
  Tier 1: Native PDF Text Extraction (pdfplumber)
  Tier 2: Local OCR Engine (EasyOCR / PyTesseract)
  Tier 3: Gemini Multimodal Vision API (Handwritten & Scanned Fallback)
"""

import io
import os
import shutil
import logging
from pathlib import Path
from typing import List, Dict

import pdfplumber
from PIL import Image

from config import settings

logger = logging.getLogger(__name__)

# Check EasyOCR availability
try:
    import easyocr
    _easyocr_reader = None
    HAS_EASYOCR = True
except ImportError:
    HAS_EASYOCR = False
    _easyocr_reader = None

# Check PyTesseract availability
try:
    import pytesseract
    HAS_PYTESSERACT = True
except ImportError:
    HAS_PYTESSERACT = False
    pytesseract = None


def _get_easyocr_reader():
    global _easyocr_reader
    if HAS_EASYOCR and _easyocr_reader is None:
        try:
            logger.info("[EasyOCR] Initializing English reader model...")
            _easyocr_reader = easyocr.Reader(['en'], gpu=False)
        except Exception as e:
            logger.warning(f"[EasyOCR Init Warning]: {e}")
            _easyocr_reader = None
    return _easyocr_reader


def _ocr_easyocr(pil_img: Image.Image) -> str:
    """Run EasyOCR on a PIL image."""
    reader = _get_easyocr_reader()
    if not reader:
        return ""
    try:
        buf = io.BytesIO()
        pil_img.save(buf, format="PNG")
        results = reader.readtext(buf.getvalue())
        extracted = " ".join([res[1] for res in results])
        return extracted.strip()
    except Exception as e:
        logger.warning(f"[EasyOCR Error]: {e}")
        return ""


def _ocr_gemini_vision(pil_img: Image.Image) -> str:
    """Run Gemini Multimodal Vision OCR for handwritten notes and scanned diagrams."""
    api_key = settings.GEMINI_API_KEY or settings.GEMINI_API_KEY_2
    if not api_key:
        return ""

    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-flash-latest")

        buf = io.BytesIO()
        pil_img.save(buf, format="JPEG", quality=85)
        image_bytes = buf.getvalue()

        prompt = (
            "Transcribe all text from this study document page accurately. "
            "Include printed text, handwritten notes, mathematical formulas, "
            "and diagram labels. Return ONLY the extracted text content without explanations."
        )

        response = model.generate_content([
            {"mime_type": "image/jpeg", "data": image_bytes},
            prompt
        ])

        if response and hasattr(response, "text") and response.text:
            return response.text.strip()
    except Exception as e:
        logger.warning(f"[Gemini Vision OCR Error]: {e}")

    return ""


def extract_text_from_pdf(file_path: str) -> List[Dict]:
    """
    Extract text page by page from a PDF using the 3-Tier Hybrid Engine:
    1. Native PDF text extraction (pdfplumber)
    2. EasyOCR local image extraction
    3. Gemini Multimodal Vision API for handwritten notes & scanned images
    """
    pages = []
    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"PDF not found: {file_path}")

    with pdfplumber.open(str(path)) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            text = (page.extract_text() or "").strip()

            # If native text extraction is insufficient (< 30 chars), invoke OCR
            if len(text) < 30:
                try:
                    pil_img = page.to_image(resolution=200).original

                    # Tier 2: EasyOCR
                    if HAS_EASYOCR:
                        easy_text = _ocr_easyocr(pil_img)
                        if len(easy_text) >= 30:
                            text = easy_text

                    # Tier 3: Gemini Multimodal Vision Fallback for handwritten/scanned pages
                    if len(text) < 30:
                        vision_text = _ocr_gemini_vision(pil_img)
                        if vision_text:
                            text = vision_text

                except Exception as e_img:
                    logger.warning(f"[Page Image Render Error] p.{page_num}: {e_img}")

            if text:
                pages.append({
                    "page": page_num,
                    "text": text,
                    "char_count": len(text),
                })

    return pages


def get_page_count(file_path: str) -> int:
    """Return total page count of a PDF."""
    with pdfplumber.open(file_path) as pdf:
        return len(pdf.pages)
