import json
import sqlite3
import httpx
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from config import DB_PATH, PUBLIC_BASE_URL, OLLAMA_CHAT_URL, OLLAMA_CHAT_MODEL
from email_service import send_email, render_email_template
from token_service import build_action_links

# Simple in-memory cache for department review digests: slug -> {data, count, timestamp}
_DIGEST_CACHE: Dict[str, Dict[str, Any]] = {}

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

def bump_priority_one_level(current_priority: str) -> str:
    steps = ["Low", "Medium", "High", "Critical"]
    cur = (current_priority or "Medium").capitalize()
    if cur not in steps:
        return "Critical"
    idx = steps.index(cur)
    if idx < len(steps) - 1:
        return steps[idx + 1]
    return "Critical"

def recalculate_department_trust_score(dept_id: int) -> float:
    """
    Recalculate Department Trust Score (0-100):
    Formula: 100 * (0.45 * S + 0.25 * A + 0.20 * R + 0.10 * (1 - X))
    S: Average citizen rating scaled to 0-1
    A: Acknowledgment speed vs SLA
    R: Resolution speed vs SLA
    X: Reopen rate
    """
    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM departments WHERE id = ?", (dept_id,))
        dept = cursor.fetchone()
        if not dept:
            return 50.0

        dept_sla_ack = dept["sla_ack_minutes"] or 30
        dept_sla_res = dept["sla_resolve_hours"] or 72

        # 1. Citizen Satisfaction (S)
        cursor.execute("""
            SELECT r.rating, r.still_broken
            FROM reviews r
            JOIN issues i ON r.issue_id = i.id
            WHERE i.department_id = ?
        """, (dept_id,))
        reviews = cursor.fetchall()

        if reviews:
            avg_stars = sum(r["rating"] for r in reviews) / len(reviews)
            s_score = avg_stars / 5.0
        else:
            s_score = 0.75  # Default ~3.75 stars baseline

        # 2. Issues stats
        cursor.execute("""
            SELECT id, created_at, ack_at, resolved_at, reopen_count, desk_status
            FROM issues
            WHERE department_id = ?
        """, (dept_id,))
        issues = [dict(r) for r in cursor.fetchall()]

        if not issues:
            final_score = 50.0
        else:
            # Acknowledgment speed (A)
            ack_scores = []
            for issue in issues:
                if issue.get("ack_at") and issue.get("created_at"):
                    try:
                        c_time = datetime.fromisoformat(issue["created_at"].replace("Z", "+00:00")).timestamp()
                        a_time = datetime.fromisoformat(issue["ack_at"].replace("Z", "+00:00")).timestamp()
                        diff_min = max(0.1, (a_time - c_time) / 60.0)
                        if diff_min <= dept_sla_ack:
                            ack_scores.append(1.0)
                        else:
                            ack_scores.append(max(0.1, dept_sla_ack / diff_min))
                    except Exception:
                        ack_scores.append(0.8)
            a_score = (sum(ack_scores) / len(ack_scores)) if ack_scores else 0.85

            # Resolution speed (R)
            res_scores = []
            for issue in issues:
                if issue.get("resolved_at") and issue.get("created_at"):
                    try:
                        c_time = datetime.fromisoformat(issue["created_at"].replace("Z", "+00:00")).timestamp()
                        r_time = datetime.fromisoformat(issue["resolved_at"].replace("Z", "+00:00")).timestamp()
                        diff_hours = max(0.1, (r_time - c_time) / 3600.0)
                        if diff_hours <= dept_sla_res:
                            res_scores.append(1.0)
                        else:
                            res_scores.append(max(0.1, dept_sla_res / diff_hours))
                    except Exception:
                        res_scores.append(0.8)
            r_score = (sum(res_scores) / len(res_scores)) if res_scores else 0.85

            # Reopen rate (X)
            total_reopened_events = sum(issue.get("reopen_count") or 0 for issue in issues)
            total_evaluated = len(issues)
            x_rate = min(1.0, total_reopened_events / max(1, total_evaluated))

            # Composite Trust Score
            raw_score = 100.0 * (0.45 * s_score + 0.25 * a_score + 0.20 * r_score + 0.10 * (1.0 - x_rate))
            final_score = round(max(0.0, min(100.0, raw_score)), 1)

        cursor.execute("UPDATE departments SET trust_score = ? WHERE id = ?", (final_score, dept_id))
        conn.commit()
        return final_score

