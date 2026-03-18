import express from "express";
import { getSession, updateSession, lookupSessionByPhone } from "../services/memoryStore.js";
import { sendBookingNotifications } from "../services/notificationService.js";
import { bookAppointment } from "../services/bookingService.js";
import { matchDoctor } from "../services/doctorMatchingService.js";
import { SYSTEM_PROMPT } from "../services/openaiService.js";
import { DOCTORS } from "../constants/doctors.js";
import { env } from "../config/env.js";

const router = express.Router();

// ── Pioneer feature: inbound call-back — patient dials the VAPI number ──
// VAPI sends a POST here to get the assistant config. We look up their phone
// and inject the previous conversation context so the AI remembers everything.
router.post("/api/voice/assistant-request", (req, res) => {
  try {
    const callerPhone = req.body?.message?.call?.customer?.number
                     || req.body?.call?.customer?.number
                     || "";
    console.log("[assistant-request] inbound call from:", callerPhone);
    const prior = lookupSessionByPhone(callerPhone);
    console.log("[assistant-request] prior session found:", !!prior);

    function buildBookTool(sessionId, matchedDoctorId) {
      return {
        type: "function",
        function: {
          name:        "bookAppointment",
          description: "Book an appointment for the patient and send them a confirmation email. Call this ONLY after the patient has verbally confirmed a specific date and time.",
          parameters: {
            type:       "object",
            properties: {
              sessionId: {
                type:        "string",
                description: "The patient session ID — always use: " + sessionId
              },
              slot: {
                type:        "string",
                description: "ISO 8601 date-time string of the confirmed appointment slot"
              },
              doctorId: {
                type:        "string",
                description: "The doctor ID — use: " + (matchedDoctorId || "(match from reason)")
              },
              firstName:  { type: "string", description: "Patient first name if not already collected" },
              lastName:   { type: "string", description: "Patient last name if not already collected" },
              dob:        { type: "string", description: "Patient date of birth if not already collected" },
              email:      { type: "string", description: "Patient email for confirmation if not already collected" },
              reason:     { type: "string", description: "Reason for visit if not already collected" }
            },
            required: ["sessionId", "slot"]
          }
        },
        server: { url: `${env.vapi.publicAppUrl}/api/voice/tool/book` }
      };
    }

    if (prior) {
      const intake  = prior.intake || {};
      const booking = prior.booking || {};
      const name    = intake.firstName ? `${intake.firstName}` : "there";

      let contextNote = `
RETURNING PATIENT (called back):
- Name: ${intake.firstName} ${intake.lastName}
- DOB: ${intake.dob || "not collected"}
- Reason: ${intake.reason || "not stated"}
- Booked slot: ${booking.selectedSlot || "not yet booked"}
- Matched doctor ID: ${booking.matchedDoctorId || "not yet matched"}

This patient was in the middle of or has already completed scheduling via the web chat. Greet them by name, acknowledge you remember them, and pick up naturally.
      `.trim();

      const firstMessage = booking.selectedSlot
        ? `Hi ${name}, welcome back! I remember you — you've got your appointment set up. Is there anything I can help you with?`
        : `Hi ${name}, great to hear from you again! I remember you were working on scheduling. Let's pick up right where we left off.`;

      return res.json({
        assistant: {
          firstMessage,
          model: {
            provider:     "openai",
            model:        "gpt-4o-mini",
            systemPrompt: `${SYSTEM_PROMPT}\n\n${contextNote}`,
            tools:        [buildBookTool(prior.sessionId, booking.matchedDoctorId)]
          }
        }
      });
    }

    // No prior session — fresh call
    return res.json({
      assistant: {
        firstMessage: `Hi there, you've reached the ${env.clinic.name} scheduling assistant. I'm here to help you book an appointment, check on a prescription, or answer any clinic questions. How can I help you today?`,
        model: {
          provider:     "openai",
          model:        "gpt-4o-mini",
          systemPrompt: SYSTEM_PROMPT
        }
      }
    });

  } catch (err) {
    console.error("assistant-request error:", err);
    return res.json({
      assistant: {
        firstMessage: `Hello, thank you for calling ${env.clinic.name}. How can I help you today?`
      }
    });
  }
});

