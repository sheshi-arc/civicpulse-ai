import os
import json
import math
import re
import sqlite3
from datetime import datetime, timezone
from typing import Literal, Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import httpx

app = FastAPI(
    title="CivicPulse AI Backend",
    description="Backend API for Civic Complaint Triage, Routing, Semantic Similarity, and Issue Clustering",
    version="0.3.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ollama API configurations
OLLAMA_CHAT_URL = "http://localhost:11434/api/chat"
OLLAMA_CHAT_MODEL = "qwen3:4b"

OLLAMA_EMBED_URL = "http://localhost:11434/api/embed"
OLLAMA_EMBED_MODEL = "bge-m3"
SIMILARITY_THRESHOLD = 0.70

# Database path
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "civicpulse.db")

PRIORITY_LEVELS = ["Low", "Medium", "High", "Critical"]
PRIORITY_RANK = {"low": 1, "medium": 2, "high": 3, "critical": 4}

# =====================================================================
# Database Helpers
# =====================================================================

def get_db_connection() -> sqlite3.Connection:
    """Create and return a SQLite database connection with Row factory."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db() -> None:
    """Initialize SQLite database tables for issues and complaints."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS issues (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                category TEXT NOT NULL,
                priority TEXT NOT NULL,
                department TEXT NOT NULL,
                location TEXT NOT NULL,
                complaint_count INTEGER DEFAULT 1,
                status TEXT DEFAULT 'active',
                embedding TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS complaints (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT NOT NULL,
                category TEXT NOT NULL,
                priority TEXT NOT NULL,
                department TEXT NOT NULL,
                location TEXT NOT NULL,
                summary TEXT NOT NULL,
                issue_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (issue_id) REFERENCES issues(id)
            );
        """)
        conn.commit()

# Initialize tables on startup
init_db()

# =====================================================================
# Pydantic Schemas
# =====================================================================

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

class MasterIssueSummary(BaseModel):
    id: int
    title: str
    complaint_count: int
    priority: str
    department: str
    status: str

class SubmitComplaintResponse(BaseModel):
    complaint_id: int
    issue_id: int
    matched_existing_issue: bool
    similarity_score: float
    issue: MasterIssueSummary
    analysis: dict

# =====================================================================
# Math & AI Helper Functions
# =====================================================================

def calculate_cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    """Calculate cosine similarity between two numeric vectors using pure Python math."""
    dot_product = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot_product / (norm_a * norm_b)

async def analyze_complaint_ai(cleaned_complaint: str) -> dict:
    """Call local Qwen3:4b via Ollama to extract category, priority, department, location, summary, and dynamic title."""
    system_prompt = (
        "/no_think\n"
        "You are CivicPulse AI, an automated civic complaint triage and routing assistant.\n"
        "Analyze the citizen complaint and respond ONLY with a valid JSON object.\n"
        "Do not include any thought process, markdown backticks, or explanatory text.\n\n"
        "Allowed priority values strictly: 'Low', 'Medium', 'High', 'Critical'.\n\n"
        "Required JSON format:\n"
        "{\n"
        '  "title": "<A concise 2 to 5 word civic issue title, e.g., Main Gate Pothole or Market Area Garbage Overflow>",\n'
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
        cleaned_json = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_content, flags=re.MULTILINE).strip()
        parsed = json.loads(cleaned_json)

        # Ensure required fields
        required_fields = ["category", "priority", "department", "location", "summary"]
        for field in required_fields:
            if field not in parsed or not str(parsed[field]).strip():
                parsed[field] = "Not specified"

        # Normalize priority
        normalized_priority = "Medium"
        raw_pri = str(parsed.get("priority", "")).strip().lower()
        for p in PRIORITY_LEVELS:
            if p.lower() == raw_pri:
                normalized_priority = p
                break
        parsed["priority"] = normalized_priority

        # Generate dynamic title if absent or short
        title = str(parsed.get("title", "")).strip()
        if not title or len(title) < 3 or title.lower() == "not specified":
            loc = parsed.get("location", "")
            cat = parsed.get("category", "")
            if loc and loc.lower() != "not specified":
                title = f"{loc} - {cat}"
            else:
                title = f"{cat} Issue"
        parsed["title"] = title

        return parsed

    except (json.JSONDecodeError, ValueError) as err:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to parse structured JSON from AI model response. Raw response: {raw_content}"
        )

async def generate_embedding(text: str) -> list[float]:
    """Generate a 1024-dimensional dense semantic embedding using BGE-M3 via Ollama."""
    payload = {
        "model": OLLAMA_EMBED_MODEL,
        "input": text
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
        if not embeddings or len(embeddings) < 1:
            raise ValueError("Ollama did not return an embedding vector.")
        return embeddings[0]
    except Exception as err:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to parse embedding response: {str(err)}"
        )

# =====================================================================
# API Endpoints
# =====================================================================

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

    analysis = await analyze_complaint_ai(cleaned_complaint)
    return {
        "category": analysis["category"],
        "priority": analysis["priority"],
        "department": analysis["department"],
        "location": analysis["location"],
        "summary": analysis["summary"]
    }

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

@app.post("/api/submit-complaint", response_model=SubmitComplaintResponse)
async def submit_complaint(request: ComplaintRequest):
    """
    Ingest, analyze, embed, and cluster a citizen complaint into SQLite Master Issues.
    If semantically related (>= 0.70) to an active issue, clusters and increments count.
    Otherwise, creates a new Master Issue.
    """
    cleaned_complaint = request.complaint.strip()
    if not cleaned_complaint:
        raise HTTPException(
            status_code=400,
            detail="Complaint text cannot be empty or contain only whitespace."
        )

    now = datetime.now(timezone.utc).isoformat()

    # Step A: Analyze with Qwen3
    analysis = await analyze_complaint_ai(cleaned_complaint)

    # Step B: Generate BGE-M3 embedding
    new_embedding = await generate_embedding(cleaned_complaint)

    # Step C & D: Load active issues from SQLite and compare
    best_issue = None
    highest_similarity = 0.0

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM issues WHERE status = 'active'")
        active_issues = cursor.fetchall()

        for issue_row in active_issues:
            try:
                issue_vec = json.loads(issue_row["embedding"])
                similarity = calculate_cosine_similarity(new_embedding, issue_vec)
                if similarity > highest_similarity:
                    highest_similarity = similarity
                    best_issue = issue_row
            except Exception:
                continue

        matched_existing = False
        target_issue_id = None
        issue_summary_data = None

        if best_issue and highest_similarity >= SIMILARITY_THRESHOLD:
            # Step F: Match found! Attach to existing issue
            matched_existing = True
            target_issue_id = best_issue["id"]
            new_count = best_issue["complaint_count"] + 1

            # Escalate priority if new complaint is more severe
            current_priority = best_issue["priority"]
            new_priority = analysis["priority"]
            if PRIORITY_RANK.get(new_priority.lower(), 0) > PRIORITY_RANK.get(current_priority.lower(), 0):
                updated_priority = new_priority
            else:
                updated_priority = current_priority

            cursor.execute("""
                UPDATE issues
                SET complaint_count = ?, priority = ?, updated_at = ?
                WHERE id = ?
            """, (new_count, updated_priority, now, target_issue_id))

            issue_summary_data = {
                "id": target_issue_id,
                "title": best_issue["title"],
                "complaint_count": new_count,
                "priority": updated_priority,
                "department": best_issue["department"],
                "status": best_issue["status"]
            }
        else:
            # Step G: No matching issue >= 0.70. Create new Master Issue
            matched_existing = False
            title = analysis["title"]
            category = analysis["category"]
            priority = analysis["priority"]
            department = analysis["department"]
            location = analysis["location"]
            embedding_json = json.dumps(new_embedding)

            cursor.execute("""
                INSERT INTO issues (title, category, priority, department, location, complaint_count, status, embedding, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 1, 'active', ?, ?, ?)
            """, (title, category, priority, department, location, embedding_json, now, now))
            
            target_issue_id = cursor.lastrowid

            issue_summary_data = {
                "id": target_issue_id,
                "title": title,
                "complaint_count": 1,
                "priority": priority,
                "department": department,
                "status": "active"
            }

        # Step H: Save the individual complaint
        cursor.execute("""
            INSERT INTO complaints (text, category, priority, department, location, summary, issue_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            cleaned_complaint,
            analysis["category"],
            analysis["priority"],
            analysis["department"],
            analysis["location"],
            analysis["summary"],
            target_issue_id,
            now
        ))
        complaint_id = cursor.lastrowid
        conn.commit()

    return {
        "complaint_id": complaint_id,
        "issue_id": target_issue_id,
        "matched_existing_issue": matched_existing,
        "similarity_score": round(highest_similarity, 4),
        "issue": issue_summary_data,
        "analysis": {
            "category": analysis["category"],
            "priority": analysis["priority"],
            "department": analysis["department"],
            "location": analysis["location"],
            "summary": analysis["summary"]
        }
    }

