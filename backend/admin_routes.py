import sqlite3
import json
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from pydantic import BaseModel, Field, EmailStr
import bcrypt

from config import DB_PATH
from auth import get_current_admin, require_roles

router = APIRouter(prefix="/api/admin", tags=["Admin Command Center"])

def _get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def _check_department_access(admin_user: Dict[str, Any], department_name: str, department_slug: Optional[str] = None):
    """
    Super Admin and Municipal Admin can view/modify any department.
    Department Managers and Staff can ONLY view/modify their own department.
    """
    role = admin_user.get("role", "").upper()
    if role in ["SUPER_ADMIN", "ADMIN"]:
        return True

    user_dept_slugs = [s.strip().lower() for s in (admin_user.get("department_slug") or "").split(",") if s.strip()]
    if not user_dept_slugs:
        raise HTTPException(status_code=403, detail="Unauthorized: User has no assigned department.")

    # Match by slug or partial department name
    dept_str = f"{department_name or ''} {department_slug or ''}".lower()
    has_match = any(slug in dept_str or slug.replace("_", " ") in dept_str for slug in user_dept_slugs)
    if not has_match:
        raise HTTPException(
            status_code=403,
            detail=f"Forbidden: You only have access to {admin_user.get('department_slug')}, not '{department_name}'."
        )
    return True

# =====================================================================
# Pydantic Schemas
# =====================================================================

class AssignTicketRequest(BaseModel):
    officer_email: str
    officer_name: Optional[str] = None
    note: Optional[str] = None

class TicketStatusRequest(BaseModel):
    status: str = Field(..., description="NEW, ASSIGNED, IN_PROGRESS, ON_HOLD, COMPLETED, RESOLVED, REJECTED")
    reason: Optional[str] = None
    proof_photo_url: Optional[str] = None
    resolution_note: Optional[str] = None

class TicketNoteRequest(BaseModel):
    content: str
    note_type: str = "internal"  # internal, public, system

class UserCreateRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "DEPARTMENT_STAFF"  # SUPER_ADMIN, ADMIN, DEPARTMENT_MANAGER, DEPARTMENT_STAFF
    department_slug: Optional[str] = "public_works"

