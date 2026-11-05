"""
HandDeck - Python FastAPI Backend (Milestone 4)
Provides flashcard generation (/cards) and answer evaluation (/evaluate) using LLM APIs
with rate limiting, request size limits, CORS, and robust fallbacks.
"""

import os
import json
import time
from typing import Literal, List, Dict
from collections import defaultdict

from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import httpx
from dotenv import load_dotenv

# Load .env file
load_dotenv()

app = FastAPI(
    title="HandDeck VR Study Buddy API",
    description="Backend service for generating flashcards and evaluating voice answers in VR.",
    version="1.0.0",
)

# Configuration from environment
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()

MAX_REQUEST_BYTES = int(os.getenv("MAX_REQUEST_BYTES", "1048576")) # 1 MB cap
RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))

# CORS allowed origins — read from env so the same image works locally and in prod.
# Examples:
#   ALLOWED_ORIGINS=*                                (dev / open)
#   ALLOWED_ORIGINS=https://lovechauhan-18.github.io (production)
#   ALLOWED_ORIGINS=https://lovechauhan-18.github.io,http://localhost:5173 (both)
_raw_origins = os.getenv("ALLOWED_ORIGINS", "*").strip()
ALLOWED_ORIGINS: list[str] = (
    ["*"] if _raw_origins == "*"
    else [o.strip() for o in _raw_origins.split(",") if o.strip()]
)

# In-memory sliding window rate limiter
ip_requests: Dict[str, List[float]] = defaultdict(list)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=ALLOWED_ORIGINS != ["*"],  # credentials require explicit origins
    allow_methods=["*"],
    allow_headers=["*"],
)


# Rate Limiting & Request Size Cap Middleware
@app.middleware("http")
async def security_middleware(request: Request, call_next):
    # 1. Request size limit
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_REQUEST_BYTES:
        return Response(
            content=json.dumps({"detail": "Request body too large. Max 1MB allowed."}),
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            media_type="application/json",
        )

    # 2. Rate limiting per client IP
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    window_start = now - 60.0

    # Prune old timestamps
    ip_requests[client_ip] = [t for t in ip_requests[client_ip] if t > window_start]

    if len(ip_requests[client_ip]) >= RATE_LIMIT_PER_MINUTE:
        return Response(
            content=json.dumps({"detail": "Rate limit exceeded (max 60 requests/min). Please try again soon."}),
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            media_type="application/json",
        )

    ip_requests[client_ip].append(now)

    response = await call_next(request)
    return response


# Data Models
class Flashcard(BaseModel):
    id: int
    category: str
    title: str
    question: str
    key_concept: str


class GenerateCardsRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=100)
    count: int = Field(default=5, ge=1, le=10)


class EvaluateRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=500)
    key_concept: str = Field(..., min_length=1, max_length=500)
    user_answer: str = Field(..., min_length=1, max_length=500)


class EvaluateResponse(BaseModel):
    verdict: Literal["correct", "partial", "wrong"]
    feedback: str


