"""
rag/generator.py — Hybrid AI Generator with Automatic Provider Fallback.
Primary: Groq Cloud API (llama-3.3-70b-versatile @ 500+ tokens/sec)
Secondary: Google Gemini API (gemini-flash-latest)
Tertiary: Local Ollama (llama3.2:3b)
"""

import json
import logging
import urllib.request
import urllib.error
import google.generativeai as genai

from config import settings
from typing import List, Dict, Optional, Any

logger = logging.getLogger(__name__)

# Configure Gemini API if key is present
if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)

_gemini_model = None


def get_gemini_model():
    global _gemini_model
    if _gemini_model is None:
        _gemini_model = genai.GenerativeModel("gemini-flash-latest")
    return _gemini_model


def _call_gemini(prompt: str, response_json: bool = False, api_key: Optional[str] = None) -> str:
    """Call Google Gemini API with token-conserving generation config."""
    key = api_key or settings.GEMINI_API_KEY
    if not key:
        raise ValueError("GEMINI_API_KEY is not set.")
    genai.configure(api_key=key)
    model = genai.GenerativeModel("gemini-flash-latest")
    kwargs = {
        "temperature": 0.75,
        "max_output_tokens": 8192,
    }
    if response_json:
        kwargs["response_mime_type"] = "application/json"

    gen_config = genai.GenerationConfig(**kwargs)
    response = model.generate_content(prompt, generation_config=gen_config)
    if not response or not response.text:
        raise ValueError("Empty response from Gemini API.")
    return response.text.strip()


def parse_json_robust(raw_json: str):
    """Robustly parse JSON output from LLM, auto-repairing truncated strings or markdown blocks."""
    import re
    text = raw_json.strip()

    if "```" in text:
        match = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL)
        if match:
            text = match.group(1).strip()

    parsed = None
    try:
        parsed = json.loads(text)
    except Exception:
        cleaned = re.sub(r",\s*([\]\}])", r"\1", text)
        try:
            parsed = json.loads(cleaned)
        except Exception:
            arr_match = re.search(r"(\[.*)", text, re.DOTALL)
            if arr_match:
                arr_str = arr_match.group(1).strip()
                last_obj_idx = arr_str.rfind("}")
                if last_obj_idx != -1:
                    repaired = arr_str[:last_obj_idx + 1] + "]"
                    repaired = re.sub(r",\s*\]", "]", repaired)
                    try:
                        parsed = json.loads(repaired)
                    except Exception:
                        pass

            if parsed is None:
                obj_match = re.search(r"(\{.*)", text, re.DOTALL)
                if obj_match:
                    obj_str = obj_match.group(1).strip()
                    last_brace = obj_str.rfind("}")
                    if last_brace != -1:
                        repaired = obj_str[:last_brace + 1]
                        try:
                            parsed = json.loads(repaired)
                        except Exception:
                            pass

    if parsed is not None:
        if isinstance(parsed, dict):
            if "university" in parsed or "examination" in parsed or "solutions" in parsed:
                return parsed
            for k in ("questions", "flashcards", "cards", "items", "data"):
                if k in parsed and isinstance(parsed[k], list):
                    return parsed[k]
        return parsed

    raise ValueError("Failed to parse valid JSON from AI output.")


def _call_groq(prompt: str, response_json: bool = False, api_key: Optional[str] = None) -> str:
    """Call Groq Cloud API (Ultra-fast LPU inference)."""
    key = api_key or settings.GROQ_API_KEY
    if not key:
        raise ValueError("GROQ_API_KEY is not set.")

    groq_url = "https://api.groq.com/openai/v1/chat/completions"
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.75,
        "max_tokens": 8192,
    }
    if response_json:
        payload["response_format"] = {"type": "json_object"}

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        groq_url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {key}",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) cappy.ai/1.0",
        },
    )

    with urllib.request.urlopen(req, timeout=30) as response:
        res_json = json.loads(response.read().decode("utf-8"))
        choices = res_json.get("choices", [])
        if choices and "message" in choices[0]:
            return choices[0]["message"].get("content", "").strip()
        raise ValueError("Invalid response format from Groq API.")


