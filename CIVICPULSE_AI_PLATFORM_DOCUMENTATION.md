# CivicPulse AI — Comprehensive Platform Architecture & Product Documentation

> **AI-Powered Civic Problem Reporting, Intelligence & City Memory Platform**  
> *Turning thousands of scattered citizen complaints into actionable, deduplicated real-world municipal issues.*

---

## 1. Executive Summary & Product Vision

CivicPulse AI is an enterprise-grade civic problem reporting and intelligence platform designed for:
1. **Citizens:** Fast (<30s) multi-modal complaint reporting via text, voice, pin-drop maps, and photo evidence.
2. **Municipal Officers & Ward Authorities:** Operational command center for real-time triage, live map telemetry, hotspot identification, and resolution workflows.
3. **Department Staff (Public Works, Sanitation, Water Supply, Electricity, Traffic):** Automated department routing, SLA tracking, and action queues.
4. **Universities, Campuses & Residential Communities:** Community maintenance, defect reporting, and localized facility management.

### The Core Value Proposition: "City Memory"
In conventional municipal systems, when 50 citizens report the same real-world problem (e.g., a dangerous pothole near the main entrance), they submit 50 different tickets described in 50 completely different ways:
- *"Massive pothole near the main gate"*
- *"Road is broken near entrance and bikes are slipping"*
- *"My scooter almost crashed because of the damaged road"*
- *"Large hole beside gate"*

In legacy systems, this generates 50 duplicate tickets, floods department backlogs, fragments citizen impact, and delays resolution.

**CivicPulse AI solves this with City Memory:**
Using a dual-model local AI pipeline (**Qwen3:4b** for natural language understanding and **BGE-M3** for 1024-dimensional semantic embeddings), CivicPulse AI recognizes that disparate reports describe the **same underlying real-world problem**, merges them into a single **Master Issue**, accumulates citizen impact metrics, and dispatches an actionable ticket to the responsible department.

```
Citizen Complaints (Text / Voice / Pin / Photo)
                    │
                    ▼
          ┌───────────────────┐
          │   Qwen3:4b AI     │  ───> Category, Priority, Department,
          │Natural Language   │       Safety Hazard, Urgency Reason,
          │Triage Engine      │       Suggested Action
          └───────────────────┘
                    │
                    ▼
          ┌───────────────────┐
          │     BGE-M3        │  ───> 1024-Dimensional Dense Vector
          │  City Memory      │       Cosine Similarity Comparison
          │ Semantic Engine   │       Threshold: ≥ 0.70
          └───────────────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
Similarity ≥ 0.70      Similarity < 0.70
         │                     │
         ▼                     ▼
┌──────────────────┐  ┌──────────────────┐
│  Merged with     │  │   Created New    │
│  Existing Master │  │   Master Issue   │
│  Issue           │  │                  │
└──────────────────┘  └──────────────────┘
         │                     │
         └──────────┬──────────┘
                    │
                    ▼
       ┌────────────────────────┐
       │   Automated Routing    │
       │   Public Works / Water │
       │   Sanitation / Power   │
       └────────────────────────┘
                    │
                    ▼
       ┌────────────────────────┐
       │  Synchronized Citizen  │
       │  Tracking Timeline     │
       └────────────────────────┘
```

---

## 2. Platform Architecture & Tech Stack

### Frontend Architecture
- **Framework:** Next.js 15 (App Router) + React 19 + TypeScript
- **Styling:** Tailwind CSS with a curated, high-trust civic tech palette (Clean light neutral slate `#f8fafc`, deep navy text `#0f172a`, civic blue accents `#2563eb`, and semantic status badges).
- **Mapping Engine:** Leaflet + OpenStreetMap (100% free, zero API keys, no watermarks, dynamic container resizing with `ResizeObserver` and `map.invalidateSize()`).
- **Voice Input:** Web Speech API (`webkitSpeechRecognition`) for hands-free speech-to-text dictation.
- **Port:** `http://localhost:3000`

