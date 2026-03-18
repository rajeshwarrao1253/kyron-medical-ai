# Backend

## Commands
```bash
cp .env.example .env
npm install
npm run dev
```

## Required for AI chat
- `OPENAI_API_KEY`

## Optional integrations
- SMTP → email confirmations
- Twilio → SMS confirmations
- Vapi → Continue on Call

## Main endpoints
- `POST /api/chat`
- `POST /api/intake`
- `GET /api/intake/:sessionId`
- `GET /api/doctors`
- `POST /api/doctors/match`
- `GET /api/slots?doctorId=doc-derma-1&q=tuesday%20morning`
- `POST /api/appointments/book`
- `POST /api/voice/continue-call`
