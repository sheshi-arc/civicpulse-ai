import pytest
import sqlite3
import jwt
from datetime import datetime, timedelta, timezone
from db_migrations import category_to_department_slug, run_migrations
from config import DB_PATH, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
from token_service import (
    generate_action_token,
    verify_action_token,
    hash_token,
    SERIALIZER
)
from review_service import (
    record_citizen_review,
    recalculate_department_trust_score,
    bump_priority_one_level
)
from auth import (
    create_access_token,
    decode_access_token,
    is_rate_limited,
    record_failed_attempt,
    clear_failed_attempts,
    init_admin_user
)

# =====================================================================
# 1. Category Mapping Tests (Prompt 1)
# =====================================================================

def test_category_to_department_mapping():
    assert category_to_department_slug("Roads", "Pothole") == "public_works"
    assert category_to_department_slug("Sanitation", "Overflowing Bin") == "sanitation"
    assert category_to_department_slug("Water Works", "Pipe Leak") == "water_supply"
    assert category_to_department_slug("Electricity", "Streetlight") == "electricity"
    assert category_to_department_slug("Traffic", "Accident") == "traffic_safety"
    assert category_to_department_slug("Parks", "Tree Fall") == "parks_environment"
    # Fallback check
    assert category_to_department_slug("Unrecognized", "Unknown") == "public_works"

# =====================================================================
# 2. Database Migrations Tests (Prompt 1)
# =====================================================================

def test_database_tables_exist():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Check tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r[0] for r in cursor.fetchall()]
    
    expected_tables = ["departments", "issues", "complaints", "desk_events", "email_log", "action_tokens", "reviews", "admin_users"]
    for t in expected_tables:
        assert t in tables, f"Missing expected table {t}"

    # Check issues table columns
    cursor.execute("PRAGMA table_info(issues)")
    issue_cols = [r[1] for r in cursor.fetchall()]
    assert "desk_status" in issue_cols
    assert "reopen_count" in issue_cols
    assert "last_surge_threshold" in issue_cols
    assert "escalation_level" in issue_cols
    assert "resolution_receipt" in issue_cols

    # Check complaints column
    cursor.execute("PRAGMA table_info(complaints)")
    comp_cols = [r[1] for r in cursor.fetchall()]
    assert "citizen_email" in comp_cols
    conn.close()

# =====================================================================
# 3. Signed Magic Links & Security Tests (Prompt 3)
# =====================================================================

def test_token_lifecycle_and_security():
    # A. Valid token generation & verification
    token = generate_action_token(issue_id=1, action="accept", email="officer@civicpulse.gov")
    payload = verify_action_token(token, mark_used=False)
    assert payload["issue_id"] == 1
    assert payload["action"] == "accept"
    assert payload["email"] == "officer@civicpulse.gov"

    # B. Tampered token
    tampered = token[:-4] + "fake"
    with pytest.raises(ValueError, match="Invalid or tampered token"):
        verify_action_token(tampered)

    # C. SQL Injection attempt in token string
    sql_injection = "' OR 1=1; DROP TABLE action_tokens; --"
    with pytest.raises(ValueError):
        verify_action_token(sql_injection)

    # D. Reused terminal token
    resolve_token = generate_action_token(issue_id=1, action="resolve", email="officer@civicpulse.gov")
    # First use succeeds and marks used
    verify_action_token(resolve_token, mark_used=True)
    # Second use must fail
    with pytest.raises(ValueError, match="already been used"):
        verify_action_token(resolve_token, mark_used=True)

# =====================================================================
# 4. Priority Bumping & Review Logic Tests (Prompt 7)
# =====================================================================

def test_priority_escalation():
    assert bump_priority_one_level("Low") == "Medium"
    assert bump_priority_one_level("Medium") == "High"
    assert bump_priority_one_level("High") == "Critical"
    assert bump_priority_one_level("Critical") == "Critical"

def test_trust_score_calculation():
    # Department 1 trust score calculation
    score = recalculate_department_trust_score(1)
    assert 0.0 <= score <= 100.0

# =====================================================================
# 5. Admin Authentication & Security Tests (Prompt 11)
# =====================================================================

def test_jwt_auth_flow():
    # Valid token
    jwt_tok = create_access_token("admin@civicpulse.gov")
    decoded = decode_access_token(jwt_tok)
    assert decoded["sub"] == "admin@civicpulse.gov"

    # Expired token
    expired_payload = {
        "sub": "admin@civicpulse.gov",
        "exp": datetime.now(timezone.utc) - timedelta(hours=1)
    }
    expired_tok = jwt.encode(expired_payload, JWT_SECRET, algorithm="HS256")
    with pytest.raises(Exception):
        decode_access_token(expired_tok)

    # Tampered signature (using 32+ bytes key to satisfy RFC 7518)
    tampered_jwt = jwt.encode({"sub": "hacker@domain.com"}, "wrong-secret-key-that-is-at-least-32-bytes-long", algorithm="HS256")
    with pytest.raises(Exception):
        decode_access_token(tampered_jwt)

def test_login_brute_force_lockout():
    ip = "192.168.1.100"
    test_email = "victim@civicpulse.gov"
    clear_failed_attempts(ip, test_email)

    assert not is_rate_limited(ip, test_email)
    for _ in range(4):
        record_failed_attempt(ip, test_email)
        assert not is_rate_limited(ip, test_email)

    # 5th failed attempt locks out
    record_failed_attempt(ip, test_email)
    assert is_rate_limited(ip, test_email)
    clear_failed_attempts(ip, test_email)
