import os
import json
import math
import re
import sqlite3
import uuid
import shutil
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Literal, Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Query, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import httpx

from auth import router as auth_router, init_admin_user
from desk_routes import router as desk_router
from dev_routes import router as dev_router
from admin_routes import router as admin_router
from scheduler import start_scheduler, stop_scheduler
from db_migrations import run_migrations
from desk_service import orchestrate_new_issue_workflow, orchestrate_merged_issue_workflow, send_citizen_receipt_email
from resolution_service import process_issue_resolution
from seed_data import seed_accountability_desk_data
from config import (
    HOST,
    PORT,
    ALLOWED_ORIGINS,
    OLLAMA_BASE_URL,
    OLLAMA_CHAT_URL,
    OLLAMA_CHAT_MODEL,
    OLLAMA_EMBED_URL,
    OLLAMA_EMBED_MODEL,
    SIMILARITY_THRESHOLD,
    DB_PATH,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    conn = get_db_connection()
    run_migrations(conn)
    conn.close()
    init_admin_user()
    start_scheduler()
    yield
    stop_scheduler()

app = FastAPI(
    title="CivicPulse AI Platform",
    description="Production-grade AI Platform for Civic Complaint Triage, City Memory, Routing, and Geospatial Intelligence",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for frontend integration (production-ready explicit origins and regex)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://civicpulse-.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(desk_router)
app.include_router(dev_router)
app.include_router(admin_router)


# Uploads directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Priority configurations
PRIORITY_LEVELS = ["Low", "Medium", "High", "Critical"]
PRIORITY_RANK = {"low": 1, "medium": 2, "high": 3, "critical": 4}

# =====================================================================
# Database Migration & Helpers
# =====================================================================

def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db() -> None:
    """Initialize or migrate SQLite database tables with all rich fields."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # 1. Create tables if not exist
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS issues (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                category TEXT NOT NULL,
                subcategory TEXT DEFAULT '',
                priority TEXT NOT NULL,
                department TEXT NOT NULL,
                location TEXT NOT NULL,
                latitude REAL DEFAULT NULL,
                longitude REAL DEFAULT NULL,
                complaint_count INTEGER DEFAULT 1,
                confirmed_count INTEGER DEFAULT 0,
                status TEXT DEFAULT 'active',
                safety_risk INTEGER DEFAULT 0,
                urgency_reason TEXT DEFAULT '',
                suggested_action TEXT DEFAULT '',
                embedding TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                resolved_at TEXT DEFAULT NULL
            );
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS complaints (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tracking_id TEXT UNIQUE NOT NULL,
                text TEXT NOT NULL,
                category TEXT NOT NULL,
                subcategory TEXT DEFAULT '',
                priority TEXT NOT NULL,
                department TEXT NOT NULL,
                location TEXT NOT NULL,
                latitude REAL DEFAULT NULL,
                longitude REAL DEFAULT NULL,
                summary TEXT NOT NULL,
                photo_url TEXT DEFAULT NULL,
                safety_risk INTEGER DEFAULT 0,
                issue_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (issue_id) REFERENCES issues(id)
            );
        """)
        
        # 2. Add columns if missing in existing database (seamless migration)
        cursor.execute("PRAGMA table_info(issues)")
        issue_cols = [row["name"] for row in cursor.fetchall()]
        
        new_issue_cols = [
            ("description", "TEXT DEFAULT ''"),
            ("subcategory", "TEXT DEFAULT ''"),
            ("latitude", "REAL DEFAULT NULL"),
            ("longitude", "REAL DEFAULT NULL"),
            ("confirmed_count", "INTEGER DEFAULT 0"),
            ("safety_risk", "INTEGER DEFAULT 0"),
            ("urgency_reason", "TEXT DEFAULT ''"),
            ("suggested_action", "TEXT DEFAULT ''"),
            ("resolved_at", "TEXT DEFAULT NULL"),
        ]
        for col_name, col_def in new_issue_cols:
            if col_name not in issue_cols:
                try:
                    cursor.execute(f"ALTER TABLE issues ADD COLUMN {col_name} {col_def}")
                except Exception:
                    pass

        cursor.execute("PRAGMA table_info(complaints)")
        comp_cols = [row["name"] for row in cursor.fetchall()]
        
        new_comp_cols = [
            ("tracking_id", "TEXT DEFAULT ''"),
            ("subcategory", "TEXT DEFAULT ''"),
            ("latitude", "REAL DEFAULT NULL"),
            ("longitude", "REAL DEFAULT NULL"),
            ("photo_url", "TEXT DEFAULT NULL"),
            ("safety_risk", "INTEGER DEFAULT 0"),
        ]
        for col_name, col_def in new_comp_cols:
            if col_name not in comp_cols:
                try:
                    cursor.execute(f"ALTER TABLE complaints ADD COLUMN {col_name} {col_def}")
                except Exception:
                    pass

        conn.commit()

init_db()

# =====================================================================
# Pydantic Schemas
# =====================================================================

class HealthResponse(BaseModel):
    status: str
    service: str
    ai_status: Optional[str] = "online"
    models: Optional[Dict[str, bool]] = None
    city_memory: Optional[str] = "v2.0-geodesic"

class ComplaintRequest(BaseModel):
    complaint: str = Field(..., description="The citizen complaint text")
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    photo_url: Optional[str] = None
    citizen_email: Optional[str] = None
    reporter_name: Optional[str] = None
    reporter_phone: Optional[str] = None
    category: Optional[str] = None

class SimilarityRequest(BaseModel):
    complaint_a: str
    complaint_b: str
    lat_a: Optional[float] = None
    lon_a: Optional[float] = None
    lat_b: Optional[float] = None
    lon_b: Optional[float] = None

# =====================================================================
# Math & AI Helpers
# =====================================================================

def calculate_distance_km(
    lat1: Optional[float],
    lon1: Optional[float],
    lat2: Optional[float],
    lon2: Optional[float]
) -> Optional[float]:
    """
    Calculate the great circle distance between two points on Earth using the Haversine formula.
    Returns distance in kilometers (rounded to 3 decimal places), or None if coordinates are missing/invalid.
    """
    if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
        return None
    try:
        lat1, lon1, lat2, lon2 = float(lat1), float(lon1), float(lat2), float(lon2)
    except (ValueError, TypeError):
        return None

    # Earth radius in kilometers
    R = 6371.0

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2)
    a = min(1.0, max(0.0, a))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(R * c, 3)

