import time
import sqlite3
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from fastapi import APIRouter, Request, Response, HTTPException, Depends
from pydantic import BaseModel, EmailStr

from config import (
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    JWT_SECRET,
    DB_PATH
)

router = APIRouter(prefix="/api/auth", tags=["Admin Auth"])

# Rate limiting store: key (ip:email) -> list of failed attempt timestamps
_LOGIN_ATTEMPTS: Dict[str, list] = {}
LOCKOUT_WINDOW_SECONDS = 15 * 60  # 15 minutes
MAX_FAILED_ATTEMPTS = 5

def _get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_admin_user():
    """Ensure the municipal admin user exists on system startup."""
    if not ADMIN_EMAIL or not ADMIN_PASSWORD:
        return
    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM admin_users WHERE email = ?", (ADMIN_EMAIL,))
        existing = cursor.fetchone()
        
        # Salt & hash with bcrypt
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(ADMIN_PASSWORD.encode("utf-8"), salt).decode("utf-8")
        
        if not existing:
            cursor.execute("""
                INSERT INTO admin_users (email, password_hash, role, created_at)
                VALUES (?, ?, 'commissioner', ?)
            """, (ADMIN_EMAIL, hashed, datetime.now(timezone.utc).isoformat()))
            conn.commit()
            print(f"[Auth] Initialized default admin account: {ADMIN_EMAIL}")
        else:
            # Refresh password hash if updated in .env
            cursor.execute("""
                UPDATE admin_users SET password_hash = ? WHERE email = ?
            """, (hashed, ADMIN_EMAIL))
            conn.commit()

def is_rate_limited(ip: str, email: str) -> bool:
    key = f"{ip}:{email.strip().lower()}"
    now = time.time()
    attempts = _LOGIN_ATTEMPTS.get(key, [])
    # Filter attempts within window
    valid_attempts = [t for t in attempts if now - t < LOCKOUT_WINDOW_SECONDS]
    _LOGIN_ATTEMPTS[key] = valid_attempts
    return len(valid_attempts) >= MAX_FAILED_ATTEMPTS

def record_failed_attempt(ip: str, email: str):
    key = f"{ip}:{email.strip().lower()}"
    now = time.time()
    attempts = _LOGIN_ATTEMPTS.get(key, [])
    attempts.append(now)
    _LOGIN_ATTEMPTS[key] = attempts

def clear_failed_attempts(ip: str, email: str):
    key = f"{ip}:{email.strip().lower()}"
    _LOGIN_ATTEMPTS.pop(key, None)

def create_access_token(
    email: str,
    role: str = "ADMIN",
    user_id: Optional[int] = None,
    department_slug: Optional[str] = None,
    name: Optional[str] = None
) -> str:
    now_utc = datetime.now(timezone.utc)
    payload = {
        "sub": email,
        "user_id": user_id,
        "role": role,
        "department_slug": department_slug or "",
        "name": name or "",
        "iat": now_utc,
        "exp": now_utc + timedelta(hours=12)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def decode_access_token(token: str) -> Dict[str, Any]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid session credentials.")

async def get_current_admin(request: Request) -> Dict[str, Any]:
    """Dependency: Extract admin session from Authorization header or HttpOnly cookie."""
    token = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]

    if not token:
        token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(status_code=401, detail="Authentication required. Please sign in.")

    payload = decode_access_token(token)
    email = payload.get("sub")

    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, email, name, role, department_slug, is_active, last_login 
            FROM admin_users WHERE email = ?
        """, (email,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=401, detail="Admin account does not exist.")
        if not user["is_active"]:
            raise HTTPException(status_code=403, detail="Account has been deactivated.")
        return dict(user)

def require_roles(allowed_roles: list[str]):
    """Role-based access control dependency factory."""
    async def role_checker(current_user: Dict[str, Any] = Depends(get_current_admin)):
        user_role = (current_user.get("role") or "").upper()
        normalized_allowed = [r.upper() for r in allowed_roles]
        if user_role not in normalized_allowed:
            raise HTTPException(
                status_code=403,
                detail=f"Unauthorized: Access requires one of {allowed_roles}, but your role is {user_role}."
            )
        return current_user
    return role_checker

class LoginRequest(BaseModel):
    email: str
    password: str

@router.post("/login")
async def login(req: LoginRequest, request: Request, response: Response):
    client_ip = request.client.host if request.client else "127.0.0.1"

    if is_rate_limited(client_ip, req.email):
        raise HTTPException(
            status_code=429,
            detail="Too many failed login attempts. Please wait 15 minutes before trying again."
        )

    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM admin_users WHERE email = ?", (req.email.lower().strip(),))
        user = cursor.fetchone()

        if not user or not user["password_hash"]:
            record_failed_attempt(client_ip, req.email)
            raise HTTPException(status_code=401, detail="Invalid credentials.")

        if not user["is_active"]:
            raise HTTPException(status_code=403, detail="Account has been deactivated. Please contact Super Admin.")

        try:
            is_valid = bcrypt.checkpw(req.password.encode("utf-8"), user["password_hash"].encode("utf-8"))
        except Exception:
            is_valid = False

        if not is_valid:
            record_failed_attempt(client_ip, req.email)
            raise HTTPException(status_code=401, detail="Invalid credentials.")

        # Update last login timestamp
        now = datetime.now(timezone.utc).isoformat()
        cursor.execute("UPDATE admin_users SET last_login = ? WHERE id = ?", (now, user["id"]))
        conn.commit()

        # Successful login
        clear_failed_attempts(client_ip, req.email)
        token = create_access_token(
            email=user["email"],
            role=user["role"] or "ADMIN",
            user_id=user["id"],
            department_slug=user["department_slug"],
            name=user["name"]
        )

        # Set HttpOnly, SameSite=Lax cookie (12 hours)
        response.set_cookie(
            key="access_token",
            value=token,
            max_age=12 * 3600,
            httponly=True,
            samesite="lax",
            secure=False  # True in production HTTPS
        )

        return {
            "success": True,
            "message": "Signed in successfully",
            "token": token,
            "user": {
                "id": user["id"],
                "email": user["email"],
                "name": user["name"],
                "role": user["role"],
                "department_slug": user["department_slug"]
            }
        }

@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key="access_token")
    return {"success": True, "message": "Signed out successfully"}

@router.get("/me")
async def get_me(current_admin: Dict[str, Any] = Depends(get_current_admin)):
    return {
        "success": True,
        "user": current_admin
    }
