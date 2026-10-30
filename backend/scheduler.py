import json
import sqlite3
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger

from config import (
    DEMO_MODE,
    DB_PATH,
    PUBLIC_BASE_URL,
    SLA_ACK_MINUTES_DEFAULT,
    SLA_RESOLVE_HOURS_DEFAULT
)
from email_service import send_email, render_email_template
from token_service import build_action_links

scheduler = AsyncIOScheduler()

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

async def check_sla_escalations():
    """
    SLA Escalation Ladder Checker:
    1. Unacknowledged past 1x SLA: reminder to desk officer (escalation_level -> 1)
    2. Still unacknowledged past 2x SLA: escalate to Head & Commissioner + priority bump (escalation_level -> 2)
    3. In progress past resolve SLA: overdue escalation (escalation_level -> 3)
    4. Pending review > 7 days with no citizen dispute: auto-close
    """
    now = datetime.utcnow()

    with _get_db() as conn:
        cursor = conn.cursor()
        
        # 1 & 2: Check unacknowledged issues in 'EMAILED' status
        cursor.execute("""
            SELECT i.*, d.name as dept_name, d.desk_email, d.head_email, d.commissioner_email,
                   d.sla_ack_minutes, d.sla_resolve_hours
            FROM issues i
            JOIN departments d ON i.department_id = d.id
            WHERE i.desk_status = 'EMAILED' AND i.ack_at IS NULL
        """)
        emailed_issues = [dict(r) for r in cursor.fetchall()]

        for issue in emailed_issues:
            created_str = issue.get("created_at")
            if not created_str:
                continue
            try:
                created_dt = datetime.fromisoformat(created_str.replace("Z", "+00:00")).replace(tzinfo=None)
            except Exception:
                continue

            elapsed_minutes = (now - created_dt).total_seconds() / 60.0
            sla_ack = issue.get("sla_ack_minutes") or SLA_ACK_MINUTES_DEFAULT
            cur_level = issue.get("escalation_level") or 0

            # Level 2 Escalation (elapsed >= 2 * sla_ack)
            if elapsed_minutes >= (2.0 * sla_ack) and cur_level < 2:
                old_p = issue.get("priority", "Medium")
                new_p = bump_priority_one_level(old_p)
                
                cursor.execute("""
                    UPDATE issues
                    SET escalation_level = 2, priority = ?, updated_at = ?
                    WHERE id = ?
                """, (new_p, now.isoformat(), issue["id"]))
                conn.commit()

                # Action links for head/commissioner
                links = build_action_links(issue["id"], issue["head_email"])
                context = {
                    "subject": f"🚨 [COMMISSIONER ESCALATION] #{issue['id']} Unacknowledged for {int(elapsed_minutes)}m: {issue.get('title')}",
                    "issue": {
                        **issue,
                        "priority": new_p,
                        "location_name": issue.get("location")
                    },
                    "department": {"name": issue["dept_name"]},
                    "elapsed_minutes": int(elapsed_minutes),
                    "sla_minutes": sla_ack,
                    "action_links": links
                }
                html, text = render_email_template("desk_escalation", context)
                
                # Send to Department Head & Commissioner
                send_email(issue["head_email"], context["subject"], html, text, issue["id"], "desk_escalation")
                if issue["commissioner_email"] != issue["head_email"]:
                    send_email(issue["commissioner_email"], context["subject"], html, text, issue["id"], "desk_escalation")

                log_desk_event(
                    issue_id=issue["id"],
                    event_type="ESCALATED",
                    actor="SLA Ladder Engine",
                    detail={
                        "level": 2,
                        "elapsed_minutes": int(elapsed_minutes),
                        "sla_limit": sla_ack,
                        "new_priority": new_p,
                        "notified": [issue["head_email"], issue["commissioner_email"]]
                    }
                )

            # Level 1 Reminder (elapsed >= 1 * sla_ack)
            elif elapsed_minutes >= sla_ack and cur_level < 1:
                cursor.execute("""
                    UPDATE issues
                    SET escalation_level = 1, updated_at = ?
                    WHERE id = ?
                """, (now.isoformat(), issue["id"]))
                conn.commit()

                links = build_action_links(issue["id"], issue["desk_email"])
                context = {
                    "subject": f"⏰ [SLA REMINDER] #{issue['id']} Acknowledgment Pending: {issue.get('title')}",
                    "issue": {
                        **issue,
                        "location_name": issue.get("location")
                    },
                    "department": {"name": issue["dept_name"]},
                    "sla_remaining": f"{max(0, int(2 * sla_ack - elapsed_minutes))}m before Commissioner escalation",
                    "action_links": links
                }
                html, text = render_email_template("desk_reminder", context)
                send_email(issue["desk_email"], context["subject"], html, text, issue["id"], "desk_reminder")

                log_desk_event(
                    issue_id=issue["id"],
                    event_type="REMINDER_SENT",
                    actor="SLA Ladder Engine",
                    detail={
                        "level": 1,
                        "elapsed_minutes": int(elapsed_minutes),
                        "notified": issue["desk_email"]
                    }
                )

        # 3. Check Overdue Resolution for In-Progress Issues
        cursor.execute("""
            SELECT i.*, d.name as dept_name, d.desk_email, d.head_email, d.sla_resolve_hours
            FROM issues i
            JOIN departments d ON i.department_id = d.id
            WHERE i.desk_status IN ('ACKNOWLEDGED', 'IN_PROGRESS') AND i.resolved_at IS NULL
        """)
        in_progress_issues = [dict(r) for r in cursor.fetchall()]

        for issue in in_progress_issues:
            created_str = issue.get("created_at")
            if not created_str:
                continue
            try:
                created_dt = datetime.fromisoformat(created_str.replace("Z", "+00:00")).replace(tzinfo=None)
            except Exception:
                continue

            elapsed_hours = (now - created_dt).total_seconds() / 3600.0
            sla_resolve = issue.get("sla_resolve_hours") or SLA_RESOLVE_HOURS_DEFAULT
            cur_level = issue.get("escalation_level") or 0

            # If overdue past resolution deadline and haven't sent level 3 overdue notice
            if elapsed_hours >= sla_resolve and cur_level < 3:
                cursor.execute("""
                    UPDATE issues
                    SET escalation_level = 3, updated_at = ?
                    WHERE id = ?
                """, (now.isoformat(), issue["id"]))
                conn.commit()

                links = build_action_links(issue["id"], issue["desk_email"])
                context = {
                    "subject": f"⚠️ [OVERDUE RESOLUTION] #{issue['id']} Past SLA: {issue.get('title')}",
                    "issue": {
                        **issue,
                        "location_name": issue.get("location")
                    },
                    "department": {"name": issue["dept_name"]},
                    "sla_remaining": f"Resolution overdue by {round(elapsed_hours - sla_resolve, 1)} hours",
                    "action_links": links
                }
                html, text = render_email_template("desk_reminder", context)
                send_email(issue["desk_email"], context["subject"], html, text, issue["id"], "desk_reminder")

                log_desk_event(
                    issue_id=issue["id"],
                    event_type="RESOLUTION_OVERDUE",
                    actor="SLA Ladder Engine",
                    detail={"elapsed_hours": round(elapsed_hours, 1), "sla_hours": sla_resolve}
                )

        # 4. Check RESOLVED_PENDING_REVIEW > 7 days without citizen review -> auto-close
        cursor.execute("""
            SELECT i.*, (SELECT COUNT(*) FROM reviews WHERE issue_id = i.id) as review_count
            FROM issues i
            WHERE i.desk_status = 'RESOLVED_PENDING_REVIEW'
        """)
        pending_review_issues = [dict(r) for r in cursor.fetchall()]

        for issue in pending_review_issues:
            if issue.get("review_count", 0) == 0 and issue.get("resolved_at"):
                try:
                    res_dt = datetime.fromisoformat(issue["resolved_at"].replace("Z", "+00:00")).replace(tzinfo=None)
                    # In demo mode, shorten to 12 minutes; normally 7 days
                    threshold_days = 0.008 if DEMO_MODE else 7.0
                    if (now - res_dt).total_seconds() >= (threshold_days * 86400):
                        cursor.execute("""
                            UPDATE issues
                            SET desk_status = 'CLOSED', status = 'resolved', closed_at = ?, updated_at = ?
                            WHERE id = ?
                        """, (now.isoformat(), now.isoformat(), issue["id"]))
                        conn.commit()

                        log_desk_event(
                            issue_id=issue["id"],
                            event_type="CLOSED_NO_DISPUTE",
                            actor="System SLA Engine",
                            detail={"reason": "No dispute received within verification window; auto-closed"}
                        )
                except Exception:
                    continue

