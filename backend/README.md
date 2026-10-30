# CivicPulse AI - Backend Service

FastAPI backend service that connects citizen complaint triage, routing, semantic similarity ("City Memory"), and automated issue clustering to local AI models via Ollama and SQLite.

## AI Models Used

- **Qwen3 (4B):** Complaint understanding, categorization, priority assessment, department routing, location extraction, and dynamic title generation.
- **BGE-M3:** Dense semantic embeddings (1024-dim) for duplicate detection and recurring issue similarity.

## Requirements

- Python 3.10+
- Ollama running locally with `qwen3:4b` and `bge-m3`

## Setup & Installation

1. Install dependencies:
```bash
python -m pip install -r requirements.txt
```

2. Verify Ollama is running and has both models:
```bash
ollama list
```

## Running the Backend

Start the FastAPI development server:
```bash
python -m uvicorn main:app --reload --port 8000
```

The server automatically initializes `civicpulse.db` (SQLite) upon starting.

### Available Endpoints

- **Interactive API Docs (Swagger):** `http://localhost:8000/docs`
- **Health Check:** `GET /health`
- **Submit & Cluster Complaint:** `POST /api/submit-complaint`
- **List Master Issues:** `GET /api/issues` (supports `?status=active` or `?status=resolved`)
- **Get Issue Details:** `GET /api/issues/{issue_id}`
- **Resolve Issue:** `PATCH /api/issues/{issue_id}/resolve`
- **Single Complaint AI Analysis:** `POST /api/analyze-complaint`
- **Semantic Similarity Check:** `POST /api/similarity`