def evaluate_cluster_match(
    similarity: float,
    distance_km: Optional[float]
) -> tuple[bool, bool, str]:
    """
    City Memory 2.0 Decision Engine:
    Combines BGE-M3 semantic similarity with Haversine geographic distance.

    Decision matrix:
    - Case A: Similarity >= 0.70 and distance <= 1.0 km -> Strong match
    - Case B: Similarity >= 0.80 and distance <= 3.0 km -> Match within neighborhood radius
    - Case C: Similarity >= 0.85 but distance > 3.0 km -> Distinct location (do NOT merge)
    - Case D: Similarity < 0.70 -> Different issue (do NOT merge)
    - Missing Coordinates Fallback: Similarity >= 0.75 -> Merge with spatial notice

    Returns:
        (is_match: bool, is_geo_match: bool, reason: str)
    """
    sim_pct = round(similarity * 100, 1)

    # Case D: Semantic similarity below threshold
    if similarity < 0.70:
        dist_desc = f" at distance {distance_km} km" if distance_km is not None else ""
        return (
            False,
            False,
            f"Semantic similarity ({sim_pct}%) is below the clustering threshold (70.0%){dist_desc}."
        )

    # If coordinates are available for both
    if distance_km is not None:
        # Case A: Strong semantic match and close proximity (<= 1.0 km)
        if similarity >= 0.70 and distance_km <= 1.0:
            return (
                True,
                True,
                f"Matched existing issue: high semantic similarity ({sim_pct}%) and close proximity ({distance_km} km <= 1.0 km)."
            )

        # Case B: Very high semantic similarity within neighborhood radius (<= 3.0 km)
        if similarity >= 0.80 and distance_km <= 3.0:
            return (
                True,
                True,
                f"Matched existing issue: strong semantic alignment ({sim_pct}%) within neighborhood radius ({distance_km} km <= 3.0 km)."
            )

        # Case C: Semantically similar but geographically far (> 3.0 km)
        if distance_km > 3.0:
            return (
                False,
                False,
                f"Created new issue: complaint is semantically similar ({sim_pct}%) but located {distance_km} km away (> 3.0 km threshold)."
            )

        # In-between: 0.70 <= similarity < 0.80 and 1.0 < distance_km <= 3.0
        return (
            False,
            False,
            f"Created new issue: moderate similarity ({sim_pct}%) requires proximity <= 1.0 km, but report is {distance_km} km away."
        )

    # Fallback when coordinates are missing
    if similarity >= 0.75:
        return (
            True,
            False,
            f"Matched existing issue: semantic similarity ({sim_pct}%) meets non-spatial threshold; geographic matching was unavailable."
        )
    else:
        return (
            False,
            False,
            f"Created new issue: similarity ({sim_pct}%) insufficient without geographic coordinate verification (requires >= 75.0%)."
        )

