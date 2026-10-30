import os
import json
import sqlite3
import httpx
from datetime import datetime
from typing import Optional, Dict, Any, List
from config import DB_PATH, PUBLIC_BASE_URL, OLLAMA_CHAT_URL, OLLAMA_CHAT_MODEL
from email_service import send_email, render_email_template
from token_service import build_review_links

def _get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def log_desk_event(issue_id: int, event_type: str, actor: str, detail: Dict[str, Any]):
    try:
        with _get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO desk_events (issue_id, event_type, actor, detail_json, created_at)
                VALUES (?, ?, ?, ?, ?)
            """, (issue_id, event_type, actor, json.dumps(detail), datetime.utcnow().isoformat()))
            conn.commit()
    except Exception as e:
        print(f"[DeskEvent Error] {e}")

async def generate_resolution_receipt_ai(issue_title: str, department_name: str, resolution_note: str) -> str:
    """Ask Qwen3 for a 3-4 sentence plain-language receipt for citizens; fall back safely."""
    date_str = datetime.utcnow().strftime("%B %d, %Y")
    fallback = (
        f"The {department_name} has completed corrective work regarding {issue_title} as of {date_str}. "
        f"Field crews reported: {resolution_note}. "
        f"Photographic proof of the completed work has been verified by the municipal desk. "
        f"Citizens who reported this issue are now invited to confirm that the site is fully restored."
    )

    prompt = (
        f"/no_think\n"
        f"You are CivicPulse AI generating a formal Resolution Receipt for citizens.\n"
        f"Department: {department_name}\n"
        f"Issue: {issue_title}\n"
        f"Officer Note: {resolution_note}\n\n"
        f"Write exactly 3 to 4 plain-language sentences explaining clearly what was repaired, by which department, and inviting citizens to verify. "
        f"Use no bureaucratic jargon and do not invent any facts not present above. Respond with plain text only."
    )

    payload = {
        "model": OLLAMA_CHAT_MODEL,
        "think": False,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(OLLAMA_CHAT_URL, json=payload)
            if resp.status_code == 200:
                parsed = resp.json()
                content = parsed.get("message", {}).get("content", "").strip()
                if content and len(content) > 30:
                    return content
    except Exception as e:
        print(f"[AI Receipt] Ollama unavailable ({e}); using fallback.")

    return fallback

async def process_issue_resolution(
    issue_id: int,
    proof_photo_url: str,
    resolution_note: str,
    actor_email: str
) -> Dict[str, Any]:
    """
    Executes the proof-of-fix resolution workflow:
    1. Update issue state: desk_status = 'RESOLVED_PENDING_REVIEW', proof_photo_url, note, resolved_at.
    2. Generate Qwen3 AI Resolution Receipt.
    3. Log desk_event 'RESOLVED'.
    4. Email every merged complainant with unique review magic links.
    """
    now = datetime.utcnow().isoformat()

    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM issues WHERE id = ?", (issue_id,))
        issue_row = cursor.fetchone()
        if not issue_row:
            raise ValueError(f"Issue #{issue_id} not found")
        issue = dict(issue_row)

        cursor.execute("SELECT * FROM departments WHERE id = ?", (issue.get("department_id") or 1,))
        dept_row = cursor.fetchone()
        dept = dict(dept_row) if dept_row else {"name": "Public Works Department", "desk_email": actor_email}

        # Step 2: Generate Qwen3 AI Resolution Receipt
        receipt = await generate_resolution_receipt_ai(
            issue.get("title", "Civic Problem"),
            dept.get("name", "Municipal Authority"),
            resolution_note
        )

        cursor.execute("""
            UPDATE issues
            SET desk_status = 'RESOLVED_PENDING_REVIEW',
                proof_photo_url = ?,
                resolution_note = ?,
                resolution_receipt = ?,
                resolved_at = ?,
                updated_at = ?
            WHERE id = ?
        """, (proof_photo_url, resolution_note, receipt, now, now, issue_id))

        # Query all complaints linked to this issue
        cursor.execute("SELECT id, citizen_email, photo_url, text FROM complaints WHERE issue_id = ?", (issue_id,))
        complaints = [dict(r) for r in cursor.fetchall()]
        conn.commit()

    # Log audit event
    log_desk_event(
        issue_id=issue_id,
        event_type="RESOLVED",
        actor=actor_email or "Desk Officer",
        detail={
            "proof_photo_url": proof_photo_url,
            "resolution_note": resolution_note,
            "resolution_receipt": receipt,
            "complaints_notified_count": len(complaints)
        }
    )

    # Original evidence before photo
    before_photo = issue.get("photo_url") or next((c["photo_url"] for c in complaints if c.get("photo_url")), None)
    if before_photo and not before_photo.startswith("http"):
        before_photo = f"{PUBLIC_BASE_URL}{before_photo}"

    after_photo = proof_photo_url
    if after_photo and not after_photo.startswith("http"):
        after_photo = f"{PUBLIC_BASE_URL}{after_photo}"

    # Step 3: Email every merged citizen who provided an email
    notified_citizens = []
    for c in complaints:
        c_email = c.get("citizen_email")
        if c_email and "@" in c_email:
            rev_links = build_review_links(issue_id, c_email, c["id"])
            context = {
                "subject": f"Was #{issue_id} Fixed? Please verify the completed work on {issue.get('title')}",
                "issue": {
                    **issue,
                    "location_name": issue.get("location")
                },
                "department": dept,
                "resolution_receipt": receipt,
                "before_photo_url": before_photo,
                "after_photo_url": after_photo,
                "review_links": rev_links,
                "complaint_id": c["id"]
            }
            html, text = render_email_template("citizen_resolved_review", context)
            send_email(
                to=c_email,
                subject=context["subject"],
                html=html,
                text=text,
                issue_id=issue_id,
                template="citizen_resolved_review"
            )
            notified_citizens.append(c_email)

    return {
        "success": True,
        "issue_id": issue_id,
        "desk_status": "RESOLVED_PENDING_REVIEW",
        "receipt": receipt,
        "notified_count": len(notified_citizens),
        "notified_emails": notified_citizens
    }