### Backend Architecture
- **Framework:** FastAPI (Python 3.12) with asynchronous request handlers.
- **Server:** Uvicorn ASGI server with automatic reload.
- **Database:** SQLite (`backend/civicpulse.db`) with auto-executing schema migration scripts.
- **Static Assets:** Static file serving mounted at `/uploads` for citizen evidence photos.
- **Port:** `http://localhost:8000`

### AI Architecture (Local & Private via Ollama)
- **Ollama Daemon:** Running locally on port `11434`.
- **Classification Model:** `qwen3:4b` with `"think": false` for low-latency (~10s on CPU, <1.5s on GPU) zero-shot civic triage.
- **Semantic Embedding Model:** `bge-m3` generating 1024-dimensional dense vectors for semantic clustering.
- **Clustering Logic:** Cosine similarity calculation with a strict empirical threshold of `0.70`.

---

## 3. Product Experiences & Routes

The platform is split into three cohesive experiences:

| Experience | Route | Primary Audience | Description |
| :--- | :--- | :--- | :--- |
| **Public Landing Page** | `/` | Citizens & General Public | Hero banner, live city telemetry, visual pipeline diagram, City Memory showcase, and live OpenStreetMap preview. |
| **Citizen Fast Report** | `/report` | Citizens | 30-second complaint submission with voice input, quick problem chips, interactive OpenStreetMap pin picker, photo upload, and instant AI triage card. |
| **Full Interactive Map** | `/map` | Citizens & Officials | Full-screen civic map with priority-colored markers, category/status filters, "Problems Near Me" geolocation, and slide-over incident drawer with "I'm Affected Too" button. |
| **Citizen Status Tracking** | `/track` | Citizens | Real-time status lookup by tracking ID (`CP-2026-XXXX`) with a 5-stage progress timeline and quick-test sample chips. |
| **Public Issue Detail** | `/issues/[id]` | Citizens & Media | Master issue dossier showing map pin, AI triage summary, urgency reasons, municipal suggestions, merged citizen reports, and community confirmation counter. |
| **Municipal Command Center** | `/admin` | Administrators & Ward Officers | Operations dashboard with real-time KPI counters, search, priority/department filters, and one-click resolution dispatch. |
| **Admin Live Command Map** | `/admin/map` | Dispatch Officers | Dark-ops live map with an **Identified Hotspots** panel ranking problem zones by citizen complaint density. |
| **Analytics & Trends** | `/admin/analytics` | Municipal Leadership | Data-driven charts: Category distribution, Department workloads, Deduplication ratios, and Top geographic hotspots. |
| **Department Workflows** | `/admin/departments` | Department Heads | Dedicated queues for Public Works, Sanitation, Water Works, Electricity, Traffic, Parks, and Public Safety. |

---

## 4. Key Feature Deep-Dives

### 4.1. Fast Citizen Reporting (`/report`)
- **Natural Language Input:** Citizens can describe issues freely without needing to learn administrative taxonomy.
- **Quick Problem Presets:** Pre-fills common civic complaints (Pothole, Overflowing Garbage, Broken Streetlight, Water Leak, Traffic Signal) in 1 click.
- **Voice Speech-to-Text (🎤):** Real-time browser speech recognition automatically transcribing dictation into the description box.
- **Leaflet OpenStreetMap Pin Picker:** Draggable teardrop SVG pin marker anchored precisely at the point `[18, 44]`, with instant GPS location detection.
- **Evidence Photo Upload (`/api/upload`):** Safely uploads citizen images, stored on disk, and transparently labeled as *"Citizen Evidence"* (no fabricated vision claims).
- **Instant Result Screen:** Generates an official tracking ID (`CP-2026-XXXX`), displays the attached Master Issue, and shows the exact semantic similarity score.

### 4.2. Interactive City Map (`/map`)
- **Priority-Coded Markers:**
  - 🔴 **Critical:** Red circular marker with pulse ring.
  - 🟠 **High:** Orange marker.
  - 🟡 **Medium:** Yellow marker.
  - 🟢 **Low:** Green marker.
  - ⚪ **Resolved:** Slate/gray marker.