# Curated Fallback Decks (Used if LLM is offline or no API key is provided)
FALLBACK_DECKS: Dict[str, List[Dict]] = {
    "biology": [
        {
            "id": 1,
            "category": "BIOLOGY",
            "title": "Cell Energy",
            "question": "What is the primary function of Mitochondria in a cell?",
            "key_concept": "Generates ATP through cellular respiration to power the cell.",
        },
        {
            "id": 2,
            "category": "BIOLOGY",
            "title": "Photosynthesis",
            "question": "Which organelle absorbs sunlight to synthesize glucose in plants?",
            "key_concept": "Chloroplasts contain chlorophyll that captures solar energy.",
        },
        {
            "id": 3,
            "category": "BIOLOGY",
            "title": "DNA Structure",
            "question": "Which nitrogenous bases pair together in a double helix?",
            "key_concept": "Adenine pairs with Thymine (A-T), and Cytosine pairs with Guanine (C-G).",
        },
        {
            "id": 4,
            "category": "BIOLOGY",
            "title": "Ribosomes",
            "question": "What fundamental biological process takes place at the ribosome?",
            "key_concept": "Protein synthesis by translating messenger RNA codons.",
        },
        {
            "id": 5,
            "category": "BIOLOGY",
            "title": "Cell Membrane",
            "question": "What structural model describes the flexible lipid bilayer of a cell?",
            "key_concept": "The Fluid Mosaic Model of phospholipids and embedded proteins.",
        },
    ],
    "physics": [
        {
            "id": 1,
            "category": "PHYSICS",
            "title": "Newton's 1st Law",
            "question": "What happens to an object when the net external force acting on it is zero?",
            "key_concept": "It remains at rest or maintains constant velocity in a straight line.",
        },
        {
            "id": 2,
            "category": "PHYSICS",
            "title": "Speed of Light",
            "question": "What is the universal constant speed of light in a vacuum?",
            "key_concept": "Approximately 300,000 km/s (3 x 10^8 m/s), denoted as c.",
        },
        {
            "id": 3,
            "category": "PHYSICS",
            "title": "Conservation of Energy",
            "question": "What does the first law of thermodynamics state about total energy?",
            "key_concept": "Energy cannot be created or destroyed, only transformed from one form to another.",
        },
        {
            "id": 4,
            "category": "PHYSICS",
            "title": "Gravity",
            "question": "How does gravitational attraction change when the distance between masses doubles?",
            "key_concept": "Inverse-square law: the gravitational force decreases to one-fourth (1/4).",
        },
        {
            "id": 5,
            "category": "PHYSICS",
            "title": "Electromagnetism",
            "question": "What force governs the interaction between electrically charged particles?",
            "key_concept": "Coulomb's electrostatic force and Maxwell's electromagnetic fields.",
        },
    ],
    "space": [
        {
            "id": 1,
            "category": "SPACE",
            "title": "Event Horizon",
            "question": "What boundary marks the point of no return around a black hole?",
            "key_concept": "The Event Horizon, where escape velocity exceeds the speed of light.",
        },
        {
            "id": 2,
            "category": "SPACE",
            "title": "Nuclear Fusion",
            "question": "What nuclear reaction powers the core of our Sun and main-sequence stars?",
            "key_concept": "Hydrogen nuclei fuse into Helium under extreme heat and gravitational pressure.",
        },
        {
            "id": 3,
            "category": "SPACE",
            "title": "Exoplanets",
            "question": "What is an exoplanet and what defines its habitable zone?",
            "key_concept": "A planet orbiting another star where liquid water can exist on the surface.",
        },
        {
            "id": 4,
            "category": "SPACE",
            "title": "Cosmic Expansion",
            "question": "What observation revealed that distant galaxies are moving away from each other?",
            "key_concept": "Hubble's Law and the cosmological redshift of spectral light.",
        },
        {
            "id": 5,
            "category": "SPACE",
            "title": "Dark Matter",
            "question": "What invisible cosmic component accounts for most of the mass in galaxies?",
            "key_concept": "Dark matter, detected only through its gravitational pull on visible matter.",
        },
    ],
    "history": [
        {
            "id": 1,
            "category": "HISTORY",
            "title": "Agricultural Revolution",
            "question": "What transition shifted human society from nomadic foraging to permanent settlements?",
            "key_concept": "The Neolithic Agricultural Revolution around 10,000 BCE.",
        },
        {
            "id": 2,
            "category": "HISTORY",
            "title": "Printing Press",
            "question": "Whose invention revolutionized literacy and information sharing in 1440s Europe?",
            "key_concept": "Johannes Gutenberg's movable-type printing press.",
        },
        {
            "id": 3,
            "category": "HISTORY",
            "title": "Industrial Revolution",
            "question": "Which power source sparked mechanized manufacturing and transportation in the 18th century?",
            "key_concept": "James Watt's steam engine powered by coal combustion.",
        },
        {
            "id": 4,
            "category": "HISTORY",
            "title": "Silk Road",
            "question": "What ancient trade network connected Eurasia for commerce and cultural exchange?",
            "key_concept": "The Silk Road network linking China, Central Asia, and the Mediterranean.",
        },
        {
            "id": 5,
            "category": "HISTORY",
            "title": "Scientific Revolution",
            "question": "What paradigm shift replaced geocentric views with evidence-based astronomy?",
            "key_concept": "The Copernican heliocentric model advanced by Galileo, Kepler, and Newton.",
        },
    ],
    "python": [
        {
            "id": 1,
            "category": "PYTHON",
            "title": "Mutable vs Immutable",
            "question": "In Python, which built-in sequence type is immutable: list or tuple?",
            "key_concept": "Tuples are immutable; lists are mutable and can be modified in place.",
        },
        {
            "id": 2,
            "category": "PYTHON",
            "title": "List Comprehensions",
            "question": "What concise syntax creates a transformed list in a single readable line?",
            "key_concept": "[expression for item in iterable if condition].",
        },
        {
            "id": 3,
            "category": "PYTHON",
            "title": "Dictionaries",
            "question": "What average time complexity does key lookup have in a Python dict?",
            "key_concept": "O(1) constant time, implemented using hash tables.",
        },
        {
            "id": 4,
            "category": "PYTHON",
            "title": "Generators & Yield",
            "question": "What keyword turns a standard function into a memory-efficient generator?",
            "key_concept": "yield produces values lazily one at a time on demand.",
        },
        {
            "id": 5,
            "category": "PYTHON",
            "title": "Virtual Environments",
            "question": "Why do Python developers use virtual environments like venv?",
            "key_concept": "To isolate project package dependencies and avoid version conflicts.",
        },
    ],
}


