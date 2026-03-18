# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

Full-stack healthcare appointment scheduling MVP. Patients chat with an AI assistant to describe symptoms, get matched to a doctor, pick a slot, and book an appointment — with optional email/SMS/voice confirmation.

## Commands

### Backend (Express API — `backend/`)
```bash
npm run dev    # Hot-reload dev server (node --watch)
npm start      # Production start
npm test       # Run built-in test suite (doctor matching + slot filtering)
```

### Frontend (Next.js — `frontend/`)
```bash
npm run dev    # Dev server at http://localhost:3000
npm run build  # Production build
npm start      # Serve production build
```

### Environment Setup
```bash
# Backend
cp backend/.env.example backend/.env   # then fill OPENAI_API_KEY at minimum

# Frontend
cp frontend/.env.example frontend/.env.local   # set NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

No linting or type-checking tools are configured.

## Architecture

### Data Flow
```
User message → POST /api/chat
  → safetyService (flag crisis/emergency content)
  → chatFlowService (orchestrates intake collection)
    → openaiService (GPT streaming reply)
    → doctorMatchingService (keyword → specialty → doctor)
    → slotService (generates next-30-day weekday slots)
  → response with { reply, slots, doctor, bookingReady }

User confirms slot → POST /api/appointments
  → bookingService (creates in-memory record)
  → notificationService (email via nodemailer, SMS via Twilio)

User wants phone call → POST /api/voice/continue-call
  → voiceService (hands off to VAPI)
```

### Session Management
Sessions are UUID-based, stored entirely **in-memory** (`memoryStore.js`). No database. Restarting the backend clears all sessions and bookings. The frontend persists `sessionId` in `localStorage` and sends it as the `x-session-id` request header.

### Doctor & Slot Data
Doctors are a static array in `backend/src/constants/doctors.js` (4 doctors: Cardiologist, Dermatologist, Orthopedic, Neurologist). Slots are generated dynamically — weekdays only, times 9/10/11/14/15/16:00, 30 days forward.

### Backend Module System
Uses ES modules (`"type": "module"` in package.json) — always use `import`/`export`, not `require`.

### Key Services
| File | Responsibility |
|------|---------------|
| `chatFlowService.js` | Central orchestrator; collects intake fields, decides when booking is ready |
| `openaiService.js` | Wraps OpenAI client; handles streaming and function calls |
| `doctorMatchingService.js` | Maps symptom keywords → specialty → doctor record |
| `safetyService.js` | Detects emergency/crisis content and returns escalation instructions |
| `slotService.js` | Generates and filters available slots |
| `bookingService.js` | Creates appointment records in memoryStore |
| `notificationService.js` | Sends email (nodemailer) and SMS (Twilio) |
| `voiceService.js` | Initiates VAPI voice call handoff |

### Frontend Structure
- `app/page.js` — main chat page; owns all UI state (messages, slots, booking flow)
- `lib/api.js` — fetch wrapper that attaches `x-session-id` header
- `lib/streamText.js` — reads a streaming response body and yields text chunks
- `components/chat/` — message rendering and input composer
- `components/booking/` — slot picker and confirmation display

### Optional Integrations (disabled by default)
- **Email**: set `SMTP_*` vars in `.env`
- **SMS**: set `TWILIO_*` vars and `ENABLE_SMS=true`
- **Voice**: set `VAPI_*` vars and `ENABLE_VOICE=true`; also requires a publicly reachable `PUBLIC_APP_URL` for the webhook
