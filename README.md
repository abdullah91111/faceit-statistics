# FACEIT CS2 Team Analyzer

Web app, FastAPI backend, and Chrome extension for pre-queue FACEIT CS2 analysis.

## Features

- FACEIT Data API v4 integration through the backend only.
- Player role detection for Entry, AWPer, Support, Lurker, Anchor, and Rifler.
- Team compatibility score from 0-10 with strengths, risks, and recommendations.
- Enemy scouting for map comfort, strong players, weak players, and playstyle indicators.
- Chrome Extension Manifest V3 popup for quick team checks.

## Setup

### Backend

```powershell
cd C:\WorkStuff\Github\faceit-statistics
python -m venv backend\.venv
.\backend\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env
.\scripts\start-backend.ps1
```

Run `.\scripts\start-backend.ps1` from the repository root. If you are already inside `backend`, run `python -m uvicorn main:app --port 8001` directly. update.

Set `FACEIT_API_KEY` in `backend/.env` for live FACEIT data. FACEIT's docs recommend server-side API keys for server-hosted code and sending them to FACEIT as `Authorization: Bearer <api_key>`, so the frontend and extension call this backend instead of storing the key in browser code.

`DATABASE_URL` is optional for this MVP. Leave it blank while the app computes everything in memory from FACEIT responses. Add it later when persistence, saved players, cached matches, or user accounts are introduced.

Supabase/PostgreSQL format:

```env
DATABASE_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
```

### Frontend

```powershell
cd C:\WorkStuff\Github\faceit-statistics
npm --prefix frontend install
Copy-Item frontend\.env.example frontend\.env
.\scripts\start-frontend.ps1
```

Run `.\scripts\start-frontend.ps1` from the repository root. If you are already inside `frontend`, run `npm run dev -- --port 5173` directly.

Open `http://localhost:5173`.

## Logs and API Responses

- Backend logs appear in the PowerShell window running `uvicorn`.
- Frontend logs appear in the PowerShell window running `npm run dev`.
- Browser errors/API calls are visible in Chrome DevTools: open `http://localhost:5173`, press `F12`, then use the Console and Network tabs.
- Interactive backend docs are available at `http://localhost:8001/docs`.
- Raw API responses can be tested with PowerShell:

```powershell
Invoke-RestMethod http://localhost:8001/config/status
Invoke-RestMethod http://localhost:8001/player/donk
Invoke-RestMethod http://localhost:8001/match/demo-match/analysis
```

## Vercel

This repo is configured for one Vercel project with two services:

- `frontend`: Vite app from `frontend`
- `backend`: FastAPI app from `backend`

Set this environment variable in Vercel:

```env
FACEIT_API_KEY=your_faceit_api_key
```

In production, the frontend calls the backend through `/api`, for example:

```text
/api/config/status
/api/match/demo-match/analysis
```

### Chrome Extension

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Load unpacked and select the `extension` folder.
4. Keep the backend running at `http://localhost:8001`.

## API

- `GET /health`
- `GET /config/status`
- `GET /player/{id_or_nickname}`
- `GET /match/{id}`
- `POST /analyze/team`
- `POST /analyze/match`

Without `FACEIT_API_KEY`, `/player/{id}` returns deterministic demo profiles so the app remains usable locally.
