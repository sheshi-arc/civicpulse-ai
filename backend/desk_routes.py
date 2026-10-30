import os
import shutil
import uuid
import sqlite3
from datetime import datetime
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Request, Response, HTTPException, Depends, UploadFile, File, Form, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from config import DB_PATH, PUBLIC_BASE_URL, DEMO_MODE
from token_service import verify_action_token
from desk_service import log_desk_event
from review_service import record_citizen_review, recalculate_department_trust_score, get_department_ai_digest
from resolution_service import process_issue_resolution
from email_service import send_email

router = APIRouter(tags=["Accountability Desk"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

def _get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# =====================================================================
# 1. Magic Link Action Endpoints (Inbox Native)
# =====================================================================

@router.get("/desk/action/{token}")
async def handle_desk_action(token: str):
    """
    Officer one-click action from Gmail:
    - accept: changes desk_status to ACKNOWLEDGED, sets ack_at, notifies citizens
    - assign: changes desk_status to IN_PROGRESS
    - needs_info: changes desk_status to NEEDS_INFO
    Redirects to polished Next.js confirmation page.
    """
    try:
        payload = verify_action_token(token, mark_used=False)
    except ValueError as e:
        return RedirectResponse(url=f"{PUBLIC_BASE_URL}/desk/action?error={str(e)}")

    issue_id = payload["issue_id"]
    action = payload["action"]
    officer_email = payload["email"]
    now = datetime.utcnow().isoformat()

    status_map = {
        "accept": "ACKNOWLEDGED",
        "assign": "IN_PROGRESS",
        "needs_info": "NEEDS_INFO"
    }
    new_status = status_map.get(action, "ACKNOWLEDGED")

    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT i.*, d.name as dept_name FROM issues i LEFT JOIN departments d ON i.department_id = d.id WHERE i.id = ?", (issue_id,))
        issue = cursor.fetchone()
        if not issue:
            return RedirectResponse(url=f"{PUBLIC_BASE_URL}/desk/action?error=Issue+not+found")

        dept_name = issue["dept_name"] or "Municipal Authority"

        # Update issue status
        if action == "accept":
            cursor.execute("""
                UPDATE issues
                SET desk_status = ?, ack_at = COALESCE(ack_at, ?), assigned_officer_email = ?, updated_at = ?
                WHERE id = ?
            """, (new_status, now, officer_email, now, issue_id))
        else:
            cursor.execute("""
                UPDATE issues
                SET desk_status = ?, updated_at = ?
                WHERE id = ?
            """, (new_status, now, issue_id))
        conn.commit()

        # Log desk_event
        log_desk_event(
            issue_id=issue_id,
            event_type="ACKNOWLEDGED" if action == "accept" else action.upper(),
            actor=officer_email,
            detail={
                "action": action,
                "officer_email": officer_email,
                "new_status": new_status,
                "timestamp": now
            }
        )

        # On acceptance: email citizens a short update
        if action == "accept":
            cursor.execute("SELECT citizen_email FROM complaints WHERE issue_id = ?", (issue_id,))
            emails = [r[0] for r in cursor.fetchall() if r[0] and "@" in r[0]]
            for c_email in set(emails):
                send_email(
                    to=c_email,
                    subject=f"Update: {dept_name} has accepted your report #{issue_id}",
                    html=f"""
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 500px;">
                      <h3 style="color: #0f172a; margin-top:0;">Your issue has been assigned</h3>
                      <p style="color: #334155; font-size: 14px;"><strong>{dept_name}</strong> has officially accepted responsibility for Master Issue #{issue_id}: <em>{issue['title']}</em>.</p>
                      <p style="color: #64748b; font-size: 13px;">Desk Officer: {officer_email}</p>
                      <a href="{PUBLIC_BASE_URL}/track" style="display:inline-block; padding: 10px 18px; background-color: #2563eb; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 13px;">View Live Timeline &rarr;</a>
                    </div>
                    """,
                    text=f"Your issue #{issue_id} has been accepted by {dept_name}.",
                    issue_id=issue_id,
                    template="citizen_accepted_update"
                )

    return RedirectResponse(
        url=f"{PUBLIC_BASE_URL}/desk/action?status=success&issue_id={issue_id}&action={action}&officer={officer_email}"
    )

@router.get("/desk/resolve/{token}")
async def handle_desk_resolve_view(token: str):
    """
    Officer clicks [Mark Resolved] in email:
    Redirects to Next.js form page with token where after-photo & note are uploaded.
    """
    try:
        verify_action_token(token, mark_used=False)
    except ValueError as e:
        return RedirectResponse(url=f"{PUBLIC_BASE_URL}/desk/resolve?error={str(e)}")

    return RedirectResponse(url=f"{PUBLIC_BASE_URL}/desk/resolve?token={token}")

@router.post("/api/desk/resolve")
async def api_desk_resolve(
    token: str = Form(...),
    note: str = Form(...),
    after_photo: UploadFile = File(...)
):
    """
    Submit Proof-of-Fix:
    - Validates token (must be 'resolve' action, single use)
    - Validates image content type & size <= 5MB
    - Validates note >= 10 chars
    - Saves photo, generates AI Resolution Receipt, emails all complainants
    """
    # 1. Verify token
    try:
        payload = verify_action_token(token, mark_used=True)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if payload.get("action") not in ["resolve", "admin_resolve"]:
        raise HTTPException(status_code=400, detail="Invalid action for resolution endpoint")

    issue_id = payload["issue_id"]
    officer_email = payload["email"]

    # 2. Validate note
    clean_note = note.strip()
    if len(clean_note) < 10:
        raise HTTPException(status_code=400, detail="Resolution note must be at least 10 characters describing the fix.")

    # 3. Validate image upload
    if not after_photo.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded proof must be a valid image file (JPEG, PNG, WebP).")

    contents = await after_photo.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Photo proof exceeds maximum allowed size of 5MB.")

    ext = os.path.splitext(after_photo.filename or "")[1].lower() or ".jpg"
    filename = f"proof_{issue_id}_{uuid.uuid4().hex[:8]}{ext}"
    dest_path = os.path.join(UPLOAD_DIR, filename)

    with open(dest_path, "wb") as f:
        f.write(contents)

    proof_photo_url = f"/uploads/{filename}"

    # 4. Trigger full resolution workflow
    result = await process_issue_resolution(
        issue_id=issue_id,
        proof_photo_url=proof_photo_url,
        resolution_note=clean_note,
        actor_email=officer_email
    )

    return result

# =====================================================================
# 2. Citizen Magic Review Endpoints
# =====================================================================

@router.get("/review/{token}")
async def handle_citizen_review_magic(
    token: str,
    rating: Optional[int] = Query(None),
    still_broken: Optional[int] = Query(0)
):
    """
    Citizen clicks 1-5 star magic link or red 'still broken' button from email.
    If rating or still_broken param is present, record immediately and redirect to landing page.
    """
    try:
        payload = verify_action_token(token, mark_used=False)
    except ValueError as e:
        return RedirectResponse(url=f"{PUBLIC_BASE_URL}/review?error={str(e)}")

    issue_id = payload["issue_id"]
    citizen_email = payload["email"]
    complaint_id = payload.get("complaint_id")

    recorded = 0
    if rating is not None or still_broken == 1:
        is_broken = (still_broken == 1)
        r_val = 1 if is_broken else (rating or 5)
        record_citizen_review(
            issue_id=issue_id,
            citizen_email=citizen_email,
            rating=r_val,
            comment="Submitted via 1-click email verdict." if not is_broken else "Marked still broken via email.",
            still_broken=is_broken,
            complaint_id=complaint_id
        )
        recorded = 1

    query_params = f"token={token}&issue_id={issue_id}&email={citizen_email}&recorded={recorded}"
    if rating is not None:
        query_params += f"&rating={rating}"
    if still_broken:
        query_params += f"&still_broken={still_broken}"

    return RedirectResponse(url=f"{PUBLIC_BASE_URL}/review?{query_params}")

class ReviewSubmission(BaseModel):
    token: str
    rating: int
    comment: Optional[str] = ""
    still_broken: bool = False

@router.post("/api/review/submit")
async def submit_review_detailed(req: ReviewSubmission):
    """Detailed citizen review submission with optional written comment."""
    try:
        payload = verify_action_token(req.token, mark_used=False)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    issue_id = payload["issue_id"]
    citizen_email = payload["email"]
    complaint_id = payload.get("complaint_id")

    res = record_citizen_review(
        issue_id=issue_id,
        citizen_email=citizen_email,
        rating=req.rating,
        comment=req.comment,
        still_broken=req.still_broken,
        complaint_id=complaint_id
    )
    return res

# =====================================================================
# 3. Department Desks & Public Leaderboard Endpoints
# =====================================================================

@router.get("/api/departments")
async def get_departments_list():
    """List all departments with live stats, Trust Score, and desk officer email chips."""
    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM departments ORDER BY trust_score DESC, name ASC")
        departments = [dict(r) for r in cursor.fetchall()]

        results = []
        for d in departments:
            dept_id = d["id"]
            cursor.execute("SELECT COUNT(*) FROM issues WHERE department_id = ?", (dept_id,))
            total_issues = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM issues WHERE department_id = ? AND desk_status != 'CLOSED'", (dept_id,))
            open_count = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM issues WHERE department_id = ? AND escalation_level >= 1 AND desk_status != 'CLOSED'", (dept_id,))
            overdue_count = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM issues WHERE department_id = ? AND reopen_count > 0", (dept_id,))
            reopened_count = cursor.fetchone()[0]

            cursor.execute("""
                SELECT AVG(r.rating), COUNT(r.id)
                FROM reviews r
                JOIN issues i ON r.issue_id = i.id
                WHERE i.department_id = ?
            """, (dept_id,))
            rev_row = cursor.fetchone()
            avg_rating = round(rev_row[0], 2) if rev_row[0] else 4.2
            review_count = rev_row[1] or 0

            results.append({
                **d,
                "total_issues": total_issues,
                "open_count": open_count,
                "overdue_count": overdue_count,
                "reopened_count": reopened_count,
                "average_rating": avg_rating,
                "review_count": review_count
            })

    return {"success": True, "departments": results}

@router.get("/api/departments/scorecard")
async def get_departments_scorecard():
    """Detailed Trust Scorecard with formula breakdown for /accountability public leaderboard."""
    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM departments ORDER BY trust_score DESC")
        departments = [dict(r) for r in cursor.fetchall()]

        scorecards = []
        for rank, d in enumerate(departments, 1):
            dept_id = d["id"]
            cursor.execute("SELECT COUNT(*) FROM issues WHERE department_id = ?", (dept_id,))
            total = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM issues WHERE department_id = ? AND desk_status = 'CLOSED'", (dept_id,))
            closed = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM issues WHERE department_id = ? AND reopen_count > 0", (dept_id,))
            reopened = cursor.fetchone()[0]
            cursor.execute("""
                SELECT AVG(r.rating)
                FROM reviews r
                JOIN issues i ON r.issue_id = i.id
                WHERE i.department_id = ?
            """, (dept_id,))
            avg_stars = round(cursor.fetchone()[0] or 4.0, 1)

            reopen_rate = round((reopened / max(1, total)) * 100, 1)

            scorecards.append({
                "rank": rank,
                "slug": d["slug"],
                "name": d["name"],
                "desk_email": d["desk_email"],
                "trust_score": d["trust_score"],
                "total_issues": total,
                "closed_issues": closed,
                "reopened_issues": reopened,
                "reopen_rate_percent": reopen_rate,
                "citizen_satisfaction_stars": avg_stars,
                "sla_ack_minutes": d["sla_ack_minutes"],
                "sla_resolve_hours": d["sla_resolve_hours"]
            })

    return {
        "success": True,
        "tagline": "Every fix verified by the citizens who reported it.",
        "scorecards": scorecards
    }

@router.get("/api/departments/{slug}/digest")
async def get_department_digest_endpoint(slug: str):
    """AI Review Digest summarizing recent feedback."""
    digest = await get_department_ai_digest(slug)
    return {"success": True, "slug": slug, "digest": digest}

@router.get("/api/issues/{issue_id}/timeline")
async def get_issue_timeline(issue_id: int):
    """Audit timeline of all desk_events for issue vertical stepper."""
    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM desk_events WHERE issue_id = ? ORDER BY id ASC", (issue_id,))
        events = []
        for r in cursor.fetchall():
            item = dict(r)
            try:
                item["detail"] = json.loads(item["detail_json"]) if item.get("detail_json") else {}
            except Exception:
                item["detail"] = {}
            events.append(item)

        cursor.execute("SELECT * FROM issues WHERE id = ?", (issue_id,))
        issue_row = cursor.fetchone()
        issue = dict(issue_row) if issue_row else None

    return {
        "success": True,
        "issue_id": issue_id,
        "issue": issue,
        "events": events
    }

@router.get("/api/admin/desk-events")
async def get_accountability_ledger(limit: int = 50):
    """Live feed of desk_events for the /admin 'Accountability Ledger' tab."""
    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT e.*, i.title as issue_title, i.priority as issue_priority, d.name as dept_name
            FROM desk_events e
            LEFT JOIN issues i ON e.issue_id = i.id
            LEFT JOIN departments d ON i.department_id = d.id
            ORDER BY e.id DESC LIMIT ?
        """, (limit,))
        rows = [dict(r) for r in cursor.fetchall()]
        
        for r in rows:
            try:
                r["detail"] = json.loads(r["detail_json"]) if r.get("detail_json") else {}
            except Exception:
                r["detail"] = {}

    return {"success": True, "events": rows}
