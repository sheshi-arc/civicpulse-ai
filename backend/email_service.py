import os
import smtplib
import ssl
import time
import sqlite3
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime
from typing import Optional, Dict, Any, Tuple
from jinja2 import Environment, FileSystemLoader, select_autoescape

from config import (
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_APP_PASSWORD,
    EMAIL_FROM_NAME,
    DEMO_MODE,
    DB_PATH,
    BASE_DIR,
    PUBLIC_BASE_URL
)

TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
OUTBOX_DIR = os.path.join(BASE_DIR, "outbox")
os.makedirs(OUTBOX_DIR, exist_ok=True)

jinja_env = Environment(
    loader=FileSystemLoader(TEMPLATES_DIR),
    autoescape=select_autoescape(["html", "xml"])
)

def _get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def log_email_attempt(
    issue_id: Optional[int],
    to_email: str,
    template: str,
    subject: str,
    status: str,
    error: Optional[str] = None
):
    try:
        with _get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO email_log (issue_id, to_email, template, subject, status, error, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (issue_id, to_email, template, subject, status, error, datetime.utcnow().isoformat()))
            conn.commit()
    except Exception as e:
        print(f"[EmailLog Error] Failed to log email event: {e}")

def render_email_template(template_name: str, context: Dict[str, Any]) -> Tuple[str, str]:
    """
    Renders HTML and auto-generates a clean plain-text fallback.
    """
    if not template_name.endswith(".html"):
        template_name += ".html"
    
    # Inject default context variables
    full_context = {
        "public_base_url": PUBLIC_BASE_URL,
        **context
    }
    
    template = jinja_env.get_template(template_name)
    html_content = template.render(**full_context)
    
    # Simple plain-text fallback from context
    plain_text = f"""
CivicPulse AI Notification: {context.get('subject', 'Accountability Desk')}
------------------------------------------------------------
{context.get('summary', 'Please open this email in an HTML-compatible client.')}

For details, visit: {PUBLIC_BASE_URL}
Tagline: Report. Route. Resolve. Verify.
"""
    return html_content, plain_text

def send_email_sync(
    to: str,
    subject: str,
    html: str,
    text: str,
    issue_id: Optional[int] = None,
    template: str = "custom"
) -> bool:
    """
    Synchronous email sender with 3x exponential backoff.
    Falls back to writing rendered HTML in backend/outbox/ in DEMO_MODE or when SMTP unconfigured.
    """
    is_placeholder_smtp = (
        not SMTP_USER 
        or "your_sender" in SMTP_USER 
        or not SMTP_APP_PASSWORD 
        or "xxxx" in SMTP_APP_PASSWORD
    )

    # Offline / Demo Mode fallback
    if DEMO_MODE and is_placeholder_smtp:
        safe_to = to.replace("@", "_at_").replace(".", "_")
        filename = f"{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{template}_{safe_to}.html"
        outbox_path = os.path.join(OUTBOX_DIR, filename)
        with open(outbox_path, "w", encoding="utf-8") as f:
            f.write(f"<!-- TO: {to} | SUBJECT: {subject} | TIME: {datetime.utcnow().isoformat()} -->\n")
            f.write(html)
        print(f"[DEMO EMAIL OUTBOX] Written rendered email to: {outbox_path}")
        log_email_attempt(issue_id, to, template, subject, "OUTBOX", f"Saved to {filename}")
        return True

    # Real SMTP Delivery with 3 Retries (exponential backoff)
    max_retries = 3
    last_error = None

    for attempt in range(1, max_retries + 1):
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{EMAIL_FROM_NAME} <{SMTP_USER}>"
            msg["To"] = to

            part_text = MIMEText(text, "plain", "utf-8")
            part_html = MIMEText(html, "html", "utf-8")
            msg.attach(part_text)
            msg.attach(part_html)

            context = ssl.create_default_context()
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
                server.ehlo()
                server.starttls(context=context)
                server.ehlo()
                server.login(SMTP_USER, SMTP_APP_PASSWORD)
                server.sendmail(SMTP_USER, [to], msg.as_string())

            print(f"[Email Service] Successfully sent email to {to} (template: {template})")
            log_email_attempt(issue_id, to, template, subject, "SENT", None)
            return True

        except Exception as e:
            last_error = str(e)
            print(f"[Email Attempt {attempt}/{max_retries} Failed] {e}")
            if attempt < max_retries:
                time.sleep(2 ** attempt)

    # If SMTP fails and DEMO_MODE is true, save fallback to outbox
    if DEMO_MODE:
        safe_to = to.replace("@", "_at_").replace(".", "_")
        filename = f"{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_FALLBACK_{template}_{safe_to}.html"
        outbox_path = os.path.join(OUTBOX_DIR, filename)
        with open(outbox_path, "w", encoding="utf-8") as f:
            f.write(f"<!-- FAILED SMTP: {last_error} | TO: {to} | SUBJECT: {subject} -->\n")
            f.write(html)
        print(f"[Email Fallback Saved] {outbox_path}")
        log_email_attempt(issue_id, to, template, subject, "FAILED_SAVED_OUTBOX", last_error)
        return False

    log_email_attempt(issue_id, to, template, subject, "FAILED", last_error)
    return False

def send_email(
    to: str,
    subject: str,
    html: str,
    text: str,
    issue_id: Optional[int] = None,
    template: str = "custom"
):
    """
    Main entry point for dispatching emails. Suitable for FastAPI BackgroundTasks.
    """
    return send_email_sync(to, subject, html, text, issue_id, template)
