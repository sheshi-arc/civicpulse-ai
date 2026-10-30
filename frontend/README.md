# Frontend — CivicPulse AI

Intelligent civic problem reporting, tracking portal, and municipal operations command center.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fsheshi-arc%2Fcivicpulse-ai&root-directory=frontend)

## Features
- **Public Request Portal (`/request`)**: GPS pin drop, photo upload, full contact tracking, real-time ticket ID generation.
- **Order Lifecycle Tracking (`/track`)**: Transparent status workflow (`NEW` → `ASSIGNED` → `IN_PROGRESS` → `ON_HOLD` → `COMPLETED` → `RESOLVED`) with IDOR contact protection.
- **Interactive City Map (`/map`)**: OpenStreetMap live problem explorer with category and urgency filters.
- **Municipal Command Center (`/admin`)**: Operations desk with 5 role-based access tiers (`SUPER_ADMIN`, `ADMIN`, `DEPARTMENT_MANAGER` across Public Works, Sanitation, Water, Electricity, Traffic).
- **Dark / Light Theme System**: Integrated across all citizen and operations views.

## Vercel Deployment
Direct Deploy Link:
```
https://vercel.com/new/clone?repository-url=https://github.com/sheshi-arc/civicpulse-ai&root-directory=frontend
```

When importing into Vercel:
- **Framework Preset**: Next.js
- **Root Directory**: `frontend`
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Environment Variables**:
  - `NEXT_PUBLIC_API_URL`: Backend API URL (defaults to `http://localhost:8000` for local development)
