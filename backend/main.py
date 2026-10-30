import json
import math
import re
from typing import Literal
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import httpx

app = FastAPI(
    title="CivicPulse AI Backend",
    description="Backend API for Civic Complaint Triage, Routing, and Semantic Similarity",
    version="0.2.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_CHAT_URL = "http://localhost:11434/api/chat"
OLLAMA_CHAT_MODEL = "qwen3:4b"

OLLAMA_EMBED_URL = "http://localhost:11434/api/embed"
OLLAMA_EMBED_MODEL = "bge-m3"
SIMILARITY_THRESHOLD = 0.70

class HealthResponse(BaseModel):
    status: str
    service: str

class ComplaintRequest(BaseModel):
    complaint: str = Field(..., description="The citizen complaint text")

class ComplaintAnalysisResponse(BaseModel):
    category: str
    priority: Literal["Low", "Medium", "High", "Critical"] | str
    department: str
    location: str
    summary: str

class SimilarityRequest(BaseModel):
    complaint_a: str = Field(..., description="First complaint text")
    complaint_b: str = Field(..., description="Second complaint text")

class SimilarityResponse(BaseModel):
    similarity_score: float
    is_related: bool
    message: str

def calculate_cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    """Calculate cosine similarity between two numeric vectors using pure Python math."""
    dot_product = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot_product / (norm_a * norm_b)

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint to verify service status."""
    return {
        "status": "ok",
        "service": "CivicPulse AI"
    }

@app.post("/api/analyze-complaint", response_model=ComplaintAnalysisResponse)
async def analyze_complaint(request: ComplaintRequest):
    """
    Analyze a citizen complaint using local Qwen3:4b via Ollama.
    Extracts category, priority, department, location, and summary.
    """
    cleaned_complaint = request.complaint.strip()
    if not cleaned_complaint:
        raise HTTPException(
            status_code=400,
            detail="Complaint text cannot be empty or contain only whitespace."
        )

    system_prompt = (
        "/no_think\n"
        "You are CivicPulse AI, an automated civic complaint triage and routing assistant.\n"
        "Analyze the citizen complaint and respond ONLY with a valid JSON object.\n"
        "Do not include any thought process, markdown backticks, or explanatory text.\n\n"
        "Allowed priority values strictly: 'Low', 'Medium', 'High', 'Critical'.\n\n"
        "Required JSON format:\n"
        "{\n"
        '  "category": "<e.g., Road Infrastructure, Sanitation & Waste, Water Works, Electricity, Public Safety>",\n'
        '  "priority": "<Low | Medium | High | Critical>",\n'
        '  "department": "<Responsible municipal department>",\n'
        '  "location": "<Extracted specific location, landmark, or Not specified>",\n'
        '  "summary": "<Concise one-sentence summary of the reported issue>"\n'
        "}"
    )

    user_prompt = f"/no_think\nAnalyze this complaint:\n\"{cleaned_complaint}\""

    payload = {
        "model": OLLAMA_CHAT_MODEL,
        "think": False,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "stream": False,
        "format": "json"
    }

    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            response = await client.post(OLLAMA_CHAT_URL, json=payload)
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="Ollama service is unreachable. Please make sure Ollama is running on http://localhost:11434."
        )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="Request to Ollama timed out. The model may be busy or still loading."
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error connecting to Ollama: {str(e)}"
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Ollama returned status code {response.status_code}: {response.text}"
        )

    try:
        ollama_data = response.json()
        raw_content = ollama_data.get("message", {}).get("content", "").strip()
        
        # Remove any stray markdown code blocks if present
        cleaned_json = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_content, flags=re.MULTILINE).strip()
        
        parsed = json.loads(cleaned_json)

        # Validate required fields
        required_fields = ["category", "priority", "department", "location", "summary"]
        for field in required_fields:
            if field not in parsed:
                parsed[field] = "Not specified"

        # Normalize priority if needed
        valid_priorities = ["Low", "Medium", "High", "Critical"]
        if parsed.get("priority") not in valid_priorities:
            matched = False
            for p in valid_priorities:
                if p.lower() == str(parsed.get("priority", "")).lower():
                    parsed["priority"] = p
                    matched = True
                    break
            if not matched:
                parsed["priority"] = "Medium"

        return parsed

    except (json.JSONDecodeError, ValueError) as err:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to parse structured JSON from AI model response. Raw response: {raw_content}"
        )

@app.post("/api/similarity", response_model=SimilarityResponse)
async def calculate_similarity(request: SimilarityRequest):
    """
    Calculate semantic similarity between two complaints using BGE-M3 embeddings.
    Determines if complaints describe the same underlying civic problem (City Memory).
    """
    text_a = request.complaint_a.strip()
    text_b = request.complaint_b.strip()

    if not text_a or not text_b:
        raise HTTPException(
            status_code=400,
            detail="Both complaint_a and complaint_b are required and cannot be empty."
        )

    payload = {
        "model": OLLAMA_EMBED_MODEL,
        "input": [text_a, text_b]
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(OLLAMA_EMBED_URL, json=payload)
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="Ollama service is unreachable. Please make sure Ollama is running on http://localhost:11434."
        )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="Request to Ollama embedding API timed out."
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error connecting to Ollama embedding service: {str(e)}"
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Ollama embedding API returned status code {response.status_code}: {response.text}"
        )

    try:
        data = response.json()
        embeddings = data.get("embeddings", [])
        if len(embeddings) < 2:
            raise ValueError("Ollama did not return two embedding vectors.")
        
        vec_a = embeddings[0]
        vec_b = embeddings[1]
        
        score = round(calculate_cosine_similarity(vec_a, vec_b), 4)
        is_related = score >= SIMILARITY_THRESHOLD
        
        if is_related:
            message = "These complaints appear to describe a similar civic issue."
        else:
            message = "These complaints appear to describe different civic issues."

        return {
            "similarity_score": score,
            "is_related": is_related,
            "message": message
        }
    except Exception as err:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to process embedding vectors: {str(err)}"
        )
