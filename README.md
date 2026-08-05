# cappy.ai

cappy.ai is an intelligent Retrieval-Augmented Generation (RAG) platform for study materials. It processes PDF notes, generates embeddings, and enables AI-assisted learning through document summaries, adaptive MCQs, 3D flashcards, semantic search, and university exam papers with step-by-step model solutions.

---

## Key Features

- **Document Management**: Drag-and-drop PDF ingestion, chunked upload for serverless environments, text extraction, and category organization.
- **RAG Summaries**: Grounded note summarization with customizable styles (Overview, Detailed, Bullets) and focus topics, with direct `.txt` export.
- **Quiz & Flashcards**: Adaptive multiple-choice quizzes with explanations, interactive 3D flashcards, and instant `.txt` export.
- **Exam Paper & Solver**: Generates 70-mark university question papers and step-by-step solutions with direct PDF export.
- **Semantic Search**: Vector similarity search over indexed study materials with accurate match relevance scoring and source citations.
- **User Profiles & Custom Themes**: Customizable field/department selection, dark mode aesthetics, and color themes.

---

## Tech Stack

- **Frontend**: React 18, Vite, React Router v6, Vanilla CSS / Tailwind CSS v3, Framer Motion, Lucide React, html2pdf.js, Axios.
- **Backend**: Python 3.10+, FastAPI, PostgreSQL (Neon) / SQLite, SQLAlchemy, ChromaDB, PyPDF2, pdfplumber.
- **LLM Engine**: Multi-provider fallback chain (Groq Cloud `llama-3.3-70b-versatile` & Google Gemini `gemini-1.5-flash`).

---

## Repository Structure

```text
cappy.ai/
├── api/
│   └── index.py        # Vercel serverless entry point
├── backend/
│   ├── app.py          # FastAPI entry point & CORS configuration
│   ├── auth.py         # JWT authentication & password hashing
│   ├── config.py       # Application settings & environment variables
│   ├── database.py     # Database session manager & dynamic schema migrations
│   ├── models/         # SQLAlchemy ORM models (User, Document, DocumentChunk, Conversation)
│   ├── rag/            # Vector store, hybrid relevance search & RAG generation logic
│   ├── routes/         # API routes (Auth, Documents, Summary, Quiz, Sample Paper, Search, Users)
│   ├── services/       # PDF parsing & text chunking services
│   └── requirements.txt
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx     # Application routing
│       ├── components/ # Navbar, Sidebar, DocumentCard, FileUpload, Category selector
│       ├── pages/      # Dashboard, Summary, Quiz, SamplePaper, Search, Settings, Login, Register
│       └── services/   # Axios API client modules
└── vercel.json         # Vercel serverless routing configuration
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
   DATABASE_URL="postgresql://user:pass@ep-host.neon.tech/neondb?sslmode=require"
   GROQ_API_KEY="your-primary-groq-key"
   GROQ_API_KEY_2="your-fallback-groq-key"
   GEMINI_API_KEY="your-primary-gemini-key"
   GEMINI_API_KEY_2="your-fallback-gemini-key"
   ```

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
| `/api/documents/upload-chunk` | `POST` | Chunked upload for large PDF files |
| `/api/documents/` | `GET` | List user documents & categories |
| `/api/documents/{id}` | `DELETE` | Delete document & associated chunks |
| `/api/documents/{id}/category` | `PATCH` | Update document subject category |
| `/api/summary/` | `POST` | Generate RAG summary |
| `/api/quiz/` | `POST` | Generate quiz or 3D flashcards |
| `/api/sample-paper/` | `POST` | Generate 70-mark university question paper |
| `/api/sample-paper/solve-upload` | `POST` | Solve uploaded exam paper & generate model solutions |
| `/api/search/` | `POST` | Perform semantic & hybrid relevance search |
| `/api/users/me` | `GET / PATCH` | Manage user profile and stream details |