def _call_ollama(prompt: str, response_json: bool = False) -> str:
    """Call local Ollama server."""
    ollama_url = "http://localhost:11434/api/generate"
    payload = {
        "model": "llama3.2:3b",
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.75,
            "top_k": 40,
            "top_p": 0.9,
            "num_ctx": 2048,
            "num_predict": 850,
        },
    }
    if response_json:
        payload["format"] = "json"

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        ollama_url,
        data=data,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=120) as response:
        res_json = json.loads(response.read().decode("utf-8"))
        return res_json.get("response", "").strip()


def _generate_text(prompt: str, response_json: bool = False) -> str:
    """
    Hybrid text generation with automatic multi-key and provider fallback:
    1. Primary: Groq API Key 1
    2. Secondary: Groq API Key 2
    3. Tertiary: Gemini API Key 1
    4. Quaternary: Gemini API Key 2
    5. Local: Ollama
    """
    errors = []

    # 1. Try Primary Groq API Key
    if settings.GROQ_API_KEY:
        try:
            return _call_groq(prompt, response_json=response_json, api_key=settings.GROQ_API_KEY)
        except Exception as e:
            msg = f"Primary Groq API failed: {e}."
            logger.warning(msg)
            print(f"[AI Fallback] {msg}")
            errors.append(f"Groq Key 1: {e}")

    # 2. Try Secondary Groq API Key if configured
    if settings.GROQ_API_KEY_2:
        try:
            return _call_groq(prompt, response_json=response_json, api_key=settings.GROQ_API_KEY_2)
        except Exception as e:
            msg = f"Secondary Groq API failed: {e}."
            logger.warning(msg)
            print(f"[AI Fallback] {msg}")
            errors.append(f"Groq Key 2: {e}")

    # 3. Try Primary Gemini API Key
    if settings.GEMINI_API_KEY:
        try:
            return _call_gemini(prompt, response_json=response_json, api_key=settings.GEMINI_API_KEY)
        except Exception as e:
            msg = f"Primary Gemini API failed: {e}."
            logger.warning(msg)
            print(f"[AI Fallback] {msg}")
            errors.append(f"Gemini Key 1: {e}")

    # 4. Try Secondary Gemini API Key if configured
    if settings.GEMINI_API_KEY_2:
        try:
            return _call_gemini(prompt, response_json=response_json, api_key=settings.GEMINI_API_KEY_2)
        except Exception as e:
            msg = f"Secondary Gemini API failed: {e}."
            logger.warning(msg)
            print(f"[AI Fallback] {msg}")
            errors.append(f"Gemini Key 2: {e}")

    # 5. Fall back to Local Ollama
    try:
        return _call_ollama(prompt, response_json=response_json)
    except Exception as e:
        errors.append(f"Ollama: {e}")

    error_summary = " | ".join(errors)
    raise RuntimeError(
        f"All AI generation providers failed. ({error_summary}). "
        "Please check your GROQ_API_KEY/GEMINI_API_KEY environment variables or start Ollama locally."
    )


def _build_context(chunks: List[Dict]) -> str:
    """Format retrieved chunks into a numbered context block."""
    if not chunks:
        return ""
    parts = []
    for i, chunk in enumerate(chunks, 1):
        parts.append(
            f"[Source {i}] Document: '{chunk['document_name']}' | Page {chunk['page']}\n"
            f"{chunk['text']}"
        )
    return "\n\n---\n\n".join(parts)


SYSTEM_PROMPT = """You are cappy.ai, an AI learning assistant. Your ONLY job is to answer questions using the provided document excerpts below.

STRICT RULES:
1. Answer ONLY based on the provided context. Do NOT use any outside knowledge.
2. If the answer is not in the context, respond exactly: "I couldn't find this information in your uploaded documents."
3. Always cite your sources using [Source N] notation.
4. Be clear, concise, and helpful for a student audience.
5. Format your answer in clean Markdown.

CONTEXT FROM UPLOADED DOCUMENTS:
{context}

---
"""


