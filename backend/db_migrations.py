import sqlite3
import bcrypt
from datetime import datetime, timezone
from pathlib import Path
from config import (
    DEMO_MODE,
    SLA_ACK_MINUTES_DEFAULT,
    SLA_RESOLVE_HOURS_DEFAULT,
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
)

DB_PATH = Path(__file__).resolve().parent / "civicpulse.db"

SEEDED_DEPARTMENTS = [
    {
        "slug": "public_works",
        "name": "Public Works Department",
        "desk_email": "sheshitejs@gmail.com",
        "head_email": "sheshitejs@gmail.com",
        "commissioner_email": "sheshitejs@gmail.com",
    },
    {
        "slug": "sanitation",
        "name": "Sanitation & Waste Management",
        "desk_email": "ssheshitej96@gmail.com",
        "head_email": "ssheshitej96@gmail.com",
        "commissioner_email": "sheshitejs@gmail.com",
    },
    {
        "slug": "water_supply",
        "name": "Water Supply & Sewerage Board",
        "desk_email": "ssaicharan229@gmail.com",
        "head_email": "ssaicharan229@gmail.com",
        "commissioner_email": "sheshitejs@gmail.com",
    },
    {
        "slug": "electricity",
        "name": "Electricity & Street Lighting",
        "desk_email": "anaalia696@gmail.com",
        "head_email": "anaalia696@gmail.com",
        "commissioner_email": "sheshitejs@gmail.com",
    },
    {
        "slug": "traffic_safety",
        "name": "Traffic & Road Safety Authority",
        "desk_email": "nandhinichakala@gmail.com",
        "head_email": "nandhinichakala@gmail.com",
        "commissioner_email": "sheshitejs@gmail.com",
    },
    {
        "slug": "parks_environment",
        "name": "Parks & Urban Environment",
        "desk_email": "ssheshitej96@gmail.com",
        "head_email": "ssheshitej96@gmail.com",
        "commissioner_email": "sheshitejs@gmail.com",
    },
]

def category_to_department_slug(category: str = "", subcategory: str = "") -> str:
    """
    Mapping function from AI-triaged category/subcategory to department slug.
    roads/pothole -> public_works
    garbage/drain -> sanitation
    water leak -> water_supply
    streetlight/wire -> electricity
    signals/accident -> traffic_safety
    tree/park -> parks_environment
    fallback -> public_works
    """
    text = f"{category or ''} {subcategory or ''}".lower()
    
    # Exact slug / department checks
    if any(k in text for k in ["sanitation", "garbage", "trash", "waste", "drain", "sewage", "dump", "debris", "cleanliness", "bin"]):
        return "sanitation"
    if any(k in text for k in ["water", "pipeline", "leak", "pipe", "shortage", "contamination", "sewerage"]):
        return "water_supply"
    if any(k in text for k in ["electricity", "street light", "streetlight", "electric", "wire", "pole", "transformer", "power"]):
        return "electricity"
    if any(k in text for k in ["traffic", "signal", "accident", "congestion", "zebra", "speed breaker", "signboard", "safety"]):
        return "traffic_safety"
    if any(k in text for k in ["park", "tree", "garden", "greenery", "plant", "horticulture", "branch", "environment"]):
        return "parks_environment"
    if any(k in text for k in ["road", "pothole", "footpath", "bridge", "asphalt", "pavement", "public works", "works"]):
        return "public_works"

    return "public_works"