- **Dynamic Sizing:** Marker radius scales logarithmically based on the number of merged citizen complaints (`complaint_count`).
- **Interactive Drawer:** Selecting any marker opens an incident card with title, department, priority, report count, "View Details" button, and an "I'm Affected Too" button that increments community urgency.

### 4.3. Citizen Complaint Tracking (`/track`)
- **Lookup:** Input any citizen tracking ID (e.g. `CP-2026-00001` or deep link `/track?id=CP-2026-00001`).
- **Quick Sample Chips:** One-click sample test buttons for seamless hackathon demonstrations.
- **Live 5-Stage Stepped Timeline:**
  1. *Report Submitted* (timestamp)
  2. *AI Triage & Categorization* (detected category & priority)
  3. *City Memory Clustered* (Master Issue title & ID)
  4. *Routed to Department* (Public Works, Sanitation, etc.)
  5. *Resolution* (automatically toggles to *Resolved* when an administrator resolves the ticket in `/admin`).

### 4.4. Municipal Operations Command Center (`/admin`)
- **Real Backend KPIs:**
  - *Active Issues:* Count of open, actionable master issues.
  - *Raw Citizen Signals:* Total incoming citizen complaints received.
  - *Critical Hazards:* Issues flagged with immediate public danger.
  - *High Priority:* Issues requiring action within 24 hours.
  - *In Progress:* Dispatched issues actively under review.
  - *Resolution Rate:* Percentage of total issues resolved.
- **Operations Table:** Filter by status, priority, department, or keyword.
- **Instant Resolution:** Officers can click "Mark Resolved" to close issues, immediately updating the database, analytics, and citizen tracking pages.

---

## 5. Complete REST API Reference

All endpoints return standard JSON responses with strict Pydantic validation.

### 5.1. Health Check
- **Endpoint:** `GET /health`
- **Response:**
  ```json
  {
    "status": "ok",
    "service": "CivicPulse AI"
  }
  ```

### 5.2. Submit Complaint (AI Triage + City Memory)
- **Endpoint:** `POST /api/submit-complaint`
- **Request Body:**
  ```json
  {
    "complaint": "There is a deep dangerous pothole near the main entrance gate, bikes are slipping.",
    "location": "University Main Gate",
    "latitude": 17.4435,
    "longitude": 78.3772,
    "category": "Roads",
    "reporter_name": "Alex M.",
    "reporter_contact": "alex@city.org",
    "photo_url": "/uploads/evidence_123.jpg"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "complaint_id": 45,
    "tracking_id": "CP-2026-00013",
    "issue_id": 9,
    "matched_existing_issue": true,
    "similarity_score": 0.7343,
    "issue": {
      "id": 9,
      "title": "Main Gate Road Damage & Severe Pothole",
      "complaint_count": 3,
      "priority": "High",
      "department": "Public Works",
      "status": "active"
    },
    "analysis": {
      "title": "Main Gate Road Damage",
      "category": "Roads",
      "subcategory": "Pothole",
      "priority": "High",
      "department": "Public Works",
      "location": "University Main Gate",
      "summary": "Deep pothole causing hazard for two-wheelers.",
      "safety_risk": true,
      "urgency_reason": "High vehicular traffic and immediate hazard to two-wheeler riders.",
      "suggested_action": "Fill pothole with cold mix asphalt and inspect drainage."
    }
  }
  ```

### 5.3. Track Complaint
- **Endpoint:** `GET /api/complaints/track/{tracking_id}`
- **Response:**
  ```json
  {
    "success": true,
    "tracking_id": "CP-2026-00013",
    "issue_id": 9,
    "issue_title": "Main Gate Road Damage & Severe Pothole",
    "issue_status": "active",
    "status": "active",
    "priority": "High",
    "department": "Public Works",
    "location": "University Main Gate",
    "text": "Deep dangerous pothole near the main entrance gate, bikes are slipping.",
    "timeline": [
      { "step": "Report Submitted", "completed": true, "time": "2026-10-31T00:43:00Z" },
      { "step": "AI Triage & Categorization", "completed": true, "detail": "Roads (High)" },
      { "step": "City Memory Clustered", "completed": true, "detail": "Master Issue #9 - Main Gate Road Damage" },
      { "step": "Routed to Department", "completed": true, "detail": "Public Works" },
      { "step": "Resolution", "completed": false, "status": "In Progress" }
    ]
  }
  ```