def generate_answer(question: str, chunks: List[Dict]) -> Dict:
    """
    Generate a RAG answer grounded in retrieved chunks.
    Returns:
        {"answer": str, "sources": List[Dict]}
    """
    if not chunks:
        return {
            "answer": "I couldn't find this information in your uploaded documents.",
            "sources": [],
        }

    context = _build_context(chunks)
    prompt = SYSTEM_PROMPT.format(context=context) + f"\nQuestion: {question}\n\nAnswer:"

    answer = _generate_text(prompt, response_json=False)

    # Build deduplicated source list
    seen = set()
    sources = []
    for chunk in chunks:
        key = (chunk["document_id"], chunk["page"])
        if key not in seen:
            seen.add(key)
            sources.append({
                "document_id": chunk["document_id"],
                "document_name": chunk["document_name"],
                "page": chunk["page"],
                "score": chunk.get("score", 0),
            })

    return {"answer": answer, "sources": sources}


def generate_summary(text: str, mode: str = "short", topic: Optional[str] = None) -> str:
    """
    Generate a summary in one of three modes, optionally focused on a topic.
    mode: "short" | "detailed" | "bullets"
    """
    mode_instructions = {
        "short": "Write a thorough, well-structured summary of approximately 350 to 550 words covering all essential core concepts, background, and main findings.",
        "detailed": "Write an extensive, highly detailed, in-depth academic summary of approximately 800 to 1200 words. Explain all definitions, core principles, sub-topics, algorithms/protocols, real-world examples, and conclusions in complete technical detail.",
        "bullets": "Write an exhaustive, highly structured bullet-point summary breakdown (700 to 1000 words) with clear section headers, bold terminology, sub-bullet explanations, and detailed key takeaways.",
    }
    instruction = mode_instructions.get(mode, mode_instructions["short"])
    if topic and topic.strip():
        instruction = f"{instruction} Specifically focus on and emphasize all concepts, principles, and instances related to '{topic.strip()}'."

    prompt = f"""You are an expert academic summarizer. {instruction}

Only use information from the provided text. Do NOT add external knowledge. Provide a comprehensive, full-length response.

TEXT:
{text[:12000]}

SUMMARY:"""

    return _generate_text(prompt, response_json=False)


def generate_quiz(text: str, quiz_type: str = "mcq", num_questions: int = 5) -> str:
    """
    Generate quiz questions from document text.
    quiz_type: "mcq" | "true_false" | "long_answer" | "short_answer"
    """
    type_instructions = {
        "mcq": f"Generate {num_questions} multiple-choice questions (MCQ) with 4 options (A, B, C, D) and mark the correct answer. Format as JSON array.",
        "true_false": f"Generate {num_questions} True/False statements with answers. Format as JSON array.",
        "long_answer": f"Generate {num_questions} long-answer descriptive questions with comprehensive model answers (around 100-150 words each). Format as JSON array.",
        "short_answer": f"Generate {num_questions} short-answer questions with concise model answers. Format as JSON array.",
    }
    base_instruction = type_instructions.get(quiz_type, type_instructions["mcq"])
    import random
    seed = random.randint(1000, 999999)
    instruction = f"{base_instruction} (Variation Seed #{seed}: Generate fresh, unique questions covering different concepts and subtopics than previous runs)."

    json_format = {
        "mcq": '{"questions": [{"question": "...", "options": {"A": "...", "B": "...", "C": "...", "D": "..."}, "answer": "A", "explanation": "..."}]}',
        "true_false": '{"questions": [{"statement": "...", "answer": true, "explanation": "..."}]}',
        "long_answer": '{"questions": [{"question": "...", "answer": "Detailed model answer containing approximately 100 to 150 words explaining the concept thoroughly...", "key_points": ["Point 1", "Point 2"]}]}',
        "short_answer": '{"questions": [{"question": "...", "answer": "...", "key_points": ["...", "..."]}]}',
    }

    prompt = f"""You are an expert educator creating exam questions. {instruction}

Return a valid JSON object with a root key "questions" containing an array of {num_questions} questions.

JSON FORMAT:
{json_format.get(quiz_type, json_format["mcq"])}

TEXT:
{text[:3500]}

JSON OUTPUT:"""

    return _generate_text(prompt, response_json=True)


