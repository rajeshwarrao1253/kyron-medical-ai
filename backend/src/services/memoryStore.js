const sessions = new Map();

// ── Pioneer feature: phone → sessionId index for call-back memory ──
const phoneIndex = new Map();

const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - new Date(session.updatedAt).getTime() > SESSION_TTL_MS) {
      if (session.intake?.phone) phoneIndex.delete(session.intake.phone);
      sessions.delete(id);
    }
  }
}, 15 * 60 * 1000);

function createEmptySession(sessionId) {
  return {
    sessionId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    intent: null,
    stage: "GREETING",
    intake: {
      firstName: "",
      lastName: "",
      dob: "",
      phone: "",
      email: "",
      smsOptIn: false,
      reason: ""
    },
    booking: {
      matchedDoctorId: null,
      matchedDoctorReason: "",
      selectedSlot: null,
      filters: {
        rawQuery: "",
        day: null,
        period: null,
        range: null
      }
    },
    messages: []
  };
}

export function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, createEmptySession(sessionId));
  }
  return sessions.get(sessionId);
}

export function updateSession(sessionId, patch) {
  const current = getSession(sessionId);
  const next = {
    ...current,
    ...patch,
    intake: {
      ...current.intake,
      ...(patch.intake || {})
    },
    booking: {
      ...current.booking,
      ...(patch.booking || {}),
      filters: {
        ...current.booking.filters,
        ...((patch.booking && patch.booking.filters) || {})
      }
    },
    updatedAt: new Date().toISOString()
  };
  sessions.set(sessionId, next);

  // keep phone index up to date
  if (patch.intake?.phone) {
    phoneIndex.set(patch.intake.phone, sessionId);
  }

  return next;
}

export function addMessage(sessionId, role, content, meta = {}) {
  const session = getSession(sessionId);
  session.messages.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    meta,
    createdAt: new Date().toISOString()
  });
  session.updatedAt = new Date().toISOString();
  return session;
}

export function getMessages(sessionId) {
  return getSession(sessionId).messages;
}

export function getAllSessions() {
  return Array.from(sessions.values());
}

// ── Pioneer: look up any existing session for a phone number ─────
export function lookupSessionByPhone(phone) {
  if (!phone) return null;
  const normalised = phone.replace(/\D/g, "");
  // try exact and with/without +1
  for (const [key, sid] of phoneIndex.entries()) {
    const k = key.replace(/\D/g, "");
    if (k === normalised || k === `1${normalised}` || `1${k}` === normalised) {
      const session = sessions.get(sid);
      if (session) return session;
    }
  }
  return null;
}

export function registerPhoneSession(phone, sessionId) {
  if (phone) phoneIndex.set(phone, sessionId);
}