def calculate_cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    dot_product = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot_product / (norm_a * norm_b)

async def analyze_complaint_ai(cleaned_complaint: str) -> dict:
    system_prompt = (
        "/no_think\n"
        "You are CivicPulse AI, an automated civic complaint triage and routing engine.\n"
        "Analyze the citizen complaint and respond ONLY with a valid JSON object.\n"
        "Do not include any thought process, markdown backticks, or explanatory text.\n\n"
        "Allowed priority values strictly: 'Low', 'Medium', 'High', 'Critical'.\n\n"
        "Required JSON format:\n"
        "{\n"
        '  "title": "<A concise 2 to 5 word civic issue title, e.g., Main Gate Pothole or Market Area Garbage Overflow>",\n'
        '  "category": "<Roads, Sanitation, Water Works, Electricity, Traffic, Parks, Public Safety, Other>",\n'
        '  "subcategory": "<e.g., Pothole, Broken Pipe, Streetlight, Overflowing Bin, Drainage>",\n'
        '  "priority": "<Low | Medium | High | Critical>",\n'
        '  "department": "<Public Works, Sanitation & Waste, Water Works, Electricity, Traffic, Parks, Public Safety, Other>",\n'
        '  "location": "<Extracted specific location, landmark, or Not specified>",\n'
        '  "summary": "<Concise one-sentence summary of the reported issue>",\n'
        '  "safety_risk": <true | false>,\n'
        '  "urgency_reason": "<Why this requires timely attention>",\n'
        '  "suggested_action": "<Recommended immediate municipal action>"\n'
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
        raise HTTPException(status_code=503, detail="Ollama service is unreachable at http://localhost:11434.")
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Request to Ollama timed out.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error connecting to Ollama: {str(e)}")

    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Ollama returned {response.status_code}: {response.text}")

    try:
        ollama_data = response.json()
        raw_content = ollama_data.get("message", {}).get("content", "").strip()
        cleaned_json = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_content, flags=re.MULTILINE).strip()
        parsed = json.loads(cleaned_json)

        # Normalize priority
        raw_pri = str(parsed.get("priority", "")).strip().lower()
        normalized_pri = "Medium"
        for p in PRIORITY_LEVELS:
            if p.lower() == raw_pri:
                normalized_pri = p
                break
        parsed["priority"] = normalized_pri

        # Title fallback
        title = str(parsed.get("title", "")).strip()
        if not title or len(title) < 3 or title.lower() == "not specified":
            loc = parsed.get("location", "")
            cat = parsed.get("category", "")
            title = f"{loc} - {cat}" if loc and loc.lower() != "not specified" else f"{cat} Issue"
        parsed["title"] = title

        # Safety risk boolean
        parsed["safety_risk"] = bool(parsed.get("safety_risk", False))
        if parsed["priority"] in ["High", "Critical"]:
            parsed["safety_risk"] = True

        parsed["subcategory"] = parsed.get("subcategory", "") or "General"
        parsed["urgency_reason"] = parsed.get("urgency_reason", "") or "Requires municipal review."
        parsed["suggested_action"] = parsed.get("suggested_action", "") or "Dispatch inspection team."

        return parsed

    except Exception:
        # Fallback if model parsing was imperfect
        return {
            "title": "Reported Civic Damage",
            "category": "Roads",
            "subcategory": "Surface Damage",
            "priority": "Medium",
            "department": "Public Works",
            "location": "Not specified",
            "summary": cleaned_complaint[:120],
            "safety_risk": False,
            "urgency_reason": "Standard triage review required.",
            "suggested_action": "Inspect reported location."
        }

async def generate_embedding(text: str) -> list[float]:
    payload = {"model": OLLAMA_EMBED_MODEL, "input": text}
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(OLLAMA_EMBED_URL, json=payload)
        data = response.json()
        return data["embeddings"][0]
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Ollama embedding failure: {str(e)}")

def generate_tracking_id(db_conn: sqlite3.Connection) -> str:
    cursor = db_conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM complaints")
    count = cursor.fetchone()[0] + 1
    return f"CP-2026-{count:05d}"

# =====================================================================
# REST Endpoints
# =====================================================================

