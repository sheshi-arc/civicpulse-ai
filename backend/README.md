# CivicPulse AI — Backend Service

FastAPI backend service connecting citizen complaint triage, routing, semantic similarity ("City Memory 2.0"), and automated issue clustering to local/hosted AI models via Ollama and SQLite.

## AI Models
- **Qwen3 (4B)**: Natural language comprehension, category classification, urgency assessment, safety risk detection, and municipal action recommendation.
- **BGE-M3**: 1024-dimensional dense semantic embeddings for duplicate detection and corridor clustering.
- **City Memory 2.0**: Geodesic proximity (Haversine $\le 1.0\text{ km}$) + Semantic similarity ($\ge 0.70$) clustering.

---

## ⚠️ Public Deployment Architecture

> [!IMPORTANT]
> **Vercel only hosts the Next.js frontend.**
> Do **NOT** attempt to deploy Ollama or the Python FastAPI backend to Vercel.

To run the CivicPulse AI backend publicly:
1. **Hosting Platform**: Deploy this FastAPI backend on an environment with Python 3.10+ and access to an Ollama instance (e.g., Linux VPS, AWS EC2, GCP Compute Engine, DigitalOcean Droplet, Railway, or RunPod).
2. **Ollama Instance**: The host or container must have `ollama` installed and models pulled:
   ```bash
   ollama pull qwen3:4b
   ollama pull bge-m3:latest
   ```
3. **Environment Variables**:
   ```bash
   HOST=0.0.0.0
   PORT=8000
   ALLOWED_ORIGINS=https://your-vercel-domain.vercel.app,http://localhost:3000
   OLLAMA_BASE_URL=http://localhost:11434
   ```

---

## Setup & Local Execution

### 1. Install Dependencies
```bash
python -m pip install -r requirements.txt
```

### 2. Verify Ollama Models
```bash
ollama list
```
Ensure both `qwen3:4b` and `bge-m3:latest` are listed.

### 3. Run Production Server
```bash
# Production runner (listens on 0.0.0.0, respects PORT and ALLOWED_ORIGINS)
python main.py

# Or via uvicorn directly:
uvicorn main:app --host 0.0.0.0 --port 8000
```

---

## Core Endpoints
- **Health & AI Status**: `GET /health`
- **Customer Complaint Submission**: `POST /api/submit-complaint`
- **Customer Ticket Tracking**: `GET /api/complaints/track/{tracking_id}`
- **Master Issues Map & List**: `GET /api/issues`, `GET /api/map/issues`
- **Admin Operations Desk**: `GET /api/admin/dashboard`, `GET /api/admin/tickets`
- **Role Authentication**: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- **City Memory Geodesic Clustering**: `POST /api/similarity`, `POST /api/analyze-complaint`
