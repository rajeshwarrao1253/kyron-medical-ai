# Healthcare AI App (Full Stack MVP)

Monorepo with:
- `backend/` → Express API
- `frontend/` → Next.js App Router UI

## Quick start

### 1) Backend
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

### 2) Frontend
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

### 3) Open the app
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:4000`

## What to configure

In `backend/.env`:
- `OPENAI_API_KEY` → required for AI replies
- `OPENAI_MODEL` → optional, default `gpt-4.1-mini`
- `SMTP_*` → optional, for email confirmations
- `TWILIO_*` → optional, for SMS confirmations
- `VAPI_*` → optional, for voice call handoff

In `frontend/.env.local`:
- `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000`

## MVP flow
1. User chats in UI
2. Backend creates/uses `sessionId`
3. Assistant safely collects intake
4. Backend matches doctor
5. Backend shows filtered slots
6. User books appointment
7. Email/SMS sent if configured
8. User can continue on a phone call with Vapi if configured