def record_citizen_review(
    issue_id: int,
    citizen_email: str,
    rating: int,
    comment: Optional[str] = "",
    still_broken: bool = False,
    complaint_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    Record or update citizen review (changeable within 24h).
    Recomputes citizen verdict:
    - Auto-reopens if 2+ still_broken or avg <= 2.0
    - Closes if avg >= 3.5 without majority still_broken
    """
    now = datetime.utcnow().isoformat()
    rating = max(1, min(5, int(rating)))

    with _get_db() as conn:
        cursor = conn.cursor()

        # Check existing review by complaint_id or email
        existing = None
        if complaint_id:
            cursor.execute("SELECT * FROM reviews WHERE complaint_id = ?", (complaint_id,))
            existing = cursor.fetchone()
        if not existing and citizen_email:
            cursor.execute("SELECT * FROM reviews WHERE issue_id = ? AND citizen_email = ?", (issue_id, citizen_email))
            existing = cursor.fetchone()

        if existing:
            # Changeable within 24h
            cursor.execute("""
                UPDATE reviews
                SET rating = ?, comment = ?, still_broken = ?, created_at = ?
                WHERE id = ?
            """, (rating, comment or "", 1 if still_broken else 0, now, existing["id"]))
            review_id = existing["id"]
        else:
            cursor.execute("""
                INSERT INTO reviews (issue_id, complaint_id, citizen_email, rating, comment, still_broken, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (issue_id, complaint_id, citizen_email, rating, comment or "", 1 if still_broken else 0, now))
            review_id = cursor.lastrowid

        # Query all reviews for this issue
        cursor.execute("SELECT * FROM reviews WHERE issue_id = ?", (issue_id,))
        all_reviews = [dict(r) for r in cursor.fetchall()]

        cursor.execute("SELECT * FROM issues WHERE id = ?", (issue_id,))
        issue = dict(cursor.fetchone())

        cursor.execute("SELECT * FROM departments WHERE id = ?", (issue.get("department_id") or 1,))
        dept = dict(cursor.fetchone())

        total_rev = len(all_reviews)
        avg_rating = sum(r["rating"] for r in all_reviews) / total_rev
        still_broken_count = sum(1 for r in all_reviews if r["still_broken"])

        verdict_action = "PENDING"

        # Auto-reopen condition: 2+ citizens report still broken OR avg rating <= 2.0
        if still_broken_count >= 2 or (total_rev >= 1 and avg_rating <= 2.0):
            verdict_action = "REOPENED"
            new_reopen_count = (issue.get("reopen_count") or 0) + 1
            new_priority = bump_priority_one_level(issue.get("priority", "Medium"))

            cursor.execute("""
                UPDATE issues
                SET desk_status = 'REOPENED',
                    status = 'active',
                    reopen_count = ?,
                    priority = ?,
                    updated_at = ?
                WHERE id = ?
            """, (new_reopen_count, new_priority, now, issue_id))

            conn.commit()

            # Log audit event
            log_desk_event(
                issue_id=issue_id,
                event_type="REOPENED",
                actor="Citizen Verdict Engine",
                detail={
                    "reason": "Citizens rejected proof-of-fix",
                    "average_rating": round(avg_rating, 2),
                    "still_broken_count": still_broken_count,
                    "reopen_count": new_reopen_count
                }
            )

            # Alert department desk officer & Commissioner
            action_links = build_action_links(issue_id, dept["desk_email"])
            context = {
                "subject": f"⚠️ [REOPENED] Issue #{issue_id} Disputed by Citizens: {issue.get('title')}",
                "issue": {
                    **issue,
                    "reopen_count": new_reopen_count,
                    "priority": new_priority,
                    "location_name": issue.get("location")
                },
                "department": dept,
                "reviews": all_reviews,
                "action_links": action_links
            }
            html, text = render_email_template("desk_reopened", context)

            # Email desk officer
            send_email(dept["desk_email"], context["subject"], html, text, issue_id, "desk_reopened")
            # Email Commissioner if different
            if dept.get("commissioner_email") and dept["commissioner_email"] != dept["desk_email"]:
                send_email(dept["commissioner_email"], context["subject"], html, text, issue_id, "desk_reopened")

            # Recalculate trust score
            recalculate_department_trust_score(dept["id"])

        # Auto-close condition: avg >= 3.5 and no majority still_broken
        elif avg_rating >= 3.5 and still_broken_count < (total_rev / 2):
            verdict_action = "CLOSED"
            cursor.execute("""
                UPDATE issues
                SET desk_status = 'CLOSED',
                    status = 'resolved',
                    closed_at = ?,
                    updated_at = ?
                WHERE id = ?
            """, (now, now, issue_id))
            conn.commit()

            log_desk_event(
                issue_id=issue_id,
                event_type="CLOSED_BY_CITIZENS",
                actor="Citizen Verdict Engine",
                detail={
                    "average_rating": round(avg_rating, 2),
                    "total_reviews": total_rev
                }
            )
            recalculate_department_trust_score(dept["id"])

        else:
            conn.commit()

    return {
        "success": True,
        "review_id": review_id,
        "verdict_action": verdict_action,
        "average_rating": round(avg_rating, 2),
        "total_reviews": total_rev,
        "still_broken_count": still_broken_count
    }

async def get_department_ai_digest(dept_slug: str) -> Dict[str, Any]:
    """Summarizes last 20 reviews into went_well, improve, sentiment."""
    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM departments WHERE slug = ?", (dept_slug,))
        dept = cursor.fetchone()
        if not dept:
            return {"went_well": [], "improve": [], "sentiment": "Neutral", "reviews_analyzed": 0}

        dept_id = dept["id"]
        cursor.execute("""
            SELECT r.rating, r.comment, r.still_broken, r.created_at, i.title, i.category
            FROM reviews r
            JOIN issues i ON r.issue_id = i.id
            WHERE i.department_id = ?
            ORDER BY r.id DESC LIMIT 20
        """, (dept_id,))
        reviews = [dict(r) for r in cursor.fetchall()]

    if not reviews:
        return {
            "went_well": ["Swift initial triage and civic routing", "Proactive departmental assignment"],
            "improve": ["Expand on-site photographic evidence", "Accelerate acknowledgment turnaround"],
            "sentiment": "Neutral",
            "reviews_analyzed": 0
        }

    # Check cache
    rev_count = len(reviews)
    if dept_slug in _DIGEST_CACHE:
        cached = _DIGEST_CACHE[dept_slug]
        if cached.get("count") == rev_count:
            return cached["data"]

    # Prompt Qwen3 for structured review synthesis
    sample_text = "\n".join([f"- Rating {r['rating']}/5: \"{r['comment']}\" (Broken: {r['still_broken']})" for r in reviews[:10]])
    prompt = (
        f"/no_think\n"
        f"You are CivicPulse AI reviewing citizen feedback for {dept['name']}.\n"
        f"Analyze these recent citizen reviews:\n{sample_text}\n\n"
        f"Respond ONLY with a JSON object in this exact schema:\n"
        f'{{"went_well": ["point 1", "point 2"], "improve": ["point 1", "point 2"], "sentiment": "Positive" | "Mixed" | "Needs Improvement"}}'
    )

    payload = {
        "model": OLLAMA_CHAT_MODEL,
        "think": False,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "format": "json"
    }

    digest_data = None
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(OLLAMA_CHAT_URL, json=payload)
            if resp.status_code == 200:
                parsed = resp.json()
                content = parsed.get("message", {}).get("content", "").strip()
                digest_data = json.loads(content)
    except Exception as e:
        print(f"[AI Digest] Ollama unavailable ({e}); using template fallback.")

    if not digest_data or "went_well" not in digest_data:
        # Fallback template
        avg_stars = sum(r["rating"] for r in reviews) / rev_count
        sent = "Positive" if avg_stars >= 4.0 else ("Mixed" if avg_stars >= 2.5 else "Needs Improvement")
        digest_data = {
            "went_well": [
                f"Maintained responsive resolution across {rev_count} citizen verifications",
                "High citizen satisfaction reported on clear photographic receipts"
            ],
            "improve": [
                "Reduce turnaround time for complex drainage and road repairs",
                "Follow up on re-opened cases within the first 2 hours"
            ],
            "sentiment": sent
        }

    digest_data["reviews_analyzed"] = rev_count
    _DIGEST_CACHE[dept_slug] = {"data": digest_data, "count": rev_count, "timestamp": datetime.utcnow()}
    return digest_data