# Health Check Endpoint
@app.get("/health")
def health_check():
    has_llm = bool(GEMINI_API_KEY or OPENAI_API_KEY or GROQ_API_KEY)
    return {
        "status": "ok",
        "service": "HandDeck VR Study Buddy Backend",
        "version": "1.0.0",
        "llm_configured": has_llm,
        "available_topics": list(FALLBACK_DECKS.keys()),
    }


# Helper: Generate Cards with LLM
async def generate_cards_with_llm(topic: str, count: int) -> List[Flashcard]:
    prompt = f"""
    Create exactly {count} engaging study flashcards about the topic: "{topic}".
    Return ONLY a raw JSON array matching this exact schema:
    [
      {{
        "id": 1,
        "category": "{topic.upper()}",
        "title": "Short 2-3 word concept title",
        "question": "Clear, engaging single-sentence study question",
        "key_concept": "Concise 1-2 sentence core answer explaining the key concept"
      }}
    ]
    Do not include markdown backticks or commentary. Only output the JSON array.
    """

    # 1. Try Gemini API if key is present
    if GEMINI_API_KEY:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.4, "maxOutputTokens": 1000},
            }
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    raw_text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                    if raw_text.startswith("```"):
                        raw_text = raw_text.split("```")[1]
                        if raw_text.startswith("json"):
                            raw_text = raw_text[4:]
                    raw_cards = json.loads(raw_text.strip())
                    cards = [Flashcard(**c) for c in raw_cards[:count]]
                    return cards
        except Exception as e:
            print(f"[Gemini API Error] Falling back: {e}")

    # 2. Try OpenAI API if key is present
    if OPENAI_API_KEY:
        try:
            url = "https://api.openai.com/v1/chat/completions"
            headers = {"Authorization": f"Bearer {OPENAI_API_KEY}"}
            payload = {
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": "You are a concise educational flashcard creator. Always return raw JSON."},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.3,
            }
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.post(url, headers=headers, json=payload)
                if res.status_code == 200:
                    raw_text = res.json()["choices"][0]["message"]["content"].strip()
                    if raw_text.startswith("```"):
                        raw_text = raw_text.split("```")[1]
                        if raw_text.startswith("json"):
                            raw_text = raw_text[4:]
                    raw_cards = json.loads(raw_text.strip())
                    cards = [Flashcard(**c) for c in raw_cards[:count]]
                    return cards
        except Exception as e:
            print(f"[OpenAI API Error] Falling back: {e}")

    # 3. Fallback to curated topic decks
    clean_topic = topic.lower().strip()
    matched_key = None
    for k in FALLBACK_DECKS:
        if k in clean_topic or clean_topic in k:
            matched_key = k
            break

    if not matched_key:
        matched_key = "biology" # Default fallback

    deck = FALLBACK_DECKS[matched_key][:count]
    return [Flashcard(**c) for c in deck]