async def dispatch_daily_digest():
    """Daily 08:00 AM IST accountability briefing to each department."""
    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM departments")
        departments = [dict(r) for r in cursor.fetchall()]

        for dept in departments:
            dept_id = dept["id"]
            cursor.execute("SELECT COUNT(*) FROM issues WHERE department_id = ? AND desk_status != 'CLOSED'", (dept_id,))
            open_count = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM issues WHERE department_id = ? AND escalation_level >= 1 AND desk_status != 'CLOSED'", (dept_id,))
            overdue_count = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM issues WHERE department_id = ? AND reopen_count > 0", (dept_id,))
            reopened_count = cursor.fetchone()[0]

            cursor.execute("""
                SELECT * FROM issues
                WHERE department_id = ? AND desk_status != 'CLOSED'
                ORDER BY CASE priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END, id DESC
                LIMIT 5
            """, (dept_id,))
            urgent = [dict(r) for r in cursor.fetchall()]

            context = {
                "subject": f"📊 Daily Civic Accountability Briefing: {dept['name']}",
                "department": dept,
                "open_count": open_count,
                "overdue_count": overdue_count,
                "reopened_count": reopened_count,
                "urgent_cases": urgent
            }
            html, text = render_email_template("desk_daily_digest", context)
            send_email(dept["desk_email"], context["subject"], html, text, None, "desk_daily_digest")

def start_scheduler():
    """Initializes APScheduler with intervals suited for DEMO_MODE or Production."""
    interval_sec = 30 if DEMO_MODE else 300  # 30s in demo, 5m in prod
    scheduler.add_job(
        check_sla_escalations,
        trigger=IntervalTrigger(seconds=interval_sec),
        id="sla_escalation_checker",
        replace_existing=True
    )
    # 08:00 AM IST (02:30 UTC)
    scheduler.add_job(
        dispatch_daily_digest,
        trigger=CronTrigger(hour=2, minute=30),
        id="daily_morning_digest",
        replace_existing=True
    )
    scheduler.start()
    print(f"[Scheduler Started] SLA Ladder running every {interval_sec}s (DEMO_MODE={DEMO_MODE}).")

def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown()
        print("[Scheduler Stopped]")
