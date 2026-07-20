# FACEIT CS2 AI Team Analyzer Project Plan

## Overview
This project aims to develop a web app and Chrome extension for analyzing FACEIT CS2 matches before queueing. The app will provide team compatibility scores, player role detection, enemy scouting reports, and AI-generated match insights.

## Goals
- Build a user-friendly web app and Chrome extension for analyzing FACEIT CS2 matches.
- Provide team compatibility scores based on role balance, duplicate roles, missing roles, player synergy, and recent form.
- Detect player roles such as Entry, AWPer, Support, Lurker, Anchor, and Rifler using statistics like K/D, ADR, Headshot %, Opening kills, Assists, Survival rate, and Map performance.
- Analyze enemy scouting reports based on best maps, recent form, strong players, weak players, win rates, and playstyle indicators.
- Use AI to generate match insights based on player roles, strengths, and weaknesses.

## Tech Stack
### Frontend
- React + TypeScript
- Tailwind CSS

### Backend
- Python FastAPI

### Database
- PostgreSQL (prefer Supabase)

### AI
- Deferred until after the statistics MVP
- Later support readable generated reports, but never use an LLM for calculations

### Extension
- Chrome Extension Manifest V3

## Architecture
```
Chrome Extension
|
|
React Frontend
|
|
FastAPI Backend
|
|------ FACEIT API
|
|------ PostgreSQL
|
|------ Optional report generator (later)
```

## Core Features
### 1. FACEIT API Integration
- Create services to fetch player information, match information, match history, and player statistics.

### 2. Player Analysis
- Create algorithms to identify roles based on statistics.
- Return a role and confidence score for each player.

### 3. Team Compatibility
- Create a scoring system based on role balance, duplicate roles, missing roles, player synergy, and recent form.
- Provide a score from 0-10点 for each team.

### 4. Enemy Scouting
- Analyze enemy teams based on best maps, recent form, strong players, weak players, win rates, and playstyle indicators.
- Future: Use CS2 demo parsing for rush tendencies, site preference, lurking, and position heatmaps.

## AI Usage
- Not part of the current MVP.
- Do not use LLM for calculations.
- Backend calculates statistics.
- A future report generator may only convert calculated data into readable reports.

## API Endpoints
- `GET /player/{id}`
- `GET /match/{id}`
- `POST /analyze/team`
- Future: `POST /report`

## Development Order
1. Create FastAPI backend
2. Connect FACEIT API
3. Setup database
4. Build player statistics collection
5. Build role detection
6. Build team compatibility scoring
7. Create React dashboard
8. Add optional generated reports
9. Build Chrome extension

## Coding Requirements
- Production-quality code
- Type hints
- Clean folder structure
- Environment variables for secrets
- Error handling
- Documentation
- Explain changes before implementing
- Provide testing steps after features
