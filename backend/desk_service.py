import json
import sqlite3
import httpx
from datetime import datetime
from typing import Optional, Dict, Any, List
from config import DB_PATH, PUBLIC_BASE_URL, OLLAMA_CHAT_URL, OLLAMA_CHAT_MODEL, PRIORITY_LEVELS
from db_migrations import category_to_department_slug
from token_service import build_action_links
from email_service import send_email, render_email_template

SURGE_THRESHOLDS = [5, 10, 25, 50, 100]
PRIORITY_STEPS = ["Low", "Medium", "High", "Critical"]

def _get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def log_desk_event(issue_id: int, event_type: str, actor: str, detail: Dict[str, Any]):
    """Record an audit event in desk_events timeline."""
    try:
        with _get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO desk_events (issue_id, event_type, actor, detail_json, created_at)
                VALUES (?, ?, ?, ?, ?)
            """, (issue_id, event_type, actor, json.dumps(detail), datetime.utcnow().isoformat()))
            conn.commit()
    except Exception as e:
        print(f"[DeskEvent Error] Failed to record event {event_type} for issue {issue_id}: {e}")

async def generate_executive_summary_ai(title: str, summary: str, location: str) -> str:
    """Ask Qwen3 for a calm 2-sentence executive summary; fallback safely if unavailable."""
    fallback = f"A civic issue regarding {title} has been logged at {location}. Departmental review and assignment are requested within the standard SLA."
    
    prompt = (
        f"/no_think\n"
        f"Rewrite this civic report into exactly 2 calm, professional, executive-level sentences for a municipal officer:\n"
        f"Issue: {title}\n"
        f"Details: {summary}\n"
        f"Location: {location}\n"
        f"Do not include bullet points, markdown formatting, or introductory greetings. Provide only the 2 sentences."
    )
    
    payload = {
        "model": OLLAMA_CHAT_MODEL,
        "think": False,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False
    }

    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.post(OLLAMA_CHAT_URL, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                content = data.get("message", {}).get("content", "").strip()
                if content and len(content) > 20:
                    return content
    except Exception as e:
        print(f"[AI Exec Summary] Ollama unavailable or timed out ({e}); using fallback.")

    return fallback

def get_department_for_category(category: str, subcategory: str) -> Dict[str, Any]:
    slug = category_to_department_slug(category, subcategory)
    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM departments WHERE slug = ?", (slug,))
        dept = cursor.fetchone()
        if not dept:
            cursor.execute("SELECT * FROM departments WHERE slug = 'public_works'")
            dept = cursor.fetchone()
        return dict(dept)

def bump_priority_one_level(current_priority: str) -> str:
    """Escalate priority one level, never above CRITICAL."""
    cur = (current_priority or "Medium").capitalize()
    if cur not in PRIORITY_STEPS:
        return "Critical"
    idx = PRIORITY_STEPS.index(cur)
    if idx < len(PRIORITY_STEPS) - 1:
        return PRIORITY_STEPS[idx + 1]
    return "Critical"

async def orchestrate_new_issue_workflow(issue_id: int):
    """
    Background worker for newly created Master Issue:
    1. Resolve department & assign.
    2. Set desk_status = 'EMAILED'.
    3. Generate Qwen3 summary.
    4. Render & send 'desk_new_case' email.
    5. Log desk_event 'EMAIL_SENT'.
    """
    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM issues WHERE id = ?", (issue_id,))
        issue_row = cursor.fetchone()
        if not issue_row:
            return
        issue = dict(issue_row)

        dept = get_department_for_category(issue.get("category", ""), issue.get("subcategory", ""))
        
        # Link department and email status
        cursor.execute("""
            UPDATE issues
            SET department_id = ?, desk_status = 'EMAILED', assigned_officer_email = ?
            WHERE id = ?
        """, (dept["id"], dept["desk_email"], issue_id))
        conn.commit()

    # Generate AI executive summary
    exec_summary = await generate_executive_summary_ai(
        issue.get("title", ""),
        issue.get("description", ""),
        issue.get("location", "")
    )

    action_links = build_action_links(issue_id, dept["desk_email"])

    lat = issue.get("latitude") or 17.4435
    lon = issue.get("longitude") or 78.3772
    osm_link = f"https://www.openstreetmap.org/?mlat={lat}&mlon={lon}#map=17/{lat}/{lon}"

    context = {
        "subject": f"[NEW CASE #{issue_id}] {issue.get('title')} ({issue.get('priority')})",
        "issue": {
            "id": issue_id,
            "title": issue.get("title"),
            "category": issue.get("category"),
            "subcategory": issue.get("subcategory"),
            "priority": issue.get("priority", "Medium"),
            "location_name": issue.get("location", "Unspecified"),
            "summary": issue.get("description"),
            "safety_risk": bool(issue.get("safety_risk")),
            "suggested_action": issue.get("suggested_action") or "Immediate on-site investigation and clearance.",
            "urgency_reason": issue.get("urgency_reason") or "Standard SLA applies.",
            "complaint_count": issue.get("complaint_count", 1)
        },
        "department": dept,
        "action_links": action_links,
        "executive_summary": exec_summary,
        "osm_link": osm_link,
        "sla_minutes": dept.get("sla_ack_minutes", 30),
        "photo_url": issue.get("photo_url")
    }

    html, text = render_email_template("desk_new_case", context)
    send_email(
        to=dept["desk_email"],
        subject=context["subject"],
        html=html,
        text=text,
        issue_id=issue_id,
        template="desk_new_case"
    )

    log_desk_event(
        issue_id=issue_id,
        event_type="EMAIL_SENT",
        actor="System",
        detail={
            "to": dept["desk_email"],
            "department": dept["name"],
            "template": "desk_new_case",
            "sla_ack_minutes": dept.get("sla_ack_minutes", 30)
        }
    )

async def orchestrate_merged_issue_workflow(issue_id: int):
    """
    Background worker when an existing Master Issue receives an additional complaint:
    1. Check if complaint count crossed a new surge threshold (5, 10, 25, 50, 100).
    2. If so, raise priority one level (max Critical), update last_surge_threshold.
    3. Render & send 'desk_impact_surge' email.
    4. Log desk_event 'IMPACT_SURGE'.
    """
    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM issues WHERE id = ?", (issue_id,))
        issue_row = cursor.fetchone()
        if not issue_row:
            return
        issue = dict(issue_row)

        count = issue.get("complaint_count", 1)
        last_thresh = issue.get("last_surge_threshold") or 0

        # Find if crossed any threshold > last_thresh
        crossed_threshold = None
        for t in SURGE_THRESHOLDS:
            if count >= t > last_thresh:
                crossed_threshold = t

        if not crossed_threshold:
            return  # No new threshold reached

        old_priority = issue.get("priority", "Medium")
        new_priority = bump_priority_one_level(old_priority)

        cursor.execute("""
            UPDATE issues
            SET last_surge_threshold = ?, priority = ?
            WHERE id = ?
        """, (crossed_threshold, new_priority, issue_id))

        # Fetch recent 3 complaints
        cursor.execute("""
            SELECT text, created_at, tracking_id FROM complaints
            WHERE issue_id = ? ORDER BY id DESC LIMIT 3
        """, (issue_id,))
        recent_complaints = [dict(r) for r in cursor.fetchall()]

        # Department details
        cursor.execute("SELECT * FROM departments WHERE id = ?", (issue.get("department_id") or 1,))
        dept_row = cursor.fetchone()
        dept = dict(dept_row) if dept_row else get_department_for_category(issue.get("category", ""), "")
        conn.commit()

    action_links = build_action_links(issue_id, dept["desk_email"])

    context = {
        "subject": f"[IMPACT SURGE: {crossed_threshold}+ REPORTS] #{issue_id} {issue.get('title')}",
        "issue": {
            "id": issue_id,
            "title": issue.get("title"),
            "category": issue.get("category"),
            "location_name": issue.get("location"),
            "complaint_count": count
        },
        "department": dept,
        "surge_count": count,
        "threshold": crossed_threshold,
        "old_priority": old_priority,
        "new_priority": new_priority,
        "recent_complaints": recent_complaints,
        "action_links": action_links
    }

    html, text = render_email_template("desk_impact_surge", context)
    send_email(
        to=dept["desk_email"],
        subject=context["subject"],
        html=html,
        text=text,
        issue_id=issue_id,
        template="desk_impact_surge"
    )

    log_desk_event(
        issue_id=issue_id,
        event_type="IMPACT_SURGE",
        actor="System",
        detail={
            "threshold": crossed_threshold,
            "complaint_count": count,
            "old_priority": old_priority,
            "new_priority": new_priority,
            "notified": dept["desk_email"]
        }
    )

def send_citizen_receipt_email(to_email: str, tracking_id: str, issue_title: str):
    """Notify citizen of their complaint submission and tracking link."""
    if not to_email or "@" not in to_email:
        return
    
    track_url = f"{PUBLIC_BASE_URL}/track?id={tracking_id}"
    subject = f"Complaint Received: {tracking_id} — CivicPulse AI"
    html = f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
      <h2 style="color: #0f172a; margin-top: 0;">Your civic complaint has been registered</h2>
      <p style="color: #334155; font-size: 14px;">Thank you for contributing to your city. Your report has been clustered into Master Issue: <strong>{issue_title}</strong>.</p>
      <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <div style="font-size: 12px; color: #64748b;">YOUR TRACKING ID</div>
        <div style="font-size: 20px; font-weight: 800; color: #2563eb;">{tracking_id}</div>
      </div>
      <p style="font-size: 13px; color: #475569;">You will receive another update when the department accepts and subsequently resolves this issue with proof of fix.</p>
      <div style="margin-top: 20px;">
        <a href="{track_url}" style="display: inline-block; background-color: #0f172a; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 700; font-size: 13px;">Track Progress Live &rarr;</a>
      </div>
    </div>
    """
    text = f"Your civic complaint has been received. Tracking ID: {tracking_id}. Track at: {track_url}"
    send_email(to=to_email, subject=subject, html=html, text=text, template="citizen_receipt")