def run_migrations(conn: sqlite3.Connection):
    """Safe, idempotent database schema migrations for Accountability Desk."""
    cursor = conn.cursor()

    # 1. departments table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS departments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            desk_email TEXT NOT NULL,
            head_email TEXT NOT NULL,
            commissioner_email TEXT NOT NULL,
            sla_ack_minutes INTEGER NOT NULL,
            sla_resolve_hours REAL NOT NULL,
            trust_score REAL DEFAULT 50.0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # Seed departments if empty
    cursor.execute("SELECT COUNT(*) FROM departments")
    if cursor.fetchone()[0] == 0:
        for dept in SEEDED_DEPARTMENTS:
            cursor.execute("""
                INSERT INTO departments (slug, name, desk_email, head_email, commissioner_email, sla_ack_minutes, sla_resolve_hours, trust_score)
                VALUES (?, ?, ?, ?, ?, ?, ?, 50.0)
            """, (
                dept["slug"],
                dept["name"],
                dept["desk_email"],
                dept["head_email"],
                dept["commissioner_email"],
                SLA_ACK_MINUTES_DEFAULT,
                SLA_RESOLVE_HOURS_DEFAULT,
            ))

    # 2. Extend issues table
    cursor.execute("PRAGMA table_info(issues)")
    issue_cols = [c[1] for c in cursor.fetchall()]

    new_issue_cols = [
        ("department_id", "INTEGER"),
        ("desk_status", "TEXT DEFAULT 'NEW'"),
        ("assigned_officer_email", "TEXT"),
        ("ack_at", "TIMESTAMP"),
        ("closed_at", "TIMESTAMP"),
        ("reopen_count", "INTEGER DEFAULT 0"),
        ("last_surge_threshold", "INTEGER DEFAULT 0"),
        ("escalation_level", "INTEGER DEFAULT 0"),
        ("proof_photo_url", "TEXT"),
        ("resolution_note", "TEXT"),
        ("resolution_receipt", "TEXT"),
    ]

    for col_name, col_type in new_issue_cols:
        if col_name not in issue_cols:
            cursor.execute(f"ALTER TABLE issues ADD COLUMN {col_name} {col_type};")

    # 3. desk_events (audit timeline)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS desk_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            issue_id INTEGER NOT NULL,
            event_type TEXT NOT NULL,
            actor TEXT NOT NULL,
            detail_json TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(issue_id) REFERENCES issues(id)
        );
    """)

    # 4. email_log
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS email_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            issue_id INTEGER,
            to_email TEXT NOT NULL,
            template TEXT NOT NULL,
            subject TEXT NOT NULL,
            status TEXT NOT NULL,
            error TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # 5. action_tokens
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS action_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            issue_id INTEGER NOT NULL,
            action TEXT NOT NULL,
            officer_email TEXT NOT NULL,
            token_hash TEXT NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            used_at TIMESTAMP
        );
    """)

    # 6. reviews
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            issue_id INTEGER NOT NULL,
            complaint_id INTEGER,
            citizen_email TEXT NOT NULL,
            rating INTEGER NOT NULL,
            comment TEXT,
            still_broken INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # 7. complaints: add citizen_email column if missing
    cursor.execute("PRAGMA table_info(complaints)")
    complaint_cols = [c[1] for c in cursor.fetchall()]
    if "citizen_email" not in complaint_cols:
        cursor.execute("ALTER TABLE complaints ADD COLUMN citizen_email TEXT;")

    # 8. admin_users
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS admin_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # Seed admin user if not exists
    cursor.execute("SELECT id FROM admin_users WHERE email = ?", (ADMIN_EMAIL,))
    if not cursor.fetchone():
        hashed = bcrypt.hashpw(ADMIN_PASSWORD.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        cursor.execute("INSERT INTO admin_users (email, password_hash) VALUES (?, ?)", (ADMIN_EMAIL, hashed))

    # Create helpful indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_desk_events_issue_id ON desk_events(issue_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_action_tokens_hash ON action_tokens(token_hash);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_reviews_issue_id ON reviews(issue_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_email_log_issue ON email_log(issue_id);")

    conn.commit()

def init_app_database():
    """Initializes the database and ensures all migrations are applied."""
    with sqlite3.connect(DB_PATH) as conn:
        run_migrations(conn)

if __name__ == "__main__":
    init_app_database()
    print("Database migrations applied successfully!")