// ── VAPI Tool call: book appointment during voice call ───────────────────
// VAPI calls this endpoint when the patient confirms a slot on the phone.
// The tool is registered in assistantOverrides.tools when the call is triggered.
router.post("/api/voice/tool/book", async (req, res) => {
  // Helper: return result in VAPI's expected format (with toolCallId for matching)
  function toolResult(result, toolCallId) {
    if (toolCallId) return res.json({ results: [{ toolCallId, result }] });
    return res.json({ result });
  }

  try {
    const body = req.body;
    console.log("[voice/tool/book] incoming body:", JSON.stringify(body, null, 2));

    // Extract toolCallId so VAPI can match our response to the tool call
    const toolCallId = body?.message?.toolCallList?.[0]?.id
                    || body?.toolCallList?.[0]?.id
                    || null;

    const args = body?.message?.toolCallList?.[0]?.function?.arguments
              || body?.toolCallList?.[0]?.function?.arguments
              || body;

    const parsed = typeof args === "string" ? JSON.parse(args) : args;
    console.log("[voice/tool/book] parsed args:", parsed);
    const { sessionId, slot, doctorId, firstName, lastName, dob, email, reason } = parsed;

    if (!sessionId || !slot) {
      return toolResult("Missing session ID or slot. Cannot book.", toolCallId);
    }

    // Save any patient info collected during the call into the session
    const fromCall = {};
    if (firstName) fromCall.firstName = firstName;
    if (lastName)  fromCall.lastName  = lastName;
    if (dob)       fromCall.dob       = dob;
    if (email)     fromCall.email     = email;
    if (reason)    fromCall.reason    = reason;
    if (Object.keys(fromCall).length > 0) {
      updateSession(sessionId, { intake: fromCall });
    }

    const session = getSession(sessionId);
    console.log("[voice/tool/book] session intake:", session.intake);
    console.log("[voice/tool/book] session booking:", session.booking);

    // Resolve doctor: explicit arg → session booking → match from reason
    let finalDoctorId = doctorId || session.booking?.matchedDoctorId;
    if (!finalDoctorId && session.intake?.reason) {
      const matched = matchDoctor(session.intake.reason);
      if (matched.supported) {
        finalDoctorId = matched.doctor.id;
        updateSession(sessionId, { booking: { matchedDoctorId: finalDoctorId } });
      }
    }
    if (!finalDoctorId) {
      return toolResult("I wasn't able to match a specialist. Could you describe your symptoms in more detail?", toolCallId);
    }

    // Perform the booking
    const appointment = bookAppointment(sessionId, { doctorId: finalDoctorId, slot });

    const doctor     = DOCTORS.find(d => d.id === finalDoctorId);
    const doctorName = doctor ? `${doctor.name} (${doctor.specialty})` : finalDoctorId;
    const patientName = `${session.intake.firstName} ${session.intake.lastName}`.trim();

    // Send email + SMS confirmation
    await sendBookingNotifications({
      email:       session.intake.email,
      phone:       session.intake.phone,
      smsOptIn:    session.intake.smsOptIn,
      patientName,
      doctorId:    finalDoctorId,
      slot:        appointment.slot
    }).catch(() => {});

    // Mark so post-call webhook doesn't duplicate
    session.booking.notifiedAfterCall = true;

    const emailNote = session.intake.email
      ? `A confirmation email has been sent to ${session.intake.email}.`
      : "No email on file — confirmation email skipped.";

    return toolResult(
      `Appointment confirmed with ${doctorName}. ${emailNote} Booking ID: ${appointment.id}.`,
      toolCallId
    );

  } catch (err) {
    console.error("Voice tool /book error:", err.message);
    return toolResult(
      `Sorry, I couldn't complete the booking: ${err.message}. Please try through the web chat or call us at ${env.clinic.phone}.`,
      toolCallId
    );
  }
});

// ── Outbound call lifecycle events ───────────────────────────────────────
router.post("/api/voice/webhook", async (req, res) => {
  try {
    const event = req.body;

    if (event?.type === "call.ended") {
      const sessionId = event?.assistant?.metadata?.sessionId
                     || event?.call?.assistantOverrides?.metadata?.sessionId;

      if (sessionId) {
        const session = getSession(sessionId);
        if (session?.intake?.email) {
          // If the call ended without a booking, just log; if there's a booking send confirmation
          if (session?.booking?.selectedSlot && !session?.booking?.notifiedAfterCall) {
            await sendBookingNotifications({
              email:       session.intake.email,
              phone:       session.intake.phone,
              smsOptIn:    session.intake.smsOptIn,
              patientName: `${session.intake.firstName} ${session.intake.lastName}`.trim(),
              doctorId:    session.booking.matchedDoctorId,
              slot:        session.booking.selectedSlot
            });
            session.booking.notifiedAfterCall = true;
          }
        }
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("Webhook error:", err);
    res.sendStatus(200);
  }
});

export default router;