### 5.4. Master Issues List
- **Endpoint:** `GET /api/issues`
- **Query Parameters:** `status`, `category`, `priority`, `department`, `limit`
- **Response:**
  ```json
  {
    "issues": [
      {
        "id": 1,
        "title": "Main Gate Road Surface Damage - Severe Potholes",
        "description": "Massive pothole cluster near University Main Gate...",
        "category": "Roads",
        "subcategory": "Pothole",
        "priority": "High",
        "department": "Public Works",
        "location": "University Main Gate",
        "latitude": 17.4435,
        "longitude": 78.3772,
        "complaint_count": 38,
        "confirmed_count": 4,
        "status": "active",
        "safety_risk": 1,
        "urgency_reason": "Multiple citizen reports of bike accidents.",
        "suggested_action": "Resurface road segment with asphalt.",
        "created_at": "2026-10-30T18:00:00Z",
        "updated_at": "2026-10-31T00:44:00Z",
        "resolved_at": null
      }
    ]
  }
  ```

### 5.5. Map Incidents
- **Endpoint:** `GET /api/map/issues`
- **Response:** Lightweight geospatial coordinates payload for map markers.

### 5.6. Issue Details & Underlying Complaints
- **Endpoint:** `GET /api/issues/{issue_id}`
- **Response:** Master issue metadata combined with the full array of underlying citizen complaints and photos.

### 5.7. Community "I'm Affected Too" Confirmation
- **Endpoint:** `POST /api/issues/{issue_id}/confirm`
- **Response:** Increments `confirmed_count` and `complaint_count`.

### 5.8. Officer Issue Resolution
- **Endpoint:** `PATCH /api/issues/{issue_id}/resolve`
- **Response:** Sets `status = 'resolved'` and records `resolved_at` timestamp.

### 5.9. Analytics Overview
- **Endpoint:** `GET /api/analytics/overview`
- **Response:**
  ```json
  {
    "total_issues": 6,
    "active_issues": 4,
    "resolved_issues": 2,
    "total_complaints": 14,
    "critical_priority_issues": 1,
    "high_priority_issues": 2,
    "citizens_participating": 14,
    "by_department": { "Public Works": 2, "Sanitation": 1, "Water Supply": 2, "Electricity": 1 },
    "by_category": { "Roads": 2, "Sanitation": 1, "Water Supply": 2, "Electricity": 1 },
    "top_hotspots": [
      { "location": "University Main Gate", "count": 38 },
      { "location": "Market Square Center", "count": 24 }
    ]
  }
  ```

### 5.10. Photo Upload
- **Endpoint:** `POST /api/upload`
- **Request:** `multipart/form-data` with `file`
- **Response:**
  ```json
  {
    "success": true,
    "url": "/uploads/1730335200_photo.jpg",
    "filename": "photo.jpg"
  }
  ```

### 5.11. Deterministic Seed Data
- **Endpoint:** `POST /api/seed`
- **Response:** Loads realistic, deterministic demo data (5 master issues with multiple complaints).

---

## 6. Database Schema & Data Integrity

The SQLite database is stored locally in `backend/civicpulse.db`.

```sql
CREATE TABLE IF NOT EXISTS issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    subcategory TEXT,
    priority TEXT NOT NULL,
    department TEXT NOT NULL,
    location TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    complaint_count INTEGER DEFAULT 1,
    confirmed_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    safety_risk INTEGER DEFAULT 0,
    urgency_reason TEXT,
    suggested_action TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS complaints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tracking_id TEXT UNIQUE,
    text TEXT NOT NULL,
    category TEXT,
    subcategory TEXT,
    priority TEXT,
    department TEXT,
    location TEXT,
    latitude REAL,
    longitude REAL,
    summary TEXT,
    photo_url TEXT,
    safety_risk INTEGER DEFAULT 0,
    issue_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(issue_id) REFERENCES issues(id)
);

CREATE INDEX IF NOT EXISTS idx_complaints_tracking_id ON complaints(tracking_id);
CREATE INDEX IF NOT EXISTS idx_complaints_issue_id ON complaints(issue_id);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
```

