# cappy.ai

cappy.ai is a Retrieval-Augmented Generation (RAG) platform for study materials. It processes PDF notes, generates vector embeddings, and enables AI-assisted learning through document summaries, adaptive MCQs, 3D flashcards, semantic search, and university exam papers with step-by-step solutions.

---

## Key Features

- **Document Management**: Drag-and-drop PDF ingestion, text extraction, page parsing, and category organization.
- **RAG Summaries**: Grounded note summarization with customizable lengths and focus topics.
- **Quiz & Flashcards**: Adaptive multiple-choice quizzes with explanations and interactive 3D flashcards.
- **Exam Paper & Solver**: Generates 70-mark university question papers and step-by-step solutions with direct PDF export.
- **Semantic Search**: Vector similarity search over indexed study materials with exact source citations.

---

## Tech Stack

- **Frontend**: React 18, Vite, React Router v6, Tailwind CSS v3, Framer Motion, Lucide React, html2pdf.js, Axios.
- **Backend**: Python 3.10+, FastAPI, SQLite, SQLAlchemy, ChromaDB, PyPDF2, pdfplumber.
- **LLM Engine**: Groq Cloud (`llama-3.3-70b-versatile`) with Gemini API (`gemini-1.5-flash`) and local Ollama fallbacks.

---

## Repository Structure

```text
cappy.ai/
├── backend/
│   ├── app.py          # FastAPI entry point & CORS configuration
│   ├── config.py       # Application settings & environment configuration
│   ├── database.py     # SQLite engine & database session manager
│   ├── models/         # ORM models (User, Document)
│   ├── rag/            # Embeddings, vector store & RAG generation logic
│   ├── routes/         # API routes (Auth, Documents, Summary, Quiz, Sample Paper, Search, Users)
│   ├── services/       # PDF parsing & text chunking services
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── App.jsx     # Application routing
│       ├── components/ # Navbar, DocumentCard, FileUpload, Category selector
│       ├── pages/      # Dashboard, Summary, Quiz, SamplePaper, Search, Settings
│       └── services/   # Axios API client modules
```

---

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+

### Setup & Launch

1. **Clone Repository**:
   ```bash
   git clone https://github.com/yakshh/cappy.ai.git
   cd cappy.ai
   ```

2. **Backend Setup**:
   ```bash
   cd backend
   python -m venv venv
   .\venv\Scripts\activate
   pip install -r requirements.txt
   ```

   Create a `.env` file in `backend/`:
   ```env
   APP_NAME="cappy.ai"
   SECRET_KEY="your-secret-key"
   GROQ_API_KEY="your-groq-api-key"
   GEMINI_API_KEY="your-gemini-api-key"
   ```

   For Vercel, set `DATABASE_URL` to a hosted PostgreSQL connection string in
   the project environment variables. Vercel serverless storage is temporary,
   so the local SQLite fallback is only suitable for development.

   Start server:
   ```bash
   uvicorn app:app --host 0.0.0.0 --port 8000 --reload
   ```

3. **Frontend Setup**:
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```

---

## API Routes Summary

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/auth/register` | `POST` | User registration |
| `/api/auth/login` | `POST` | User login & JWT token issuance |
| `/api/documents/upload` | `POST` | PDF document upload & indexing |
| `/api/documents/` | `GET` | List user documents & category tags |
| `/api/documents/{id}` | `DELETE` | Delete document & vector embeddings |
| `/api/documents/{id}/category` | `PATCH` | Update document subject category |
| `/api/summary/` | `POST` | Generate RAG summary |
| `/api/quiz/` | `POST` | Generate quiz or 3D flashcards |
| `/api/sample-paper/` | `POST` | Generate 70-mark university question paper |
| `/api/sample-paper/solve` | `POST` | Generate step-by-step paper solutions |
| `/api/search/` | `POST` | Perform semantic vector search |
| `/api/users/me` | `PATCH` | Update user profile details |