@app.get("/health", response_model=HealthResponse)
async def health_check():
    ai_online = False
    models_status = {"qwen3:4b": False, "bge-m3": False}
    try:
        async with httpx.AsyncClient(timeout=1.0) as client:
            resp = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            if resp.status_code == 200:
                tags = resp.json().get("models", [])
                tag_names = [m.get("name", "") for m in tags]
                models_status["qwen3:4b"] = any("qwen3" in name for name in tag_names)
                models_status["bge-m3"] = any("bge-m3" in name for name in tag_names)
                ai_online = models_status["qwen3:4b"] and models_status["bge-m3"]
    except Exception:
        ai_online = False

    return {
        "status": "ok",
        "service": "CivicPulse AI",
        "ai_status": "online" if ai_online else "offline",
        "models": models_status,
        "city_memory": "v2.0-geodesic"
    }

@app.post("/api/upload")
async def upload_photo(file: UploadFile = File(...)):
    """Upload photo evidence for a citizen complaint."""
    ext = os.path.splitext(file.filename)[1].lower() or ".jpg"
    filename = f"evidence_{uuid.uuid4().hex[:10]}{ext}"
    dest_path = os.path.join(UPLOAD_DIR, filename)
    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"success": True, "url": f"/uploads/{filename}", "filename": filename}

