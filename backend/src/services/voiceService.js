import { env } from "../config/env.js";
import { SYSTEM_PROMPT } from "./openaiService.js";
import { registerPhoneSession } from "./memoryStore.js";

function buildVoiceSystemPrompt(context) {
  const { intake, booking, availableSlots = [] } = context;

  // Determine what still needs to be collected
  const missing = [];
  if (!intake.firstName) missing.push("first name");
  if (!intake.lastName)  missing.push("last name");
  if (!intake.dob)       missing.push("date of birth");
  if (!intake.email)     missing.push("email address (needed to send confirmation)");
  if (!intake.reason)    missing.push("reason for visit");

  const name = intake.firstName
    ? `${intake.firstName} ${intake.lastName}`.trim()
    : "the patient";

  const missingSection = missing.length > 0
    ? `\nSTILL NEEDED — collect naturally during the call: ${missing.join(", ")}.\nWhen calling bookAppointment, pass every collected field (firstName, lastName, dob, email, reason) so the booking can be completed and a confirmation email sent.`
    : "\nAll patient info already collected — do not re-ask unless the patient wants to change something.";

  const slotsSection = availableSlots.length > 0
    ? `\nAVAILABLE SLOTS (use the exact ISO value when calling bookAppointment):\n` +
      availableSlots.map(s => `  ${s.label}  →  ${s.value}`).join("\n")
    : "";

  const contextSummary = `
CURRENT PATIENT CONTEXT:
- Name: ${intake.firstName || "not yet collected"} ${intake.lastName || ""}
- DOB: ${intake.dob || "not yet collected"}
- Phone: ${intake.phone || "not yet collected"}
- Email: ${intake.email || "not yet collected"}
- Reason for visit: ${intake.reason || "not yet collected"}
- Matched doctor ID: ${booking?.matchedDoctorId || "not yet matched"}
- Selected slot: ${booking?.selectedSlot || "not yet booked"}
${missingSection}${slotsSection}
`.trim();

  return `${SYSTEM_PROMPT}\n\n${contextSummary}`;
}

function buildFirstMessage(context) {
  const { intake, booking } = context;
  const name = intake.firstName || "there";

  const hasFullContext = intake.firstName && intake.reason;

  if (booking?.selectedSlot) {
    return `Hi ${name}, this is the Kyron Medical assistant. I can see you've already booked your appointment. Is there anything else I can help you with?`;
  }
  if (hasFullContext) {
    return `Hi ${name}, it's the Kyron Medical scheduling assistant. I can see you were chatting with us about scheduling for ${intake.reason}. I'm picking up right where we left off — let me get you booked.`;
  }
  // Partial or no context — collect info during the call
  return `Hi ${name}, this is the Kyron Medical scheduling assistant. I'm here to help you book an appointment. I'll just need a few quick details to get you set up.`;
}

export async function triggerVoiceCall({ sessionId, phoneNumber, context }) {
  // Register phone for call-back memory (pioneer feature)
  registerPhoneSession(phoneNumber, sessionId);

  const systemPrompt = buildVoiceSystemPrompt(context);
  const firstMessage = buildFirstMessage(context);

  const body = {
    assistantId:   env.vapi.assistantId,
    phoneNumberId: env.vapi.phoneNumberId,
    customer:      { number: phoneNumber },
    assistantOverrides: {
      firstMessage,
      model: {
        provider:     "openai",
        model:        "gpt-4o-mini",
        systemPrompt,
        // ── VAPI Tool: book appointment during the call ─────────────
        // When the patient confirms a slot verbally, the AI calls this tool.
        // Our endpoint creates the booking and sends the confirmation email.
        tools: [
          {
            type: "function",
            function: {
              name:        "bookAppointment",
              description: "Book an appointment for the patient and send them a confirmation email. Call this ONLY after the patient has verbally confirmed a specific date and time. If any patient info (name, DOB, email, reason) was collected during this call and is not already in the system prompt context, include it here so the booking can be completed.",
              parameters: {
                type:       "object",
                properties: {
                  sessionId: {
                    type:        "string",
                    description: "The patient session ID — always use: " + sessionId
                  },
                  slot: {
                    type:        "string",
                    description: "ISO 8601 date-time string of the confirmed appointment slot, e.g. 2026-04-01T09:00:00.000Z"
                  },
                  doctorId: {
                    type:        "string",
                    description: "The doctor ID — use: " + (context.booking?.matchedDoctorId || "(match from reason)")
                  },
                  firstName: {
                    type:        "string",
                    description: "Patient first name — include if collected during this call and not in context above"
                  },
                  lastName: {
                    type:        "string",
                    description: "Patient last name — include if collected during this call and not in context above"
                  },
                  dob: {
                    type:        "string",
                    description: "Patient date of birth — include if collected during this call and not in context above"
                  },
                  email: {
                    type:        "string",
                    description: "Patient email address for confirmation — include if collected during this call and not in context above"
                  },
                  reason: {
                    type:        "string",
                    description: "Reason for visit / symptoms — include if collected during this call and not in context above"
                  }
                },
                required: ["sessionId", "slot"]
              }
            },
            server: {
              url: `${env.vapi.publicAppUrl}/api/voice/tool/book`
            }
          }
        ]
      },
      variableValues: {
        sessionId,
        patientName: `${context.intake.firstName || ""} ${context.intake.lastName || ""}`.trim(),
        reason:      context.intake.reason || ""
      },
      metadata: {
        sessionId,
        intake:  context.intake,
        booking: context.booking
      }
    }
  };

  const response = await fetch("https://api.vapi.ai/call", {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${env.vapi.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`VAPI error: ${text}`);
  }

  const result = await response.json();
  return {
    ...result,
    message: `Your call is being connected to ${phoneNumber}. The AI will pick up right where we left off.`
  };
}
