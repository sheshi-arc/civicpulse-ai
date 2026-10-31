import os
from pathlib import Path

# Load .env file manually if exists
env_path = Path(__file__).resolve().parent / ".env"
if env_path.exists():
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                os.environ.setdefault(key.strip(), val.strip())

# Configuration constants
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "your_sender@gmail.com")
SMTP_APP_PASSWORD = os.getenv("SMTP_APP_PASSWORD", "xxxx xxxx xxxx xxxx")
EMAIL_FROM_NAME = os.getenv("EMAIL_FROM_NAME", "CivicPulse AI Desk")

PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "http://localhost:3000")
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")

TOKEN_SECRET = os.getenv("TOKEN_SECRET", "civicpulse-token-secret-accountability-desk-key-2026")
JWT_SECRET = os.getenv("JWT_SECRET", "civicpulse-jwt-super-secret-signature-key-2026")

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "ssheshitej96@gmail.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "CivicPulse@Admin2026!")

DEMO_MODE = os.getenv("DEMO_MODE", "true").lower() in ("true", "1", "yes")

# SLA Configuration (minutes)
# In DEMO_MODE, SLA ack is 2 min, resolve is 6 min
# In normal mode, SLA ack is 30 min, resolve is 72 hours (4320 min)
SLA_ACK_MINUTES_DEFAULT = 2 if DEMO_MODE else 30
SLA_RESOLVE_HOURS_DEFAULT = 0.1 if DEMO_MODE else 72.0  # 6 min in demo mode

# Base directory and Database path
BASE_DIR = str(Path(__file__).resolve().parent)
DB_PATH = str(Path(__file__).resolve().parent / "civicpulse.db")

# Server host & port for production
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))

# Production-ready CORS origins
CORS_ORIGINS_RAW = os.getenv("ALLOWED_ORIGINS") or os.getenv("CORS_ORIGINS") or ""
DEFAULT_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "https://civicpulse-ai-git-main-hackpulse.vercel.app",
    "https://civicpulse-q9phsg9cc-hackpulse.vercel.app",
    "https://civicpulse-ai.vercel.app",
]

ALLOWED_ORIGINS = [orig.strip() for orig in CORS_ORIGINS_RAW.split(",") if orig.strip()] if CORS_ORIGINS_RAW else list(DEFAULT_ORIGINS)
for d in DEFAULT_ORIGINS:
    if d not in ALLOWED_ORIGINS:
        ALLOWED_ORIGINS.append(d)

# Ollama API configurations
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
OLLAMA_CHAT_URL = os.getenv("OLLAMA_CHAT_URL", f"{OLLAMA_BASE_URL}/api/chat")
OLLAMA_CHAT_MODEL = os.getenv("OLLAMA_CHAT_MODEL", "qwen3:4b")
OLLAMA_EMBED_URL = os.getenv("OLLAMA_EMBED_URL", f"{OLLAMA_BASE_URL}/api/embed")
OLLAMA_EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "bge-m3")
SIMILARITY_THRESHOLD = float(os.getenv("SIMILARITY_THRESHOLD", "0.70"))

PRIORITY_LEVELS = ["Low", "Medium", "High", "Critical"]

# Outbox directory for offline email demo
OUTBOX_DIR = Path(__file__).resolve().parent / "outbox"
OUTBOX_DIR.mkdir(exist_ok=True)