def generate_sample_paper(
    text: str,
    subject_code: str = "3160716",
    subject_name: str = "IOT and Applications",
    exam_term: str = "SUMMER 2024",
    total_marks: int = 70,
    university_name: str = "UNIVERSITY EXAMINATION",
) -> str:
    """
    Generate a formal university-style examination sample paper.
    """
    import random
    seed = random.randint(1000, 999999)
    prompt = f"""You are an expert university examiner.
Generate a fresh, unique, and realistic sample examination question paper based strictly on the provided study notes.
VARIATION SEED #{seed}: Focus on different topics, subtopics, and phrasing than previous papers.

PAPER METADATA:
University Name: {university_name}
Subject Code: {subject_code}
Subject Name: {subject_name}
Exam Term: {exam_term}
Total Marks: {total_marks}

QUESTION & MARKING STRUCTURE:
- Q.1:
  - (a) [3 Marks]
  - (b) [4 Marks]
  - (c) [7 Marks]
  (No OR option for Q.1)

- Q.2:
  - (a) [3 Marks], (b) [4 Marks], (c) [7 Marks]
  - OR choice ONLY for sub-question (c):
    - (c) [7 Marks]

- Q.3:
  - (a) [3 Marks], (b) [4 Marks], (c) [7 Marks]
  - OR full question choice:
    - (a) [3 Marks], (b) [4 Marks], (c) [7 Marks]

- Q.4:
  - (a) [3 Marks], (b) [4 Marks], (c) [7 Marks]
  - OR full question choice:
    - (a) [3 Marks], (b) [4 Marks], (c) [7 Marks]

- Q.5:
  - (a) [3 Marks], (b) [4 Marks], (c) [7 Marks]
  - OR full question choice:
    - (a) [3 Marks], (b) [4 Marks], (c) [7 Marks]

Return ONLY valid JSON matching this schema:
{{
  "university": "{university_name}",
  "examination": "SEMESTER EXAMINATION - {exam_term}",
  "subject_code": "{subject_code}",
  "subject_name": "{subject_name}",
  "total_marks": {total_marks},
  "time_allowed": "02:30 Hours",
  "instructions": [
    "Attempt all questions.",
    "Make suitable assumptions wherever necessary.",
    "Figures to the right indicate full marks.",
    "Simple and non-programmable scientific calculators are allowed."
  ],
  "questions": [
    {{
      "q_no": "Q.1",
      "items": [
        {{"part": "(a)", "question": "...", "marks": 3}},
        {{"part": "(b)", "question": "...", "marks": 4}},
        {{"part": "(c)", "question": "...", "marks": 7}}
      ],
      "or_items": []
    }},
    {{
      "q_no": "Q.2",
      "items": [
        {{"part": "(a)", "question": "...", "marks": 3}},
        {{"part": "(b)", "question": "...", "marks": 4}},
        {{"part": "(c)", "question": "...", "marks": 7}}
      ],
      "or_items": [
        {{"part": "(c)", "question": "...", "marks": 7}}
      ]
    }},
    {{
      "q_no": "Q.3",
      "items": [
        {{"part": "(a)", "question": "...", "marks": 3}},
        {{"part": "(b)", "question": "...", "marks": 4}},
        {{"part": "(c)", "question": "...", "marks": 7}}
      ],
      "or_items": [
        {{"part": "(a)", "question": "...", "marks": 3}},
        {{"part": "(b)", "question": "...", "marks": 4}},
        {{"part": "(c)", "question": "...", "marks": 7}}
      ]
    }},
    {{
      "q_no": "Q.4",
      "items": [
        {{"part": "(a)", "question": "...", "marks": 3}},
        {{"part": "(b)", "question": "...", "marks": 4}},
        {{"part": "(c)", "question": "...", "marks": 7}}
      ],
      "or_items": [
        {{"part": "(a)", "question": "...", "marks": 3}},
        {{"part": "(b)", "question": "...", "marks": 4}},
        {{"part": "(c)", "question": "...", "marks": 7}}
      ]
    }},
    {{
      "q_no": "Q.5",
      "items": [
        {{"part": "(a)", "question": "...", "marks": 3}},
        {{"part": "(b)", "question": "...", "marks": 4}},
        {{"part": "(c)", "question": "...", "marks": 7}}
      ],
      "or_items": [
        {{"part": "(a)", "question": "...", "marks": 3}},
        {{"part": "(b)", "question": "...", "marks": 4}},
        {{"part": "(c)", "question": "...", "marks": 7}}
      ]
    }}
  ]
}}

TEXT FROM STUDY NOTES:
{text[:2200]}

JSON OUTPUT:"""

    return _generate_text(prompt, response_json=True)


