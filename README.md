# CivicPulse AI

## Civic Complaint Triage and Routing

CivicPulse AI is an AI-powered civic complaint management system designed to help municipal teams understand, prioritize, route, and identify recurring problems hidden inside large numbers of citizen complaints.

### The Problem

Municipal teams receive many complaints such as potholes, garbage, drainage problems, broken streetlights, water leaks, and road damage.

Different citizens may describe the same real-world problem using completely different words.

For example:

- "Huge pothole near the main gate."
- "Road badly damaged near the entrance."
- "My bike nearly fell because of the pothole near the gate."

A traditional system may treat these as three separate complaints.

CivicPulse AI aims to recognize that they may represent one underlying civic issue.

### Our Solution

CivicPulse AI will:

1. Understand citizen complaints.
2. Classify the complaint.
3. Determine priority.
4. Recommend the responsible department.
5. Extract the reported location.
6. Find semantically similar complaints.
7. Group recurring complaints into issue clusters.
8. Provide a dashboard for municipal teams.

### AI Components

#### Qwen3

Used for:
- Complaint understanding
- Classification
- Priority assessment
- Department recommendation
- Location extraction
- Complaint summarization
- Multilingual understanding

#### BGE-M3

Used for:
- Semantic embeddings
- Complaint similarity
- Duplicate detection
- Recurring issue detection
- Issue clustering

Important: Antigravity is only being used as a development and coding assistant. It is not the AI component of the product.

### Planned Technology

- Next.js
- TypeScript
- Tailwind CSS
- Python
- FastAPI
- SQLite
- Qwen3
- BGE-M3
- Leaflet / OpenStreetMap

### Project Structure

```text
frontend/  - Web interface
backend/   - API and application logic
ai/        - AI components
data/      - Sample and test data
docs/      - Documentation
```
