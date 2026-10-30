import pytest
import sqlite3
import json
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from main import app
from config import DB_PATH, ADMIN_PASSWORD
from db_migrations import run_migrations
from auth import create_access_token

def setup_module(module):
    with sqlite3.connect(DB_PATH) as conn:
        run_migrations(conn)

def test_seeded_role_accounts_login():
    """Verify that all 5 designated role accounts can log in with bcrypt password verification."""
    client = TestClient(app)
    test_accounts = [
        ("sheshitejs@gmail.com", "SUPER_ADMIN"),
        ("ssheshitej96@gmail.com", "ADMIN"),
        ("ssaicharan229@gmail.com", "DEPARTMENT_MANAGER"),
        ("anaalia696@gmail.com", "DEPARTMENT_MANAGER"),
        ("nandhinichakala@gmail.com", "DEPARTMENT_MANAGER"),
    ]

    for email, expected_role in test_accounts:
        resp = client.post("/api/auth/login", json={
            "email": email,
            "password": ADMIN_PASSWORD
        })
        assert resp.status_code == 200, f"Login failed for {email}: {resp.text}"
        data = resp.json()
        assert data["success"] is True
        assert "token" in data
        assert data["user"]["role"] == expected_role
        assert data["user"]["email"] == email

def test_super_admin_full_privileges():
    """Verify SUPER_ADMIN can access user management and global dashboard."""
    client = TestClient(app)
    token = create_access_token(
        email="sheshitejs@gmail.com",
        role="SUPER_ADMIN",
        name="Sheshi Teja",
        department_slug="public_works"
    )
    headers = {"Authorization": f"Bearer {token}"}

    # 1. User management list
    users_resp = client.get("/api/admin/users", headers=headers)
    assert users_resp.status_code == 200
    users_data = users_resp.json()
    assert users_data["success"] is True
    assert len(users_data["users"]) >= 5

    # 2. Global dashboard
    dash_resp = client.get("/api/admin/dashboard", headers=headers)
    assert dash_resp.status_code == 200
    assert dash_resp.json()["role"] == "SUPER_ADMIN"
    assert "stats" in dash_resp.json()

def test_department_manager_access_isolation():
    """
    Verify that Water Supply Manager (ssaicharan229@gmail.com):
    - CAN access Water Supply tickets
    - CANNOT access or modify tickets for Electricity (403 Forbidden)
    - CANNOT access /api/admin/users (403 Forbidden)
    """
    client = TestClient(app)
    water_token = create_access_token(
        email="ssaicharan229@gmail.com",
        role="DEPARTMENT_MANAGER",
        name="Sai Charan",
        department_slug="water_supply"
    )
    water_headers = {"Authorization": f"Bearer {water_token}"}

    # 1. Accessing users list is forbidden for department manager
    users_resp = client.get("/api/admin/users", headers=water_headers)
    assert users_resp.status_code == 403

    # Create dummy issues in DB for testing isolation
    dummy_vec = json.dumps([0.05] * 1024)
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        now = datetime.now(timezone.utc).isoformat()
        
        # Water supply issue
        cursor.execute("""
            INSERT INTO issues (title, category, priority, department, location, status, desk_status, embedding, created_at, updated_at)
            VALUES ('Pipeline Burst on 2nd Ave', 'Water Supply', 'High', 'Water Supply & Sewerage Board', '2nd Ave', 'active', 'NEW', ?, ?, ?)
        """, (dummy_vec, now, now))
        water_issue_id = cursor.lastrowid

        # Electricity issue
        cursor.execute("""
            INSERT INTO issues (title, category, priority, department, location, status, desk_status, embedding, created_at, updated_at)
            VALUES ('Fallen Power Line Block', 'Electricity', 'Critical', 'Electricity & Street Lighting', 'Station Rd', 'active', 'NEW', ?, ?, ?)
        """, (dummy_vec, now, now))
        electric_issue_id = cursor.lastrowid
        conn.commit()

    # 2. Water manager can inspect water issue
    water_detail = client.get(f"/api/admin/tickets/{water_issue_id}", headers=water_headers)
    assert water_detail.status_code == 200
    assert water_detail.json()["ticket"]["id"] == water_issue_id

    # 3. Water manager CANNOT inspect electricity issue (403 Forbidden)
    elec_detail = client.get(f"/api/admin/tickets/{electric_issue_id}", headers=water_headers)
    assert elec_detail.status_code == 403
    assert "Forbidden" in elec_detail.json()["detail"]

    # 4. Water manager CANNOT update electricity ticket status
    update_attempt = client.post(
        f"/api/admin/tickets/{electric_issue_id}/status",
        headers=water_headers,
        json={"status": "IN_PROGRESS"}
    )
    assert update_attempt.status_code == 403

