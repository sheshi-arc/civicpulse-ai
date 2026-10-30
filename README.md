# CivicPulse AI

> **Turn citizen complaints into actionable city intelligence.**  
> An AI-powered civic platform combining **Qwen3 language triage**, **BGE-M3 semantic embeddings**, and **Haversine geodesic proximity (City Memory 2.0)** to deduplicate complaints and automate municipal dispatch.

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-16.4+-black.svg?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178c6.svg?logo=typescript)](https://www.typescriptlang.org)
[![Ollama](https://img.shields.io/badge/Ollama-Qwen3%20%2B%20BGE--M3-white.svg)](https://ollama.ai)

---

## 🌟 The Core Breakthrough: City Memory 2.0

Traditional municipal ticket systems treat every citizen complaint as an isolated ticket. When 50 citizens report the same road crater near the university gate using 50 different phrases, legacy systems create 50 duplicate tickets, overwhelming municipal staff.

**CivicPulse AI solves this with City Memory 2.0:**
$$\text{Similar Language} + \text{Nearby Location} = \text{Consolidated Master Issue}$$
$$\text{Similar Language} + \text{Far-Away Location} = \text{Distinct Work Orders Maintained}$$

```
                           Citizen Complaint
                                   │
                                   ▼
                ┌─────────────────────────────────────┐
                │   BGE-M3 (1024-dim Vector)         │
                │   Cosine Semantic Similarity        │
                └──────────────────┬──────────────────┘
                                   │
                   ┌───────────────┴───────────────┐
                   ▼                               ▼
         Language Alignment?              Geographic Proximity?
        (Cosine Similarity ≥ 0.70)       (Haversine Distance ≤ 1.0 km)
                   │                               │
                   └───────────────┬───────────────┘
                                   │
                                   ▼
                 ┌───────────────────────────────────┐
                 │    City Memory 2.0 Decision       │
                 │                                   │
                 │ Case A: Sim ≥ 0.70 & Dist ≤ 1.0 km │ ──► MERGE Master Issue
                 │ Case B: Sim ≥ 0.80 & Dist ≤ 3.0 km │ ──► MERGE Corridor Issue
                 │ Case C: Sim ≥ 0.85 & Dist > 3.0 km │ ──► ISOLATE Distinct Issue
                 │ Case D: Sim < 0.70                 │ ──► ISOLATE Different Issue
                 │ Fallback: Sim ≥ 0.75 (No GPS)     │ ──► Non-Spatial Merge
                 └───────────────────────────────────┘
```

---

## 🚀 Key Features

- **Public Citizen Reporting (`/report`)**: Plain language problem input, browser geolocation (`Use My Location`), OpenStreetMap pin-drop, evidence photo upload, voice dictation, and real-time multi-stage AI triage.
- **City Memory 2.0 (`/`)**: Visual explanation and interactive scenarios demonstrating nearby consolidation vs. distant ward isolation.
- **Interactive Public Map (`/map`)**: Real-time Leaflet/OpenStreetMap explorer with category, department, priority filters, "Near Me" detection, and dynamic 1.0 km clustering catchment circles.
- **Citizen Order-Tracking (`/track`)**: Transparent lifecycle tracking by tracking ID (e.g., `CP-2026-00001`), real-time status banners, assigned department, and resolution verification.
- **Municipal Command Center (`/admin`)**: Operations command console with live KPIs, embedded city intelligence map, priority dispatch queue, department workload distributions, and master work orders management.
- **Command Map & Hotspots (`/admin/map`)**: Full-canvas telemetry map with cluster hotspots and rapid work order resolution.
- **Civic Analytics (`/admin/analytics`)**: Real data visualizations for deduplication ratios, resolution efficiency, category breakdowns, and priority profiles.

---

## 🛠️ Architecture & Tech Stack

- **Frontend**: Next.js 16 (App Router, Turbopack, React 19), TypeScript, Tailwind CSS, Leaflet.js / OpenStreetMap.
- **Backend**: Python 3.14, FastAPI, SQLite (ACID-compliant relational store with foreign keys and WAL mode), Pydantic v2.
- **Local AI Engine**: Ollama running:
  - `qwen3:4b`: Citizen complaint understanding, category classification, urgency assessment, safety risk detection, and municipal action recommendation.
  - `bge-m3:latest`: 1024-dimensional dense semantic embeddings for issue similarity.

---

## 💻 Quick Start & Local Setup

### 1. Prerequisites
- Python 3.11+
- Node.js 18+ & npm
- [Ollama](https://ollama.ai) installed and running locally

```bash
# Pull local models
ollama pull qwen3:4b
ollama pull bge-m3:latest
```

### 2. Backend Setup
```bash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env

# Run FastAPI backend on port 8000
python -m uvicorn main:app --reload --port 8000
```

### 3. Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env.local

# Run Next.js on port 3000
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to open the CivicPulse AI platform.

---

## 🧪 Testing & Verification

Run the full automated test suite:

```bash
# 1. Frontend ESLint Check
cd frontend && npm run lint

# 2. Frontend TypeScript Check
npx tsc --noEmit

# 3. Next.js Production Build
npm run build

# 4. Backend Unit & Geodesic Tests (14/14 tests)
cd .. && python -m pytest backend/tests/ -v
```

---

## 📄 License
Licensed under the [Apache License 2.0](LICENSE).