class UserUpdateRequest(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    department_slug: Optional[str] = None
    is_active: Optional[int] = None
    password: Optional[str] = None

# =====================================================================
# 1. Admin Dashboard Stats (Role-Aware)
# =====================================================================

@router.get("/dashboard")
async def get_dashboard_stats(current_user: Dict[str, Any] = Depends(get_current_admin)):
    """
    Returns role-filtered metrics.
    If DEPARTMENT_MANAGER: strictly filtered to their assigned department.
    If SUPER_ADMIN / ADMIN: city-wide metrics.
    """
    role = current_user.get("role", "").upper()
    user_dept_slugs = [s.strip().lower() for s in (current_user.get("department_slug") or "").split(",") if s.strip()]

    with _get_db() as conn:
        cursor = conn.cursor()

        # Build filter clause for role
        where_clause = ""
        params: List[Any] = []
        if role not in ["SUPER_ADMIN", "ADMIN"]:
            conditions = []
            for slug in user_dept_slugs:
                conditions.append("LOWER(department) LIKE ?")
                params.append(f"%{slug.replace('_', ' ')}%")
            where_clause = f"WHERE ({' OR '.join(conditions)})" if conditions else "WHERE 1=0"

        # Total Master Issues
        cursor.execute(f"SELECT COUNT(*) FROM issues {where_clause}", params)
        total_issues = cursor.fetchone()[0]

        # Issues by Desk Status
        cursor.execute(f"""
            SELECT COALESCE(desk_status, 'NEW') as status_val, COUNT(*) 
            FROM issues {where_clause}
            GROUP BY COALESCE(desk_status, 'NEW')
        """, params)
        status_counts_raw = dict(cursor.fetchall())

        # Normalize counts into standard lifecycle
        new_count = status_counts_raw.get("NEW", 0) + status_counts_raw.get("EMAILED", 0)
        assigned_count = status_counts_raw.get("ASSIGNED", 0) + status_counts_raw.get("ACKNOWLEDGED", 0)
        in_progress_count = status_counts_raw.get("IN_PROGRESS", 0)
        on_hold_count = status_counts_raw.get("ON_HOLD", 0) + status_counts_raw.get("NEEDS_INFO", 0)
        completed_count = status_counts_raw.get("COMPLETED", 0) + status_counts_raw.get("RESOLVED_PENDING_REVIEW", 0)
        resolved_count = status_counts_raw.get("RESOLVED", 0) + status_counts_raw.get("CLOSED", 0)

        # High / Critical Count
        high_crit_clause = f"{where_clause} AND " if where_clause else "WHERE "
        cursor.execute(f"""
            SELECT COUNT(*) FROM issues 
            {high_crit_clause} LOWER(priority) IN ('high', 'critical')
        """, params)
        high_priority_count = cursor.fetchone()[0]

        # Total Complaints
        complaint_where = ""
        comp_params: List[Any] = []
        if role not in ["SUPER_ADMIN", "ADMIN"]:
            conditions = []
            for slug in user_dept_slugs:
                conditions.append("LOWER(department) LIKE ?")
                comp_params.append(f"%{slug.replace('_', ' ')}%")
            complaint_where = f"WHERE ({' OR '.join(conditions)})" if conditions else "WHERE 1=0"

        cursor.execute(f"SELECT COUNT(*) FROM complaints {complaint_where}", comp_params)
        total_complaints = cursor.fetchone()[0]

        # Department Workload
        cursor.execute(f"""
            SELECT department, COUNT(*) as issue_count,
                   SUM(CASE WHEN LOWER(status) = 'resolved' OR desk_status IN ('RESOLVED', 'CLOSED') THEN 1 ELSE 0 END) as resolved_count,
                   SUM(CASE WHEN LOWER(priority) IN ('high', 'critical') THEN 1 ELSE 0 END) as high_risk_count
            FROM issues {where_clause}
            GROUP BY department
        """, params)
        workload = [dict(r) for r in cursor.fetchall()]

        return {
            "success": True,
            "role": role,
            "department": current_user.get("department_slug"),
            "user_name": current_user.get("name"),
            "stats": {
                "total_issues": total_issues,
                "total_complaints": total_complaints,
                "new": new_count,
                "assigned": assigned_count,
                "in_progress": in_progress_count,
                "on_hold": on_hold_count,
                "completed": completed_count,
                "resolved": resolved_count,
                "high_critical": high_priority_count,
            },
            "workload": workload
        }

# =====================================================================
# 2. Tickets List (Role-Enforced)
# =====================================================================

@router.get("/tickets")
async def list_tickets(
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: Dict[str, Any] = Depends(get_current_admin)
):
    """
    List tickets with search, filtering, and role isolation.
    """
    role = current_user.get("role", "").upper()
    user_dept_slugs = [s.strip().lower() for s in (current_user.get("department_slug") or "").split(",") if s.strip()]

    # If department manager or staff specifies department query parameter, verify they are allowed
    if department and role not in ["SUPER_ADMIN", "ADMIN"]:
        _check_department_access(current_user, department)

    query = """
        SELECT id, title, description, category, subcategory, priority, department, location,
               latitude, longitude, complaint_count, confirmed_count, status, safety_risk,
               urgency_reason, suggested_action, COALESCE(desk_status, 'NEW') as desk_status,
               assigned_officer_email, ack_at, resolved_at, closed_at, created_at, updated_at
        FROM issues
        WHERE 1=1
    """
    params: List[Any] = []

    # Enforce department restriction for department managers and staff
    if role not in ["SUPER_ADMIN", "ADMIN"]:
        conditions = []
        for slug in user_dept_slugs:
            conditions.append("LOWER(department) LIKE ?")
            params.append(f"%{slug.replace('_', ' ')}%")
        if conditions:
            query += f" AND ({' OR '.join(conditions)})"
        else:
            query += " AND 1=0"

    # Additional user query filters
    if department:
        query += " AND LOWER(department) LIKE ?"
        params.append(f"%{department.lower()}%")

    if priority and priority.lower() != "all":
        query += " AND LOWER(priority) = ?"
        params.append(priority.lower())

    if status and status.lower() != "all":
        # Handle desk_status matching
        st_upper = status.upper()
        if st_upper == "RESOLVED":
            query += " AND (LOWER(status) = 'resolved' OR desk_status IN ('RESOLVED', 'CLOSED'))"
        elif st_upper == "NEW":
            query += " AND (desk_status IS NULL OR desk_status IN ('NEW', 'EMAILED'))"
        elif st_upper == "ASSIGNED":
            query += " AND desk_status IN ('ASSIGNED', 'ACKNOWLEDGED')"
        elif st_upper == "ON_HOLD":
            query += " AND desk_status IN ('ON_HOLD', 'NEEDS_INFO')"
        elif st_upper == "COMPLETED":
            query += " AND desk_status IN ('COMPLETED', 'RESOLVED_PENDING_REVIEW')"
        else:
            query += " AND UPPER(desk_status) = ?"
            params.append(st_upper)

    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query += " AND (LOWER(title) LIKE ? OR LOWER(location) LIKE ? OR LOWER(category) LIKE ? OR LOWER(description) LIKE ?)"
        params.extend([term, term, term, term])

    query += " ORDER BY updated_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        tickets = [dict(r) for r in cursor.fetchall()]

        # Total count matching
        count_query = "SELECT COUNT(*) FROM issues WHERE 1=1"
        # We can run lightweight count
        return {
            "success": True,
            "count": len(tickets),
            "tickets": tickets
        }

# =====================================================================
# 3. Ticket Detail & Action History (Role-Enforced)
# =====================================================================

@router.get("/tickets/{ticket_id}")
async def get_ticket_detail(ticket_id: int, current_user: Dict[str, Any] = Depends(get_current_admin)):
    """
    Returns full ticket detail, clustered citizen complaints, notes, and timeline.
    Enforces that Department Managers cannot inspect tickets outside their department.
    """
    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM issues WHERE id = ?", (ticket_id,))
        issue_row = cursor.fetchone()
        if not issue_row:
            raise HTTPException(status_code=404, detail=f"Ticket #{ticket_id} not found.")

        issue = dict(issue_row)

        # Department RBAC check
        _check_department_access(current_user, issue.get("department", ""))

        # Fetch associated citizen complaints
        cursor.execute("""
            SELECT id, tracking_id, text, category, subcategory, priority, department, location,
                   latitude, longitude, summary, photo_url, safety_risk, reporter_name, reporter_phone, citizen_email, created_at
            FROM complaints
            WHERE issue_id = ?
            ORDER BY created_at DESC
        """, (ticket_id,))
        complaints = [dict(r) for r in cursor.fetchall()]

        # Fetch notes
        cursor.execute("""
            SELECT id, issue_id, author_email, author_name, note_type, content, created_at
            FROM ticket_notes
            WHERE issue_id = ?
            ORDER BY created_at ASC
        """, (ticket_id,))
        notes = [dict(r) for r in cursor.fetchall()]

        # Fetch status change history
        cursor.execute("""
            SELECT id, issue_id, old_status, new_status, changed_by, reason, created_at
            FROM ticket_status_history
            WHERE issue_id = ?
            ORDER BY created_at ASC
        """, (ticket_id,))
        status_history = [dict(r) for r in cursor.fetchall()]

        return {
            "success": True,
            "ticket": issue,
            "complaints": complaints,
            "notes": notes,
            "status_history": status_history
        }

# =====================================================================
# 4. Ticket Actions: Assign, Status Change, Add Note
# =====================================================================

@router.post("/tickets/{ticket_id}/assign")
async def assign_ticket(
    ticket_id: int,
    req: AssignTicketRequest,
    current_user: Dict[str, Any] = Depends(get_current_admin)
):
    """Assign ticket to an officer or team."""
    now = datetime.now(timezone.utc).isoformat()
    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM issues WHERE id = ?", (ticket_id,))
        issue = cursor.fetchone()
        if not issue:
            raise HTTPException(status_code=404, detail="Ticket not found.")

        _check_department_access(current_user, issue["department"])

        old_status = issue["desk_status"] or "NEW"
        new_status = "ASSIGNED"

        cursor.execute("""
            UPDATE issues
            SET assigned_officer_email = ?, desk_status = ?, updated_at = ?
            WHERE id = ?
        """, (req.officer_email.strip().lower(), new_status, now, ticket_id))

        # Record in history
        cursor.execute("""
            INSERT INTO ticket_status_history (issue_id, old_status, new_status, changed_by, reason, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (ticket_id, old_status, new_status, current_user["email"], f"Assigned to {req.officer_email}: {req.note or 'Field assignment'}", now))

        # Record assignment note
        if req.note:
            cursor.execute("""
                INSERT INTO ticket_notes (issue_id, author_email, author_name, note_type, content, created_at)
                VALUES (?, ?, ?, 'internal', ?, ?)
            """, (ticket_id, current_user["email"], current_user.get("name", "Officer"), f"Assignment note: {req.note}", now))

        # Create in-app notification for assigned officer
        cursor.execute("""
            INSERT INTO notifications (recipient_email, title, message, issue_id, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (
            req.officer_email.strip().lower(),
            f"Ticket #{ticket_id} Assigned to You",
            f"You have been assigned to Master Issue #{ticket_id}: '{issue['title']}' ({issue['department']}).",
            ticket_id,
            now
        ))

        conn.commit()

        return {
            "success": True,
            "message": f"Ticket #{ticket_id} assigned to {req.officer_email}.",
            "assigned_officer_email": req.officer_email,
            "desk_status": new_status
        }

@router.post("/tickets/{ticket_id}/status")
async def update_ticket_status(
    ticket_id: int,
    req: TicketStatusRequest,
    current_user: Dict[str, Any] = Depends(get_current_admin)
):
    """
    Lifecycle transitions:
    NEW -> ASSIGNED -> IN_PROGRESS -> ON_HOLD -> COMPLETED -> RESOLVED.
    Updates issues table, logs in ticket_status_history, and updates customer tracking.
    """
    valid_statuses = ["NEW", "ASSIGNED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "RESOLVED", "REJECTED"]
    new_status = req.status.strip().upper()
    if new_status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{new_status}'. Must be one of: {', '.join(valid_statuses)}"
        )

    now = datetime.now(timezone.utc).isoformat()
    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM issues WHERE id = ?", (ticket_id,))
        issue = cursor.fetchone()
        if not issue:
            raise HTTPException(status_code=404, detail="Ticket not found.")

        _check_department_access(current_user, issue["department"])

        old_status = issue["desk_status"] or "NEW"

        # Determine updates to issues table
        issue_status_val = "resolved" if new_status == "RESOLVED" else "active"
        resolved_at_val = now if new_status == "RESOLVED" else issue["resolved_at"]
        proof_photo = req.proof_photo_url or issue["proof_photo_url"]
        res_note = req.resolution_note or issue["resolution_note"]

        cursor.execute("""
            UPDATE issues
            SET desk_status = ?, status = ?, resolved_at = ?, proof_photo_url = ?, resolution_note = ?, updated_at = ?
            WHERE id = ?
        """, (new_status, issue_status_val, resolved_at_val, proof_photo, res_note, now, ticket_id))

        # Log transition
        reason_text = req.reason or req.resolution_note or f"Status changed to {new_status}"
        cursor.execute("""
            INSERT INTO ticket_status_history (issue_id, old_status, new_status, changed_by, reason, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (ticket_id, old_status, new_status, current_user["email"], reason_text, now))

        # If on-hold or completed, log dedicated note
        if req.reason or req.resolution_note:
            cursor.execute("""
                INSERT INTO ticket_notes (issue_id, author_email, author_name, note_type, content, created_at)
                VALUES (?, ?, ?, 'system', ?, ?)
            """, (
                ticket_id,
                current_user["email"],
                current_user.get("name", "Operations Team"),
                f"Status: {new_status} — {reason_text}",
                now
            ))

        conn.commit()

        return {
            "success": True,
            "message": f"Ticket #{ticket_id} updated to {new_status}.",
            "issue_id": ticket_id,
            "desk_status": new_status,
            "status": issue_status_val
        }

@router.post("/tickets/{ticket_id}/notes")
async def add_ticket_note(
    ticket_id: int,
    req: TicketNoteRequest,
    current_user: Dict[str, Any] = Depends(get_current_admin)
):
    """Add internal or public note to ticket."""
    if not req.content.strip():
        raise HTTPException(status_code=400, detail="Note content cannot be empty.")

    now = datetime.now(timezone.utc).isoformat()
    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM issues WHERE id = ?", (ticket_id,))
        issue = cursor.fetchone()
        if not issue:
            raise HTTPException(status_code=404, detail="Ticket not found.")

        _check_department_access(current_user, issue["department"])

        cursor.execute("""
            INSERT INTO ticket_notes (issue_id, author_email, author_name, note_type, content, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (ticket_id, current_user["email"], current_user.get("name", "Officer"), req.note_type, req.content.strip(), now))

        note_id = cursor.lastrowid
        conn.commit()

        return {
            "success": True,
            "note_id": note_id,
            "message": "Note added successfully."
        }

# =====================================================================
# 5. In-App Notifications
# =====================================================================

@router.get("/notifications")
async def get_notifications(current_user: Dict[str, Any] = Depends(get_current_admin)):
    """Retrieve in-app notifications for current user."""
    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, title, message, issue_id, is_read, created_at
            FROM notifications
            WHERE recipient_email = ?
            ORDER BY created_at DESC
            LIMIT 20
        """, (current_user["email"],))
        rows = [dict(r) for r in cursor.fetchall()]
        unread_count = sum(1 for r in rows if not r["is_read"])
        return {
            "success": True,
            "unread_count": unread_count,
            "notifications": rows
        }

@router.post("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: int, current_user: Dict[str, Any] = Depends(get_current_admin)):
    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE notifications
            SET is_read = 1
            WHERE id = ? AND recipient_email = ?
        """, (notification_id, current_user["email"]))
        conn.commit()
        return {"success": True}

# =====================================================================
# 6. User Management (Super Admin only for create/edit/delete)
# =====================================================================

@router.get("/users")
async def list_users(current_user: Dict[str, Any] = Depends(require_roles(["SUPER_ADMIN", "ADMIN"]))):
    """List administrative users. Accessible to SUPER_ADMIN and ADMIN."""
    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, email, name, role, department_slug, is_active, last_login, created_at
            FROM admin_users
            ORDER BY id ASC
        """)
        users = [dict(r) for r in cursor.fetchall()]
        return {"success": True, "users": users}

@router.post("/users")
async def create_user(req: UserCreateRequest, current_user: Dict[str, Any] = Depends(require_roles(["SUPER_ADMIN"]))):
    """Create a new administrative user (Super Admin only)."""
    now = datetime.now(timezone.utc).isoformat()
    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM admin_users WHERE email = ?", (req.email.lower().strip(),))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="User with this email already exists.")

        hashed = bcrypt.hashpw(req.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        cursor.execute("""
            INSERT INTO admin_users (email, password_hash, name, role, department_slug, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, 1, ?)
        """, (req.email.lower().strip(), hashed, req.name.strip(), req.role.upper(), req.department_slug, now))
        new_id = cursor.lastrowid
        conn.commit()

        return {
            "success": True,
            "message": f"User {req.email} created successfully.",
            "user_id": new_id
        }

@router.put("/users/{user_id}")
async def update_user(
    user_id: int,
    req: UserUpdateRequest,
    current_user: Dict[str, Any] = Depends(require_roles(["SUPER_ADMIN"]))
):
    """Update user role, department, or active status (Super Admin only)."""
    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM admin_users WHERE id = ?", (user_id,))
        target = cursor.fetchone()
        if not target:
            raise HTTPException(status_code=404, detail="User not found.")

        updates = []
        params = []
        if req.name is not None:
            updates.append("name = ?")
            params.append(req.name.strip())
        if req.role is not None:
            updates.append("role = ?")
            params.append(req.role.upper())
        if req.department_slug is not None:
            updates.append("department_slug = ?")
            params.append(req.department_slug)
        if req.is_active is not None:
            updates.append("is_active = ?")
            params.append(req.is_active)
        if req.password:
            hashed = bcrypt.hashpw(req.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
            updates.append("password_hash = ?")
            params.append(hashed)

        if updates:
            params.append(user_id)
            cursor.execute(f"UPDATE admin_users SET {', '.join(updates)} WHERE id = ?", params)
            conn.commit()

        return {"success": True, "message": f"User #{user_id} updated successfully."}

@router.delete("/users/{user_id}")
async def deactivate_user(user_id: int, current_user: Dict[str, Any] = Depends(require_roles(["SUPER_ADMIN"]))):
    """Deactivate user account (Super Admin only)."""
    if current_user.get("id") == user_id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own Super Admin account.")

    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE admin_users SET is_active = 0 WHERE id = ?", (user_id,))
        conn.commit()
        return {"success": True, "message": f"User #{user_id} deactivated."}