def test_ticket_lifecycle_transitions():
    """Verify complete ticket lifecycle: NEW -> ASSIGNED -> IN_PROGRESS -> ON_HOLD -> COMPLETED -> RESOLVED."""
    client = TestClient(app)
    admin_token = create_access_token(
        email="ssheshitej96@gmail.com",
        role="ADMIN",
        name="Municipal Admin"
    )
    headers = {"Authorization": f"Bearer {admin_token}"}
    dummy_vec = json.dumps([0.05] * 1024)

    # Create an issue
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        now = datetime.now(timezone.utc).isoformat()
        cursor.execute("""
            INSERT INTO issues (title, category, priority, department, location, status, desk_status, embedding, created_at, updated_at)
            VALUES ('Clogged Storm Drain', 'Sanitation', 'Medium', 'Sanitation & Waste Management', 'Park Ln', 'active', 'NEW', ?, ?, ?)
        """, (dummy_vec, now, now))
        issue_id = cursor.lastrowid

        cursor.execute("""
            INSERT INTO complaints (tracking_id, citizen_email, text, summary, category, priority, department, location, issue_id, created_at)
            VALUES ('CP-2026-99991', 'citizen.jane@example.com', 'Drain flooded', 'Flooded drain', 'Sanitation', 'Medium', 'Sanitation & Waste Management', 'Park Ln', ?, ?)
        """, (issue_id, now))
        conn.commit()

    # 1. ASSIGN
    assign_res = client.post(
        f"/api/admin/tickets/{issue_id}/assign",
        headers=headers,
        json={"officer_email": "ssheshitej96@gmail.com", "note": "Dispatching Crew Alpha"}
    )
    assert assign_res.status_code == 200
    assert assign_res.json()["desk_status"] == "ASSIGNED"

    # 2. START WORK -> IN_PROGRESS
    prog_res = client.post(
        f"/api/admin/tickets/{issue_id}/status",
        headers=headers,
        json={"status": "IN_PROGRESS", "reason": "Crew deployed on site with excavator"}
    )
    assert prog_res.status_code == 200
    assert prog_res.json()["desk_status"] == "IN_PROGRESS"

    # 3. PUT ON HOLD -> ON_HOLD
    hold_res = client.post(
        f"/api/admin/tickets/{issue_id}/status",
        headers=headers,
        json={"status": "ON_HOLD", "reason": "Awaiting heavy machinery parts delivery"}
    )
    assert hold_res.status_code == 200
    assert hold_res.json()["desk_status"] == "ON_HOLD"

    # 4. RESUME -> IN_PROGRESS
    resume_res = client.post(
        f"/api/admin/tickets/{issue_id}/status",
        headers=headers,
        json={"status": "IN_PROGRESS", "reason": "Parts arrived, excavation resumed"}
    )
    assert resume_res.status_code == 200
    assert resume_res.json()["desk_status"] == "IN_PROGRESS"

    # 5. COMPLETE -> COMPLETED
    comp_res = client.post(
        f"/api/admin/tickets/{issue_id}/status",
        headers=headers,
        json={"status": "COMPLETED", "resolution_note": "Drain unblocked and silt removed", "proof_photo_url": "/uploads/proof1.jpg"}
    )
    assert comp_res.status_code == 200
    assert comp_res.json()["desk_status"] == "COMPLETED"

    # 6. RESOLVE -> RESOLVED
    res_res = client.post(
        f"/api/admin/tickets/{issue_id}/status",
        headers=headers,
        json={"status": "RESOLVED", "reason": "Final signoff completed and verified"}
    )
    assert res_res.status_code == 200
    assert res_res.json()["desk_status"] == "RESOLVED"
    assert res_res.json()["status"] == "resolved"

    # 7. Customer tracking sees the final status
    track_res = client.get("/api/complaints/track/CP-2026-99991")
    assert track_res.status_code == 200
    track_data = track_res.json()
    assert track_data["desk_status"] == "RESOLVED"
    assert track_data["status"] == "resolved"

def test_customer_tracking_idor_protection():
    """Verify that public tracking redacts citizen emails and hides raw phone numbers."""
    client = TestClient(app)
    dummy_vec = json.dumps([0.05] * 1024)
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        now = datetime.now(timezone.utc).isoformat()
        cursor.execute("""
            INSERT INTO issues (title, category, priority, department, location, status, desk_status, embedding, created_at, updated_at)
            VALUES ('Pothole Near School', 'Roads', 'High', 'Public Works', 'School Rd', 'active', 'NEW', ?, ?, ?)
        """, (dummy_vec, now, now))
        issue_id = cursor.lastrowid

        cursor.execute("""
            INSERT INTO complaints (
                tracking_id, citizen_email, reporter_name, reporter_phone, text, summary, category, priority, department, location, issue_id, created_at
            ) VALUES ('CP-2026-99992', 'superprivatecitizen@gmail.com', 'Private Citizen', '+1-555-867-5309', 'Dangerous pothole', 'Pothole', 'Roads', 'High', 'Public Works', 'School Rd', ?, ?)
        """, (issue_id, now))
        conn.commit()

    resp = client.get("/api/complaints/track/CP-2026-99992")
    assert resp.status_code == 200
    data = resp.json()
    complaint = data["complaint"]

    # Raw citizen email must NOT be returned in plaintext
    assert "superprivatecitizen@gmail.com" not in json.dumps(complaint)
    assert complaint.get("citizen_email_masked") == "su***@gmail.com"
    # Raw phone number must NOT be exposed
    assert "+1-555-867-5309" not in json.dumps(complaint)
    assert "reporter_phone" not in complaint