def generate_flashcards(text: str, num_cards: int = 10) -> str:
    """Generate question-answer flashcards from document text. Returns JSON."""
    import random
    seed = random.randint(1000, 999999)
    prompt = f"""You are a study assistant creating flashcards. Generate {num_cards} unique flashcards from the text below.
VARIATION SEED #{seed}: Focus on different terms, definitions, and key facts than previous runs.

Return a valid JSON object with a root key "flashcards" containing an array of {num_cards} flashcards:
{{"flashcards": [{{"front": "Question or term", "back": "Answer or definition", "category": "topic name"}}]}}

Use ONLY information from the provided text.

TEXT:
{text[:3500]}

JSON OUTPUT:"""

    return _generate_text(prompt, response_json=True)


def explain_concept(concept: str, context: str, level: str = "intermediate") -> str:
    """
    Explain a concept at a given difficulty level.
    """
    level_instructions = {
        "beginner": "Explain as if to a curious 14-year-old with no prior knowledge. Use simple words, analogies, and examples.",
        "intermediate": "Explain to a college student familiar with the basics. Use correct terminology and practical examples.",
        "advanced": "Explain to a graduate-level student. Be technically precise, cover nuances, and relate to broader concepts.",
    }
    instruction = level_instructions.get(level, level_instructions["intermediate"])

    prompt = f"""You are an expert tutor. {instruction}

Base your explanation ONLY on the provided context from the student's documents.

CONTEXT:
{context[:3000]}

CONCEPT TO EXPLAIN: {concept}

EXPLANATION:"""

    return _generate_text(prompt, response_json=False)


def solve_question_paper(
    paper_text: str,
    context: str,
    subject_name: str = "Subject",
) -> str:
    """
    Generate step-by-step model solutions for an uploaded question paper grounded in study materials.
    Returns raw Markdown.
    """
    prompt = f"""You are a master university professor and exam evaluator for '{subject_name}'.
Your task is to provide complete, thorough, step-by-step solutions for every question in the question paper below.

STRICT INSTRUCTIONS:
1. Answer every question and subquestion clearly and accurately.
2. Base explanations on the study context provided below wherever possible.
3. For numerical or code/diagram questions, provide clear explanations or pseudocode.
4. The length of the answer MUST be strictly according to the marks of the questions. For a 3 or 4 marks question, write a concise answer. For a 7+ marks question, write an extensive and highly detailed answer with deep explanations.
5. Format your entire output in clean, structured Markdown. Use appropriate headings for questions (e.g. ### Q.1 (a)).

STUDY CONTEXT FROM NOTES:
{context[:8000]}

QUESTION PAPER TO SOLVE:
{paper_text[:8000]}

MARKDOWN OUTPUT:"""

    return _generate_text(prompt, response_json=False)
