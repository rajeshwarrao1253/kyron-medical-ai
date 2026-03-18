import { getSession, updateSession } from "./memoryStore.js";
import { matchDoctor } from "./doctorMatchingService.js";
import { getAvailableSlots } from "./slotService.js";

// ── Intent detection ─────────────────────────────────────────────
export function detectIntent(message = "", currentIntent = null) {
  const lower = message.toLowerCase();
  if (/(clinic info|hours|location|address|directions|where are you|find clinic|about the clinic|opening|open until|your office|office hours|office location|where.*office|when.*open|are you open)/i.test(lower))
    return "CLINIC_INFO";
  if (/(prescription|refill|medicine|medication|my meds)/i.test(lower))
    return "PRESCRIPTION";
  return currentIntent || "APPOINTMENT";
}

// ── Field extraction with strict format validation ──────────────
// Returns {} (empty) if the value doesn't look like the expected type.
// This prevents garbage data (e.g. an email stored as phone).
function extractByStage(stage, message) {
  const text = message.trim();

  switch (stage) {
    case "INTAKE_FIRST_NAME": {
      // Accept alphabetic names only (including hyphen/apostrophe)
      if (/^[A-Za-z'-]{1,60}$/.test(text)) return { firstName: text };
      return {};
    }
    case "INTAKE_LAST_NAME": {
      if (/^[A-Za-z'-]{1,60}(\s[A-Za-z'-]+)?$/.test(text)) return { lastName: text };
      return {};
    }
    case "INTAKE_DOB": {
      // Must contain at least 4 digits (loose — handles "Jan 5 1990", "01/05/1990", "dec 18 2000")
      if (/\d{4}/.test(text) || /\d+.*\d+.*\d+/.test(text)) return { dob: text };
      return {};
    }
    case "INTAKE_PHONE": {
      // Must have at least 10 digits — reject emails, names, short numbers
      const digits = text.replace(/\D/g, "");
      if (digits.length >= 10) return { phone: digits };
      return {};
    }
    case "INTAKE_EMAIL": {
      // Must look like a real email address
      if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text)) return { email: text };
      return {};
    }
    case "INTAKE_SMS_OPT_IN": {
      const yes = /\b(yes|yeah|sure|ok|okay|yep|y\b|please|definitely|sounds good|go ahead)\b/i.test(message);
      return { smsOptIn: yes };
    }
    case "INTAKE_REASON": {
      // Must be at least 3 meaningful characters and NOT look like a phone number
      const looksLikePhone = /^\+?[\d\s\-().]{7,}$/.test(text);
      if (text.length >= 3 && !looksLikePhone) return { reason: text };
      return {};
    }
    default:
      return {};
  }
}

// ── Stage sequencing ─────────────────────────────────────────────
function nextStage(intake) {
  if (!intake.firstName)       return "INTAKE_FIRST_NAME";
  if (!intake.lastName)        return "INTAKE_LAST_NAME";
  if (!intake.dob)             return "INTAKE_DOB";
  if (!intake.phone)           return "INTAKE_PHONE";
  if (!intake.email)           return "INTAKE_EMAIL";
  if (!intake._smsAsked)       return "INTAKE_SMS_OPT_IN";
  if (!intake.reason)          return "INTAKE_REASON";
  return "CONFIRMATION";
}

// ── Main conversation processor ──────────────────────────────────
export function processConversationState(sessionId, message) {
  let session = getSession(sessionId);

  // ── Post-booking: reset for new appointment ───────────────────
  // Keep all intake data (name/DOB/phone/email) but clear reason + booking
  // so the patient doesn't have to re-enter personal details.
  if (session.booking?.selectedSlot) {
    updateSession(sessionId, {
      intake: { ...session.intake, reason: "" },
      stage: "INTAKE_REASON",
      booking: {
        matchedDoctorId: null,
        matchedDoctorReason: "",
        selectedSlot: null,
        notifiedAfterCall: false,
        filters: { rawQuery: "", day: null, period: null, range: null }
      }
    });
    session = getSession(sessionId);
  }

  let intake = { ...session.intake };
  const stage = session.stage || "INTAKE_FIRST_NAME";

  // Extract and validate the field for the current stage
  const extracted = extractByStage(stage, message);
  for (const key in extracted) {
    if (key === "smsOptIn") {
      intake[key]      = extracted[key];
      intake._smsAsked = true;
    } else if (!intake[key]) {
      intake[key] = extracted[key];
    }
  }

  updateSession(sessionId, { intake });

  // Determine next stage after extraction
  const nextSt = nextStage(intake);
  updateSession(sessionId, { stage: nextSt });

  // ── Post-intake: match doctor and fetch slots ─────────────────
  if (nextSt === "CONFIRMATION") {
    const matched = matchDoctor(intake.reason);

    // No specialty available for this reason — clear reason and let user retry
    if (!matched.supported) {
      const retryReason = intake.reason;
      const clearedIntake = { ...intake, reason: "" };
      updateSession(sessionId, { intake: clearedIntake, stage: "INTAKE_REASON" });
      return {
        intent:  "APPOINTMENT",
        stage:   "NOT_SUPPORTED",
        action:  "NOT_SUPPORTED",
        responseContext: { intake: clearedIntake, reason: retryReason },
        collectedData:   clearedIntake
      };
    }

    updateSession(sessionId, { booking: { matchedDoctorId: matched.doctor.id } });

    const isCorrection = /(change|wrong|no\b|not right|different|update|fix|incorrect)/i.test(message.toLowerCase());
    if (!isCorrection) {
      const { slots } = getAvailableSlots(matched.doctor.id, message);
      updateSession(sessionId, { stage: "SCHEDULING" });
      return {
        intent:  "APPOINTMENT",
        stage:   "SCHEDULING",
        action:  "FETCH_SLOTS",
        responseContext: { intake, matchedDoctor: matched.doctor, slots },
        collectedData:   intake
      };
    }

    return {
      intent:  "APPOINTMENT",
      stage:   "CONFIRMATION",
      action:  "MATCH_DOCTOR",
      responseContext: { intake, matchedDoctor: matched.doctor },
      collectedData:   intake
    };
  }

  // ── Slot filter request mid-scheduling ────────────────────────
  if (stage === "SCHEDULING" || session.stage === "SCHEDULING") {
    const booking  = getSession(sessionId).booking;
    const doctorId = booking?.matchedDoctorId;
    if (doctorId) {
      const { slots, filters } = getAvailableSlots(doctorId, message);
      return {
        intent:  "APPOINTMENT",
        stage:   "SCHEDULING",
        action:  "FILTER_SLOTS",
        responseContext: {
          intake,
          matchedDoctor: { id: doctorId },
          slots,
          slotFilters: filters
        },
        collectedData: intake
      };
    }
  }

  return {
    intent:  detectIntent(message, session.intent),
    stage:   nextSt,
    action:  "NONE",
    responseContext: { intake },
    collectedData:   intake
  };
}
