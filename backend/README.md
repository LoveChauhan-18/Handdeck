# HandDeck Backend (FastAPI)

A lightweight, production-ready Python FastAPI service that generates topic-based study flashcards (`/cards`) and evaluates voice answers (`/evaluate`) using LLM APIs.

---

## Features

- **`GET /health`**: Health check reporting API status and configured LLMs.
- **`POST /cards`**: Generates `count` structured study flashcards for any `topic` (Biology, Physics, Space, History, Python, etc.) with JSON schema validation.
- **`POST /evaluate`**: Analyzes a student's answer against the target key concept and returns `{verdict: "correct" | "partial" | "wrong", feedback: "..."}`.
- **Multi-LLM Support**: Supports Google Gemini, OpenAI, or Groq via `.env`.
- **Zero-Crash Fallback**: If no API key is provided or the LLM is unreachable, returns high-quality curated study decks and deterministic semantic evaluation so demos never break.
- **Production Safeguards**: CORS enabled, 1MB request body limit, and in-memory rate limiting (60 requests/minute/IP).

---

## Local Setup

### 1. Prerequisites
- Python 3.10+ (tested on Python 3.11)

### 2. Install Dependencies
```bash
cd backend
python -m venv venv

# Windows:
venv\Scripts\activate

# macOS / Linux:
source venv/bin/activate

pip install -r requirements.txt
```

### 3. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
*(Optional)* Add your Gemini, OpenAI, or Groq API key in `.env`:
```env
GEMINI_API_KEY=your_api_key_here
PORT=8000
```
> **Note:** If no key is set, the server runs with built-in educational decks and evaluation fallbacks.

### 4. Run the Server
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
Test with curl or open in browser:
- Health check: `http://localhost:8000/health`
- Interactive Swagger docs: `http://localhost:8000/docs`

---

## Deployment

### Deploy to Render
1. Create a **New Web Service** connected to your GitHub repository.
2. Set **Root Directory** to `backend`.
3. Set **Runtime** to `Python 3`.
4. Set **Build Command**:
   ```bash
   pip install -r requirements.txt
   ```
5. Set **Start Command**:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
6. Under **Environment Variables**, add `GEMINI_API_KEY` (or `OPENAI_API_KEY`).
7. Once deployed, copy your Render URL (e.g. `https://handdeck-api.onrender.com`) and configure it in the frontend.

### Deploy to Railway
1. Click **New Project** $\rightarrow$ **Deploy from GitHub Repo**.
2. Set the root directory to `/backend`.
3. Railway detects `requirements.txt` automatically.
4. Set the Start Command:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
   ```
5. Add `GEMINI_API_KEY` in Railway's Variables tab.