@app.post("/api/submit-complaint")
async def submit_complaint(request: ComplaintRequest, background_tasks: BackgroundTasks):
    """
    Submit a citizen complaint. Analyzes with Qwen3, embeds with BGE-M3,
    and clusters into SQLite Master Issues (City Memory).
    Hooks into Accountability Desk email & surge dispatch asynchronously.
    """
    cleaned_complaint = request.complaint.strip()
    if not cleaned_complaint:
        raise HTTPException(status_code=400, detail="Complaint text cannot be empty.")

    now = datetime.now(timezone.utc).isoformat()

    # Step A: Qwen3 analysis
    analysis = await analyze_complaint_ai(cleaned_complaint)

    # Step B: BGE-M3 embedding
    new_embedding = await generate_embedding(cleaned_complaint)

    # Use coordinates if supplied
    latitude = request.latitude
    longitude = request.longitude

    with get_db_connection() as conn:
        cursor = conn.cursor()
        tracking_id = generate_tracking_id(conn)

        # Step C: Load active issues and match via City Memory 2.0 (Semantic + Haversine)
        cursor.execute("SELECT * FROM issues WHERE status = 'active'")
        active_issues = cursor.fetchall()

        best_issue = None
        best_sim = 0.0
        best_dist = None
        best_is_geo_match = False
        best_match_reason = "Created new Master Issue: no matching active issue found in City Memory."
        matched_existing = False

        matched_candidates = []
        highest_sim_candidate = None
        highest_sim = -1.0
        highest_sim_dist = None

        for issue_row in active_issues:
            try:
                issue_vec = json.loads(issue_row["embedding"])
                sim = calculate_cosine_similarity(new_embedding, issue_vec)
                dist_km = calculate_distance_km(latitude, longitude, issue_row["latitude"], issue_row["longitude"])

                if sim > highest_sim:
                    highest_sim = sim
                    highest_sim_candidate = issue_row
                    highest_sim_dist = dist_km

                is_match, is_geo, reason = evaluate_cluster_match(sim, dist_km)
                if is_match:
                    matched_candidates.append({
                        "issue": issue_row,
                        "similarity": sim,
                        "distance_km": dist_km,
                        "is_geo_match": is_geo,
                        "reason": reason
                    })
            except Exception:
                continue

        if matched_candidates:
            # Sort candidates by similarity descending
            matched_candidates.sort(key=lambda c: c["similarity"], reverse=True)
            chosen = matched_candidates[0]
            best_issue = chosen["issue"]
            best_sim = chosen["similarity"]
            best_dist = chosen["distance_km"]
            best_is_geo_match = chosen["is_geo_match"]
            best_match_reason = chosen["reason"]
            matched_existing = True
        elif highest_sim_candidate is not None:
            best_sim = max(0.0, highest_sim)
            best_dist = highest_sim_dist
            _, _, rejection_reason = evaluate_cluster_match(best_sim, highest_sim_dist)
            best_match_reason = rejection_reason

        target_issue_id = None
        issue_summary_data = None

        if matched_existing and best_issue:
            # Join existing issue
            target_issue_id = best_issue["id"]
            new_count = best_issue["complaint_count"] + 1

            # Escalate priority if newer complaint is higher
            cur_p = best_issue["priority"]
            new_p = analysis["priority"]
            updated_p = new_p if PRIORITY_RANK.get(new_p.lower(), 0) > PRIORITY_RANK.get(cur_p.lower(), 0) else cur_p

            cursor.execute("""
                UPDATE issues
                SET complaint_count = ?, priority = ?, updated_at = ?
                WHERE id = ?
            """, (new_count, updated_p, now, target_issue_id))

            issue_summary_data = {
                "id": target_issue_id,
                "title": best_issue["title"],
                "complaint_count": new_count,
                "priority": updated_p,
                "department": best_issue["department"],
                "status": best_issue["status"]
            }
        else:
            # Create new Master Issue
            matched_existing = False
            title = analysis["title"]
            cat = analysis["category"]
            subcat = analysis.get("subcategory", "")
            pri = analysis["priority"]
            dept = analysis["department"]
            loc = request.location or analysis["location"]
            emb_json = json.dumps(new_embedding)
            safety = 1 if analysis.get("safety_risk") else 0
            urgency = analysis.get("urgency_reason", "")
            action = analysis.get("suggested_action", "")

            cursor.execute("""
                INSERT INTO issues (
                    title, description, category, subcategory, priority, department, location,
                    latitude, longitude, complaint_count, confirmed_count, status,
                    safety_risk, urgency_reason, suggested_action, embedding, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 'active', ?, ?, ?, ?, ?, ?)
            """, (
                title, analysis["summary"], cat, subcat, pri, dept, loc,
                latitude, longitude, safety, urgency, action, emb_json, now, now
            ))
            target_issue_id = cursor.lastrowid

            issue_summary_data = {
                "id": target_issue_id,
                "title": title,
                "complaint_count": 1,
                "priority": pri,
                "department": dept,
                "status": "active"
            }

        # Save complaint record including citizen_email, reporter_name, reporter_phone
        cursor.execute("""
            INSERT INTO complaints (
                tracking_id, citizen_email, reporter_name, reporter_phone, text, category, subcategory, priority, department, location,
                latitude, longitude, summary, photo_url, safety_risk, issue_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            tracking_id,
            request.citizen_email,
            request.reporter_name,
            request.reporter_phone,
            cleaned_complaint,
            request.category or analysis["category"],
            analysis.get("subcategory", ""),
            analysis["priority"],
            analysis["department"],
            request.location or analysis["location"],
            latitude,
            longitude,
            analysis["summary"],
            request.photo_url,
            1 if analysis.get("safety_risk") else 0,
            target_issue_id,
            now
        ))
        complaint_id = cursor.lastrowid
        conn.commit()

    # Accountability Desk: Async orchestration in background tasks (< 2 sec response)
    if not matched_existing:
        background_tasks.add_task(orchestrate_new_issue_workflow, target_issue_id)
        if request.citizen_email:
            background_tasks.add_task(send_citizen_receipt_email, request.citizen_email, tracking_id, issue_summary_data["title"])
    else:
        background_tasks.add_task(orchestrate_merged_issue_workflow, target_issue_id)
        if request.citizen_email:
            background_tasks.add_task(send_citizen_receipt_email, request.citizen_email, tracking_id, best_issue["title"])

    city_memory_info = {
        "matched": matched_existing,
        "semantic_similarity": round(best_sim, 4),
        "distance_km": round(best_dist, 2) if best_dist is not None else None,
        "geographic_match": best_is_geo_match,
        "match_reason": best_match_reason,
        "matched_issue_id": target_issue_id if matched_existing else None,
        "matched_issue_title": best_issue["title"] if matched_existing and best_issue else None
    }

    return {
        "success": True,
        "complaint_id": complaint_id,
        "tracking_id": tracking_id,
        "issue_id": target_issue_id,
        "matched_existing_issue": matched_existing,
        "similarity_score": round(best_sim, 4),
        "distance_km": round(best_dist, 2) if best_dist is not None else None,
        "geographic_match": best_is_geo_match,
        "match_reason": best_match_reason,
        "city_memory": city_memory_info,
        "issue": issue_summary_data,
        "analysis": analysis
    }

@app.get("/api/complaints/track/{tracking_id}")
async def track_complaint(tracking_id: str):
    """Citizen tracking page endpoint for complaint progress and timeline."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT c.*, i.title as issue_title, i.status as issue_status, i.complaint_count as issue_count,
                   i.desk_status, i.proof_photo_url, i.resolution_receipt, i.resolution_note,
                   i.reopen_count, i.ack_at, i.resolved_at, i.closed_at,
                   (SELECT COUNT(*) FROM reviews WHERE issue_id = i.id AND still_broken = 0) as verified_citizen_count,
                   (SELECT COUNT(*) FROM reviews WHERE issue_id = i.id) as total_review_count
            FROM complaints c
            LEFT JOIN issues i ON c.issue_id = i.id
            WHERE c.tracking_id = ?
        """, (tracking_id.strip().upper(),))
        row = cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail=f"Tracking ID '{tracking_id}' not found.")

        data = dict(row)
        raw_desk_st = (data.get("desk_status") or "NEW").upper()

        # Map to canonical 6 production statuses
        if raw_desk_st in ["NEW", "EMAILED"]:
            canonical_status = "NEW"
        elif raw_desk_st in ["ASSIGNED", "ACKNOWLEDGED"]:
            canonical_status = "ASSIGNED"
        elif raw_desk_st == "IN_PROGRESS":
            canonical_status = "IN_PROGRESS"
        elif raw_desk_st in ["ON_HOLD", "NEEDS_INFO"]:
            canonical_status = "ON_HOLD"
        elif raw_desk_st in ["COMPLETED", "RESOLVED_PENDING_REVIEW"]:
            canonical_status = "COMPLETED"
        elif raw_desk_st in ["RESOLVED", "CLOSED"]:
            canonical_status = "RESOLVED"
        else:
            canonical_status = raw_desk_st

        is_closed = canonical_status == "RESOLVED"
        is_completed = canonical_status in ["COMPLETED", "RESOLVED"]
        is_in_progress = canonical_status in ["IN_PROGRESS", "ON_HOLD", "COMPLETED", "RESOLVED"]
        is_assigned = canonical_status != "NEW"

        # Sanitize sensitive citizen contact details to prevent IDOR scraping
        citizen_email = data.get("citizen_email") or ""
        masked_email = ""
        if "@" in citizen_email:
            parts = citizen_email.split("@", 1)
            masked_email = (parts[0][:2] + "***" if len(parts[0]) > 2 else "***") + "@" + parts[1]

        safe_complaint = {
            "id": data.get("id"),
            "tracking_id": data.get("tracking_id"),
            "text": data.get("text"),
            "category": data.get("category"),
            "subcategory": data.get("subcategory"),
            "priority": data.get("priority"),
            "department": data.get("department"),
            "location": data.get("location"),
            "created_at": data.get("created_at"),
            "photo_url": data.get("photo_url"),
            "reporter_name": data.get("reporter_name") or "Verified Citizen",
            "citizen_email_masked": masked_email,
        }

        # Build live timeline stages matching canonical statuses
        timeline = [
            {"step": "Report Submitted", "completed": True, "time": data.get("created_at")},
            {"step": "City Memory Clustered", "completed": True, "detail": f"Master Issue #{data.get('issue_id')} ({data.get('issue_count', 1)} citizen reports merged)"},
            {"step": "Assigned to Municipal Operations", "completed": is_assigned, "detail": data.get("department")},
            {"step": "Field Work in Progress" if canonical_status != "ON_HOLD" else "Work Paused (On Hold)", "completed": is_in_progress, "status": canonical_status},
            {"step": "Resolution & Verification", "completed": is_completed, "status": "Completed" if canonical_status == "COMPLETED" else "Resolved" if canonical_status == "RESOLVED" else "Pending"}
        ]

        # Fetch public notes for this ticket
        cursor.execute("""
            SELECT content, note_type, created_at FROM ticket_notes 
            WHERE issue_id = ? AND note_type IN ('public', 'system')
            ORDER BY created_at ASC
        """, (data.get("issue_id"),))
        public_notes = [dict(n) for n in cursor.fetchall()]

        return {
            "success": True,
            "tracking_id": data.get("tracking_id"),
            "complaint_id": data.get("id"),
            "issue_id": data.get("issue_id"),
            "issue_title": data.get("issue_title"),
            "issue_status": data.get("issue_status"),
            "desk_status": canonical_status,
            "status": "resolved" if canonical_status == "RESOLVED" else "active",
            "priority": data.get("priority"),
            "department": data.get("department"),
            "location": data.get("location"),
            "text": data.get("text"),
            "proof_photo_url": data.get("proof_photo_url"),
            "resolution_receipt": data.get("resolution_receipt"),
            "resolution_note": data.get("resolution_note"),
            "verified_citizen_count": data.get("verified_citizen_count", 0),
            "reopen_count": data.get("reopen_count", 0),
            "complaint": safe_complaint,
            "timeline": timeline,
            "notes": public_notes
        }

@app.get("/api/issues")
async def get_issues(
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    department: Optional[str] = Query(None)
):
    """Retrieve all Master Issues with flexible filters."""
    query = """
        SELECT id, title, description, category, subcategory, priority, department, location,
               latitude, longitude, complaint_count, confirmed_count, status, safety_risk,
               urgency_reason, suggested_action, created_at, updated_at, resolved_at
        FROM issues
        WHERE 1=1
    """
    params = []

    if status and status.lower() != "all":
        query += " AND status = ?"
        params.append(status.strip().lower())
    if category and category.lower() != "all":
        query += " AND category LIKE ?"
        params.append(f"%{category.strip()}%")
    if priority and priority.lower() != "all":
        query += " AND priority = ?"
        params.append(priority.strip().capitalize())
    if department and department.lower() != "all":
        query += " AND department LIKE ?"
        params.append(f"%{department.strip()}%")

    query += " ORDER BY updated_at DESC"

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()

    return {"issues": [dict(r) for r in rows]}

@app.get("/api/map/issues")
async def get_map_issues():
    """Lightweight geospatial payload for interactive map markers and hotspots."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, title, category, priority, department, location,
                   latitude, longitude, complaint_count, confirmed_count, status, safety_risk, updated_at
            FROM issues
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL
            ORDER BY complaint_count DESC
        """)
        rows = cursor.fetchall()
    return {"issues": [dict(r) for r in rows]}

@app.get("/api/issues/{issue_id}")
async def get_issue_details(issue_id: int):
    """Get single Master Issue details along with all underlying citizen complaints."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, title, description, category, subcategory, priority, department, location,
                   latitude, longitude, complaint_count, confirmed_count, status, safety_risk,
                   urgency_reason, suggested_action, created_at, updated_at, resolved_at
            FROM issues
            WHERE id = ?
        """, (issue_id,))
        issue_row = cursor.fetchone()

        if not issue_row:
            raise HTTPException(status_code=404, detail=f"Issue #{issue_id} not found.")

        cursor.execute("""
            SELECT id, tracking_id, text, summary, priority, photo_url, created_at
            FROM complaints
            WHERE issue_id = ?
            ORDER BY created_at ASC
        """, (issue_id,))
        complaints = cursor.fetchall()

    return {
        "issue": dict(issue_row),
        "complaints": [dict(c) for c in complaints]
    }

@app.post("/api/issues/{issue_id}/confirm")
async def confirm_issue_affected(issue_id: int):
    """Citizen 'I am affected too' action to increment issue weight."""
    now = datetime.now(timezone.utc).isoformat()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, complaint_count, confirmed_count FROM issues WHERE id = ?", (issue_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Issue #{issue_id} not found.")

        new_count = row["complaint_count"] + 1
        new_confirmed = (row["confirmed_count"] or 0) + 1

        cursor.execute("""
            UPDATE issues
            SET complaint_count = ?, confirmed_count = ?, updated_at = ?
            WHERE id = ?
        """, (new_count, new_confirmed, now, issue_id))
        conn.commit()

    return {"success": True, "issue_id": issue_id, "complaint_count": new_count, "confirmed_count": new_confirmed}

@app.patch("/api/issues/{issue_id}/resolve")
async def resolve_issue(issue_id: int):
    """Admin resolution routed through Accountability Desk verification flow."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM issues WHERE id = ?", (issue_id,))
        issue = cursor.fetchone()
        if not issue:
            raise HTTPException(status_code=404, detail=f"Issue #{issue_id} not found.")

    await process_issue_resolution(
        issue_id=issue_id,
        proof_photo_url=issue["proof_photo_url"] or "https://images.unsplash.com/photo-1590486803833-1c5dc8ddd4c8?w=600&auto=format&fit=crop&q=80",
        resolution_note=issue["resolution_note"] or "Completed on-site corrective maintenance verified by Municipal Command Center.",
        actor_email="admin@civicpulse.gov"
    )

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM issues WHERE id = ?", (issue_id,))
        updated_row = cursor.fetchone()

    return dict(updated_row)

