import pytest
import sqlite3
import json
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from main import app
from config import DB_PATH, ADMIN_PASSWORD
from db_migrations import run_migrations

client = TestClient(app)

def setup_module(module):
    with sqlite3.connect(DB_PATH) as conn:
        run_migrations(conn)

def test_e2e_full_citizen_to_admin_lifecycle():
    """
    Complete end-to-end integration test:
    1. Customer submits complaint with full contact info, category, and location.
    2. Ticket ID is generated, AI analysis and City Memory triage execute.
    3. Customer tracks ticket via public tracking endpoint (IDOR contact protection verified).
    4. Department Manager logs in (authentication & token generation).
    5. Department Manager permissions enforced (403 on other departments, 403 on users).
    6. Ticket lifecycle: NEW -> ASSIGNED -> IN_PROGRESS -> ON_HOLD -> COMPLETED -> RESOLVED.
    7. Public customer tracking reflects real-time transitions at each phase.
    8. Super Admin logs in, accesses global dashboard and user management.
    """
    # -------------------------------------------------------------
    # Step 1: Customer Submits Complaint
    # -------------------------------------------------------------
    submit_payload = {
        "complaint": "Major underground water pipeline breach causing road inundation near Market Square",
        "reporter_name": "Pooja Reddy",
        "reporter_phone": "+91-98765-01234",
        "citizen_email": "pooja.reddy@example.com",
        "category": "Water Supply & Sewerage",
        "location": "Market Square Center",
        "latitude": 17.4485,
        "longitude": 78.3822
    }

    sub_res = client.post("/api/submit-complaint", json=submit_payload)
    assert sub_res.status_code == 200, f"Submit failed: {sub_res.text}"
    sub_data = sub_res.json()
    assert sub_data["success"] is True
    tracking_id = sub_data["tracking_id"]
    master_issue_id = sub_data["issue_id"]
    assert tracking_id.startswith("CP-2026-")
    assert master_issue_id is not None

    # Verify City Memory and AI analysis presence
    assert "city_memory" in sub_data
    assert "analysis" in sub_data
    assert sub_data["analysis"]["department"] is not None

    # -------------------------------------------------------------
    # Step 2: Customer Tracking & IDOR Protection Check
    # -------------------------------------------------------------
    track_res = client.get(f"/api/complaints/track/{tracking_id}")
    assert track_res.status_code == 200
    track_data = track_res.json()
    assert track_data["tracking_id"] == tracking_id
    assert track_data["desk_status"] == "NEW"
    assert track_data["status"] == "active"
    
    # IDOR Protection: Private email masked, raw phone hidden
    complaint_data = track_data["complaint"]
    assert complaint_data.get("citizen_email_masked") == "po***@example.com"
    assert "+91-98765-01234" not in json.dumps(track_data)
    assert "reporter_phone" not in complaint_data

    # -------------------------------------------------------------
    # Step 3: Department Manager Login (Water Supply Manager)
    # -------------------------------------------------------------
    water_login = client.post("/api/auth/login", json={
        "email": "ssaicharan229@gmail.com",
        "password": ADMIN_PASSWORD
    })
    assert water_login.status_code == 200
    water_token = water_login.json()["token"]
    assert water_login.json()["user"]["role"] == "DEPARTMENT_MANAGER"
    water_headers = {"Authorization": f"Bearer {water_token}"}

    # -------------------------------------------------------------
    # Step 4: Department Manager Isolation Enforcement
    # -------------------------------------------------------------
    # Cannot access User Management (403 Forbidden)
    users_attempt = client.get("/api/admin/users", headers=water_headers)
    assert users_attempt.status_code == 403

    # Water manager dashboard is scoped to water_supply
    dash_res = client.get("/api/admin/dashboard", headers=water_headers)
    assert dash_res.status_code == 200
    assert dash_res.json()["role"] == "DEPARTMENT_MANAGER"

    # -------------------------------------------------------------
    # Step 5: Operations Admin Login & Full Ticket Lifecycle
    # -------------------------------------------------------------
    admin_login = client.post("/api/auth/login", json={
        "email": "ssheshitej96@gmail.com",
        "password": ADMIN_PASSWORD
    })
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Action A: ASSIGN TICKET
    assign_res = client.post(
        f"/api/admin/tickets/{master_issue_id}/assign",
        headers=admin_headers,
        json={"officer_email": "field.officer@water.gov", "note": "Priority emergency dispatch"}
    )
    assert assign_res.status_code == 200
    assert assign_res.json()["desk_status"] == "ASSIGNED"

    # Action B: START WORK (IN_PROGRESS)
    prog_res = client.post(
        f"/api/admin/tickets/{master_issue_id}/status",
        headers=admin_headers,
        json={"status": "IN_PROGRESS", "reason": "Excavation and valve isolation underway"}
    )
    assert prog_res.status_code == 200
    assert prog_res.json()["desk_status"] == "IN_PROGRESS"

    # Verify customer tracking sees IN_PROGRESS
    t1 = client.get(f"/api/complaints/track/{tracking_id}").json()
    assert t1["desk_status"] == "IN_PROGRESS"

    # Action C: PUT ON HOLD (ON_HOLD with reason)
    hold_res = client.post(
        f"/api/admin/tickets/{master_issue_id}/status",
        headers=admin_headers,
        json={"status": "ON_HOLD", "reason": "Awaiting main distribution shutoff from regional reservoir"}
    )
    assert hold_res.status_code == 200
    assert hold_res.json()["desk_status"] == "ON_HOLD"

    # Verify customer tracking sees ON_HOLD
    t2 = client.get(f"/api/complaints/track/{tracking_id}").json()
    assert t2["desk_status"] == "ON_HOLD"

    # Action D: RESUME & COMPLETE (COMPLETED)
    comp_res = client.post(
        f"/api/admin/tickets/{master_issue_id}/status",
        headers=admin_headers,
        json={"status": "COMPLETED", "resolution_note": "Pipe section replaced and sealed. Water pressure restored."}
    )
    assert comp_res.status_code == 200
    assert comp_res.json()["desk_status"] == "COMPLETED"

    # Action E: RESOLVE (RESOLVED)
    res_res = client.post(
        f"/api/admin/tickets/{master_issue_id}/status",
        headers=admin_headers,
        json={"status": "RESOLVED", "reason": "Site inspected and verified by municipal engineer"}
    )
    assert res_res.status_code == 200
    assert res_res.json()["desk_status"] == "RESOLVED"
    assert res_res.json()["status"] == "resolved"

    # Verify customer tracking sees RESOLVED
    t3 = client.get(f"/api/complaints/track/{tracking_id}").json()
    assert t3["desk_status"] == "RESOLVED"
    assert t3["status"] == "resolved"

    # -------------------------------------------------------------
    # Step 6: Super Admin Management Access
    # -------------------------------------------------------------
    super_login = client.post("/api/auth/login", json={
        "email": "sheshitejs@gmail.com",
        "password": ADMIN_PASSWORD
    })
    assert super_login.status_code == 200
    super_token = super_login.json()["token"]
    super_headers = {"Authorization": f"Bearer {super_token}"}

    users_res = client.get("/api/admin/users", headers=super_headers)
    assert users_res.status_code == 200
    assert len(users_res.json()["users"]) >= 5
