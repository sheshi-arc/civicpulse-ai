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

def create_access_token(email: str, role: str = "commissioner") -> str:
    now_utc = datetime.now(timezone.utc)
    payload = {
        "sub": email,
        "role": role,
        "iat": now_utc,
        "exp": now_utc + timedelta(hours=8)
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
    """Dependency: Extract admin session from HttpOnly cookie or Authorization header."""
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]

    if not token:
        raise HTTPException(status_code=401, detail="Authentication required. Please sign in.")

    payload = decode_access_token(token)
    email = payload.get("sub")

    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, email, role FROM admin_users WHERE email = ?", (email,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=401, detail="Admin account does not exist.")
        return dict(user)

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

        try:
            is_valid = bcrypt.checkpw(req.password.encode("utf-8"), user["password_hash"].encode("utf-8"))
        except Exception:
            is_valid = False

        if not is_valid:
            record_failed_attempt(client_ip, req.email)
            raise HTTPException(status_code=401, detail="Invalid credentials.")

        # Successful login
        clear_failed_attempts(client_ip, req.email)
        token = create_access_token(user["email"], user["role"] or "commissioner")

        # Set HttpOnly, SameSite=Lax cookie (8 hours)
        response.set_cookie(
            key="access_token",
            value=token,
            max_age=8 * 3600,
            httponly=True,
            samesite="lax",
            secure=False  # True in production HTTPS
        )

        return {
            "success": True,
            "message": "Signed in successfully",
            "token": token,
            "user": {
                "email": user["email"],
                "role": user["role"]
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
