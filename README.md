# Jinvani · The Jain Micro-Reader

> A trilingual (EN / HI / GU) Inshorts-style app for reading 60-word classical Jain scripture summaries.

## Monorepo Structure

```
jinvani-core/
├── mobile/     # Expo (React Native) — vertical swipe feed
└── backend/    # FastAPI (Python) + Supabase PostgreSQL
```

## Quick Start

### Mobile
```bash
cd mobile
npm install
expo start --ios
```

### Backend
```bash
cd backend
cp .env.example .env   # fill in SUPABASE_URL + SUPABASE_KEY
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API docs available at `http://localhost:8000/docs`