---

## 7. Verification & Testing Results

1. **TypeScript Compiler Check:**
   - Command: `npx tsc --noEmit`
   - **Result:** `0 errors` (100% type safe).
2. **HTTP Routes Check:**
   - All 9 routes verified returning `200 OK`:
     - `/` $\rightarrow$ `200 OK`
     - `/report` $\rightarrow$ `200 OK`
     - `/map` $\rightarrow$ `200 OK`
     - `/track` $\rightarrow$ `200 OK`
     - `/issues/1` $\rightarrow$ `200 OK`
     - `/admin` $\rightarrow$ `200 OK`
     - `/admin/map` $\rightarrow$ `200 OK`
     - `/admin/analytics` $\rightarrow$ `200 OK`
     - `/admin/departments` $\rightarrow$ `200 OK`
3. **Live AI Complaint Clustering Verification:**
   - Complaint 1: *"Deep dangerous pothole near the main entrance gate, bikes are slipping."*
     - $\rightarrow$ Generated Master Issue #9.
   - Complaint 2: *"The road near the main entrance gate is damaged with a big hole and two wheelers might crash."*
     - $\rightarrow$ BGE-M3 Similarity Score: **`0.7343`** (exceeds `0.70`).
     - $\rightarrow$ Merged into Master Issue #9 without duplicate ticket generation.
4. **Resolution Synchronization:**
   - Dispatched `PATCH /api/issues/9/resolve`.
   - Polled `GET /api/complaints/track/CP-2026-00014`.
   - **Result:** Status synchronously updated to `{"step": "Resolution", "completed": true, "status": "Resolved"}`.

---

## 8. Hackathon Presentation & Demo Script (3-Minute Walkthrough)

To present CivicPulse AI effectively to judges:

1. **Minute 1: The Problem & The Landing Page (`http://localhost:3000`)**
   - Open the homepage.
   - Show the live city counters (Total Complaints vs Master Issues). Highlight the **Deduplication Ratio**.
   - Explain the core concept: 50 citizens report 1 pothole in 50 different ways; legacy systems create 50 tickets. CivicPulse creates **ONE**.
   - Scroll to the **City Memory Showcase** component to demonstrate BGE-M3 semantic matching.

2. **Minute 2: The Citizen Experience (`/report` & `/map`)**
   - Click **"Report a Problem"**.
   - Tap a quick problem preset (*"⚠️ Deep pothole on the main road..."*) or use the **🎤 Voice Input** button.
   - Show the interactive **OpenStreetMap picker** and drag the pin.
   - Click **Submit**. Show the real-time AI triage card, the calculated similarity score (`73.4%`), and the generated tracking ID (`CP-2026-XXXX`).
   - Click **"See on Live Map"** (`/map`). Demonstrate the priority-coded pins and click a marker to view the slide-over incident drawer and the **"I'm Affected Too"** community confirmation button.

3. **Minute 3: The Municipal Command Center (`/admin`)**
   - Click **"Municipal Command"**.
   - Show the real-time operational KPIs and the Master Issues Management table.
   - Click **"Mark Resolved"** on an issue.
   - Navigate to `/track`, enter the tracking ID from Minute 2, and show the completed resolution timeline updated in real time.
   - Show `/admin/analytics` (Category breakdown, Department dispatch, and Top Hotspots).

---

## 9. How to Run Locally

### Start Backend
```bash
cd backend
python -m uvicorn main:app --port 8000 --reload
```

### Start Frontend
```bash
cd frontend
npm run dev -- -p 3000
```

### Seed Demo Data
Click the **"Load Demo Data"** button in the top navigation bar or trigger via terminal:
```bash
curl -X POST http://localhost:8000/api/seed
```