# POST /cards Endpoint
@app.post("/cards", response_model=List[Flashcard])
async def get_cards(req: GenerateCardsRequest):
    try:
        cards = await generate_cards_with_llm(req.topic, req.count)
        return cards
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Card generation error: {str(e)}",
        )


# Helper: Evaluate Answer with LLM
async def evaluate_answer_with_llm(question: str, key_concept: str, user_answer: str) -> EvaluateResponse:
    prompt = f"""
    You are an encouraging VR teacher evaluating a student's answer.
    Question: "{question}"
    Expected Concept: "{key_concept}"
    Student Answer: "{user_answer}"

    Evaluate the student's response:
    - If mostly correct or grasps the essence: verdict = "correct"
    - If partially right or misses key details: verdict = "partial"
    - If incorrect, off-topic, or expresses complete uncertainty ("not sure", "don't know"): verdict = "wrong"

    Return ONLY a raw JSON object with:
    {{
      "verdict": "correct" | "partial" | "wrong",
      "feedback": "One or two short spoken-friendly sentences explaining the key concept."
    }}
    Do not use markdown backticks.
    """

    # 1. Try Gemini API
    if GEMINI_API_KEY:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.2, "maxOutputTokens": 300},
            }
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    raw_text = res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                    if raw_text.startswith("```"):
                        raw_text = raw_text.split("```")[1]
                        if raw_text.startswith("json"):
                            raw_text = raw_text[4:]
                    parsed = json.loads(raw_text.strip())
                    return EvaluateResponse(**parsed)
        except Exception as e:
            print(f"[Gemini Eval Error] Falling back: {e}")

    # 2. Try OpenAI API
    if OPENAI_API_KEY:
        try:
            url = "https://api.openai.com/v1/chat/completions"
            headers = {"Authorization": f"Bearer {OPENAI_API_KEY}"}
            payload = {
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": "You are a concise educational evaluator. Return only raw JSON."},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.2,
            }
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.post(url, headers=headers, json=payload)
                if res.status_code == 200:
                    raw_text = res.json()["choices"][0]["message"]["content"].strip()
                    if raw_text.startswith("```"):
                        raw_text = raw_text.split("```")[1]
                        if raw_text.startswith("json"):
                            raw_text = raw_text[4:]
                    parsed = json.loads(raw_text.strip())
                    return EvaluateResponse(**parsed)
        except Exception as e:
            print(f"[OpenAI Eval Error] Falling back: {e}")

    # 3. Deterministic Local Semantic Matching Fallback
    ans = user_answer.lower().strip()
    concept = key_concept.lower()

    unsure_phrases = ["not sure", "dont know", "don't know", "no idea", "idk", "unsure", "forgot"]
    if any(p in ans for p in unsure_phrases):
        return EvaluateResponse(
            verdict="wrong",
            feedback=f"That is okay! The key concept is: {key_concept}. Recommended to review this card in the Revise tray.",
        )

    # Keyword intersection check
    concept_words = set(w for w in concept.replace(".", "").replace(",", "").split() if len(w) > 3)
    user_words = set(w for w in ans.replace(".", "").replace(",", "").split() if len(w) > 3)
    overlap = concept_words.intersection(user_words)

    if ans in ["i knew it", "i know", "correct", "got it"] or len(overlap) >= 2:
        return EvaluateResponse(
            verdict="correct",
            feedback=f"Spot on! {key_concept}. You can comfortably sort this into the Know tray.",
        )
    elif len(overlap) == 1:
        return EvaluateResponse(
            verdict="partial",
            feedback=f"You are on the right track! Remember: {key_concept}. Drop in Revise if you want to practice again.",
        )
    else:
        return EvaluateResponse(
            verdict="wrong",
            feedback=f"Close attempt! The key concept is: {key_concept}. It is best to sort this into Revise.",
        )


# POST /evaluate Endpoint
@app.post("/evaluate", response_model=EvaluateResponse)
async def evaluate_answer(req: EvaluateRequest):
    try:
        result = await evaluate_answer_with_llm(req.question, req.key_concept, req.user_answer)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Evaluation error: {str(e)}",
        )


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    print(f"Starting HandDeck FastAPI backend on http://{host}:{port}")
    uvicorn.run("main:app", host=host, port=port, reload=True)