@app.get("/api/analytics/overview")
async def get_analytics_overview():
    """Real aggregated statistics for municipal command center and public landing page."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM issues WHERE status = 'active'")
        active_issues = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM issues WHERE status = 'resolved'")
        resolved_issues = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM complaints")
        total_complaints = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM issues WHERE priority = 'Critical' AND status = 'active'")
        critical_issues = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM issues WHERE priority = 'High' AND status = 'active'")
        high_issues = cursor.fetchone()[0]

        cursor.execute("""
            SELECT department, COUNT(*) as count
            FROM issues
            WHERE status = 'active'
            GROUP BY department
            ORDER BY count DESC
        """)
        departments = [dict(r) for r in cursor.fetchall()]

        cursor.execute("""
            SELECT category, COUNT(*) as count
            FROM issues
            WHERE status = 'active'
            GROUP BY category
            ORDER BY count DESC
        """)
        categories = [dict(r) for r in cursor.fetchall()]

        # Top hotspots
        cursor.execute("""
            SELECT location, SUM(complaint_count) as total_reports
            FROM issues
            WHERE status = 'active' AND location != 'Not specified'
            GROUP BY location
            ORDER BY total_reports DESC
            LIMIT 5
        """)
        hotspots = [dict(r) for r in cursor.fetchall()]

    total_issues = active_issues + resolved_issues
    return {
        "total_issues": total_issues,
        "active_issues": active_issues,
        "resolved_issues": resolved_issues,
        "total_complaints": total_complaints,
        "critical_issues": critical_issues,
        "critical_priority_issues": critical_issues,
        "high_issues": high_issues,
        "high_priority_issues": high_issues,
        "citizens_participating": max(total_complaints, 1),
        "departments": departments,
        "categories": categories,
        "hotspots": hotspots,
        "top_hotspots": [{"location": h["location"], "count": h["total_reports"]} for h in hotspots],
        "by_department": {d["department"]: d["count"] for d in departments},
        "by_category": {c["category"]: c["count"] for c in categories}
    }

@app.get("/api/search")
async def global_search(q: str = Query(..., min_length=1)):
    """Search across master issues, complaint texts, locations, and departments."""
    term = f"%{q.strip()}%"
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, title, category, priority, department, location, complaint_count, status, updated_at
            FROM issues
            WHERE title LIKE ? OR description LIKE ? OR location LIKE ? OR department LIKE ? OR category LIKE ?
            ORDER BY complaint_count DESC
            LIMIT 15
        """, (term, term, term, term, term))
        issue_matches = [dict(r) for r in cursor.fetchall()]

        cursor.execute("""
            SELECT c.id, c.tracking_id, c.text, c.location, c.department, c.issue_id, i.title as issue_title
            FROM complaints c
            JOIN issues i ON c.issue_id = i.id
            WHERE c.text LIKE ? OR c.tracking_id LIKE ? OR c.location LIKE ?
            ORDER BY c.created_at DESC
            LIMIT 15
        """, (term, term, term))
        complaint_matches = [dict(r) for r in cursor.fetchall()]

    return {
        "query": q,
        "issues": issue_matches,
        "complaints": complaint_matches
    }

