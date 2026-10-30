import os
import hashlib
import hmac
import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature
from config import TOKEN_SECRET, PUBLIC_BASE_URL, DB_PATH

SERIALIZER = URLSafeTimedSerializer(TOKEN_SECRET, salt="civicpulse-accountability")

OFFICER_MAX_AGE_SECONDS = 7 * 24 * 3600  # 7 days
CITIZEN_MAX_AGE_SECONDS = 14 * 24 * 3600  # 14 days

def _get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def hash_token(token: str) -> str:
    """Return SHA-256 hash of token."""
    return hashlib.sha256(token.strip().encode("utf-8")).hexdigest()

def generate_action_token(issue_id: int, action: str, email: str, complaint_id: Optional[int] = None) -> str:
    """
    Generate URL-safe signed token containing payload, and record its SHA-256 hash in action_tokens.
    Actions:
      - 'accept', 'assign', 'needs_info', 'resolve' (Officer actions)
      - 'review' (Citizen action)
    """
    now_utc = datetime.now(timezone.utc)
    payload = {
        "issue_id": issue_id,
        "action": action,
        "email": email,
        "complaint_id": complaint_id,
        "ts": now_utc.timestamp()
    }
    token = SERIALIZER.dumps(payload)
    t_hash = hash_token(token)

    days = 14 if action == "review" else 7
    expires_at = now_utc + timedelta(days=days)

    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO action_tokens (issue_id, action, officer_email, token_hash, expires_at, used_at)
            VALUES (?, ?, ?, ?, ?, NULL)
        """, (issue_id, action, email, t_hash, expires_at.isoformat()))
        conn.commit()

    return token

def verify_action_token(token: str, mark_used: bool = False) -> Dict[str, Any]:
    """
    Verify HMAC signature, expiry, and check action_tokens status.
    Returns payload dictionary.
    Raises ValueError on invalid/expired/reused/tampered token.
    """
    if not token or not isinstance(token, str):
        raise ValueError("Missing or invalid token format")

    try:
        # We allow up to 14 days for any token check here, action specific checked below
        payload = SERIALIZER.loads(token, max_age=CITIZEN_MAX_AGE_SECONDS)
    except SignatureExpired:
        raise ValueError("Token has expired")
    except (BadSignature, Exception):
        raise ValueError("Invalid or tampered token")

    action = payload.get("action")
    issue_id = payload.get("issue_id")
    email = payload.get("email")

    # Check officer specific 7-day expiry
    if action != "review":
        token_age = datetime.now(timezone.utc).timestamp() - payload.get("ts", 0)
        if token_age > OFFICER_MAX_AGE_SECONDS:
            raise ValueError("Officer token has expired (7 days)")

    t_hash = hash_token(token)

    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM action_tokens WHERE token_hash = ?", (t_hash,))
        record = cursor.fetchone()

        if not record:
            raise ValueError("Token record not found in system")

        # Constant time check
        if not hmac.compare_digest(record["token_hash"], t_hash):
            raise ValueError("Security verification failure")

        # Check if already used for terminal actions (like resolve)
        if record["used_at"] is not None:
            if action in ["resolve"]:
                raise ValueError("This one-click resolution token has already been used")

        if mark_used:
            cursor.execute(
                "UPDATE action_tokens SET used_at = ? WHERE id = ?",
                (datetime.now(timezone.utc).isoformat(), record["id"])
            )
            conn.commit()

    return payload

def build_action_links(issue_id: int, email: str) -> Dict[str, str]:
    """Generate all desk magic links for an officer."""
    token_accept = generate_action_token(issue_id, "accept", email)
    token_assign = generate_action_token(issue_id, "assign", email)
    token_info = generate_action_token(issue_id, "needs_info", email)
    token_resolve = generate_action_token(issue_id, "resolve", email)

    base = PUBLIC_BASE_URL.rstrip("/")
    return {
        "accept": f"{base}/desk/action/{token_accept}",
        "assign": f"{base}/desk/action/{token_assign}",
        "needs_info": f"{base}/desk/action/{token_info}",
        "resolve": f"{base}/desk/resolve/{token_resolve}"
    }

def build_review_links(issue_id: int, email: str, complaint_id: Optional[int] = None) -> Dict[str, str]:
    """Generate review magic links for a citizen."""
    token_review = generate_action_token(issue_id, "review", email, complaint_id)
    base = PUBLIC_BASE_URL.rstrip("/")
    return {
        "token": token_review,
        "star_1": f"{base}/review/{token_review}?rating=1",
        "star_2": f"{base}/review/{token_review}?rating=2",
        "star_3": f"{base}/review/{token_review}?rating=3",
        "star_4": f"{base}/review/{token_review}?rating=4",
        "star_5": f"{base}/review/{token_review}?rating=5",
        "still_broken": f"{base}/review/{token_review}?still_broken=1",
        "landing": f"{base}/review/{token_review}"
    }
