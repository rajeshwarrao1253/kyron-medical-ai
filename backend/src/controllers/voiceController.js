import { getSession, updateSession, addMessage } from "../services/memoryStore.js";
import { triggerVoiceCall } from "../services/voiceService.js";
import { getAvailableSlots } from "../services/slotService.js";

function formatPhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

function isValidPhone(raw) {
  return formatPhone(raw) !== null;
}

export async function continueOnCallHandler(req, res, next) {
  try {
    const session = getSession(req.sessionId);
    const intake  = session.intake || {};

    // Only phone number is required to start the call.
    // The AI will collect any remaining info (name, DOB, email, reason) during the call.
    if (!intake.phone || !isValidPhone(intake.phone)) {
      // Set stage to INTAKE_PHONE so the patient's next chat message is captured as their phone number
      updateSession(req.sessionId, { stage: "INTAKE_PHONE" });

      const msg = intake.phone
        ? `The phone number on file (${intake.phone}) doesn't look valid. Please type a 10-digit US phone number in the chat and then click the call button again.`
        : "To connect a call I'll need your phone number. Please type your 10-digit phone number here and then click the call button again.";
      addMessage(req.sessionId, "assistant", msg);
      return res.json({ success: false, message: msg });
    }

    const phoneNumber = formatPhone(intake.phone);

    // Fetch available slots so the AI uses exact ISO strings (avoids timezone guessing)
    let availableSlots = [];
    const matchedDoctorId = session.booking?.matchedDoctorId;
    if (matchedDoctorId) {
      availableSlots = getAvailableSlots(matchedDoctorId).slots.slice(0, 18);
    }

    const context = {
      intake,
      booking: session.booking,
      availableSlots,
      history: session.messages.slice(-10)
    };

    const result = await triggerVoiceCall({
      sessionId: req.sessionId,
      phoneNumber,
      context
    });

    res.json({ success: true, result });

  } catch (err) {
    next(err);
  }
}