@app.post("/api/seed")
async def seed_demo_data():
    """
    Deterministically populate the platform with 12 realistic civic issues
    across all 6 departments for the Accountability Desk live demonstration.
    Suppresses real email dispatch.
    """
    with get_db_connection() as conn:
        result = seed_accountability_desk_data(conn)
    return result

# =====================================================================
# Backward Compatibility Endpoints
# =====================================================================

@app.post("/api/analyze-complaint")
async def analyze_complaint(request: ComplaintRequest):
    analysis = await analyze_complaint_ai(request.complaint.strip())
    return {
        "category": analysis["category"],
        "priority": analysis["priority"],
        "department": analysis["department"],
        "location": analysis["location"],
        "summary": analysis["summary"]
    }

@app.post("/api/similarity")
async def calculate_similarity(request: SimilarityRequest):
    text_a = request.complaint_a.strip()
    text_b = request.complaint_b.strip()
    if not text_a or not text_b:
        raise HTTPException(status_code=400, detail="Both complaints are required.")

    payload = {"model": OLLAMA_EMBED_MODEL, "input": [text_a, text_b]}
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            res = await client.post(OLLAMA_EMBED_URL, json=payload)
        data = res.json()
        embeddings = data.get("embeddings", [])
        score = round(calculate_cosine_similarity(embeddings[0], embeddings[1]), 4)
        is_rel = score >= SIMILARITY_THRESHOLD

        dist_km = calculate_distance_km(request.lat_a, request.lon_a, request.lat_b, request.lon_b)
        is_cluster_match, is_geo_match, match_reason = evaluate_cluster_match(score, dist_km)

        return {
            "similarity_score": score,
            "is_related": is_rel,
            "distance_km": round(dist_km, 2) if dist_km is not None else None,
            "is_cluster_match": is_cluster_match,
            "geographic_match": is_geo_match,
            "match_reason": match_reason,
            "message": match_reason
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=False)
