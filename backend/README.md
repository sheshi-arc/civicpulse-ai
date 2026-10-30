# CivicPulse AI - Backend Service

FastAPI backend service that connects citizen complaint triage, routing, and semantic similarity ("City Memory") to local AI models via Ollama.

## AI Models Used

- **Qwen3 (4B):** Complaint understanding, categorization, priority assessment, department routing, location extraction, and summarization.
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

The server will be available at:
- API Base: `http://localhost:8000`
- Interactive API Docs (Swagger): `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/health`
- Analyze Complaint: `http://localhost:8000/api/analyze-complaint`
- Semantic Similarity ("City Memory"): `http://localhost:8000/api/similarity`