@app.get("/api/issues")
async def get_issues(status: Optional[str] = Query(None, description="Filter by status: 'active' or 'resolved'")):
    """Get all Master Issues from SQLite, optionally filtered by status."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if status:
            cursor.execute("""
                SELECT id, title, category, priority, department, location, complaint_count, status, created_at, updated_at
                FROM issues
                WHERE status = ?
                ORDER BY updated_at DESC
            """, (status.strip().lower(),))
        else:
            cursor.execute("""
                SELECT id, title, category, priority, department, location, complaint_count, status, created_at, updated_at
                FROM issues
                ORDER BY updated_at DESC
            """)
        rows = cursor.fetchall()

    issues_list = [dict(row) for row in rows]
    return {"issues": issues_list}

@app.get("/api/issues/{issue_id}")
async def get_issue_details(issue_id: int):
    """Get detailed information for a specific Master Issue and all its associated complaints."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, title, category, priority, department, location, complaint_count, status, created_at, updated_at
            FROM issues
            WHERE id = ?
        """, (issue_id,))
        issue_row = cursor.fetchone()

        if not issue_row:
            raise HTTPException(status_code=404, detail=f"Issue with ID {issue_id} not found.")

        cursor.execute("""
            SELECT id, text, summary, priority, created_at
            FROM complaints
            WHERE issue_id = ?
            ORDER BY created_at ASC
        """, (issue_id,))
        complaint_rows = cursor.fetchall()

    return {
        "issue": dict(issue_row),
        "complaints": [dict(c) for c in complaint_rows]
    }

@app.patch("/api/issues/{issue_id}/resolve")
async def resolve_issue(issue_id: int):
    """Mark a Master Issue as 'resolved'."""
    now = datetime.now(timezone.utc).isoformat()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM issues WHERE id = ?", (issue_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail=f"Issue with ID {issue_id} not found.")

        cursor.execute("""
            UPDATE issues
            SET status = 'resolved', updated_at = ?
            WHERE id = ?
        """, (now, issue_id))
        conn.commit()

        cursor.execute("""
            SELECT id, title, category, priority, department, location, complaint_count, status, created_at, updated_at
            FROM issues
            WHERE id = ?
        """, (issue_id,))
        updated_row = cursor.fetchone()

    return dict(updated_row)
