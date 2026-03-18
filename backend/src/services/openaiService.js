import OpenAI from "openai";
import { env } from "../config/env.js";

const client = env.openAIApiKey
  ? new OpenAI({ apiKey: env.openAIApiKey })
  : null;

// ── Unsupported specialty ────────────────────────────────────────
export function notSupportedReply(reason) {
  return `I'm sorry — we don't currently have a specialist for "${reason || "that condition"}". Our providers cover cardiology (heart/chest), dermatology (skin conditions), orthopedics (bones, joints, back), and neurology (brain, head, nerves). Could you describe your concern in one of those areas? Or call us at ${env.clinic.phone} for more options.`;
}

// Stages where the AI must NOT be used — deterministic messages only.
// When AI generates intake questions it ignores the stage and makes up its own
// order, causing field validation failures and a broken flow.
const DETERMINISTIC_STAGES = new Set([
  "INTAKE_FIRST_NAME",
  "INTAKE_LAST_NAME",
  "INTAKE_DOB",
  "INTAKE_PHONE",
  "INTAKE_EMAIL",
  "INTAKE_SMS_OPT_IN",
  "INTAKE_REASON"
]);

export const SYSTEM_PROMPT = `
You are a warm, professional patient care coordinator at ${env.clinic.name}.
Your role is ADMINISTRATIVE ONLY — scheduling appointments, answering clinic questions, and guiding patients.

STRICT SAFETY RULES:
- NEVER provide medical advice, diagnoses, treatment plans, or medication guidance.
- NEVER speculate about conditions, symptoms, or prognosis.
- If a patient asks a medical question, say: "I'm not able to offer medical guidance, but I'd be happy to get you scheduled with one of our doctors who can help."
- If the patient describes an emergency (chest pain, difficulty breathing, severe bleeding, seizure), say immediately: "Please call 911 or go to your nearest emergency room. This sounds urgent."

STYLE: Warm, human, brief (2-4 sentences). One question at a time. Use the patient's first name once known.
`.trim();

// ── Deterministic replies (never call OpenAI for these) ──────────
export function deterministicReply({ stage, context }) {
  const intake = context?.intake || {};
  const name   = intake.firstName || "";
  const hi     = name ? `${name}, ` : "";

  switch (stage) {
    case "INTAKE_FIRST_NAME":
      return "I'd be happy to help. To get started, could I get your first name?";
    case "INTAKE_LAST_NAME":
      return `Thanks${name ? ` ${name}` : ""}! And your last name?`;
    case "INTAKE_DOB":
      return `Got it${name ? `, ${name}` : ""}. What's your date of birth?`;
    case "INTAKE_PHONE":
      return "What's the best phone number to reach you?";
    case "INTAKE_EMAIL":
      return `And your email address, ${hi}so I can send the confirmation?`;
    case "INTAKE_SMS_OPT_IN": {
      const phone = intake.phone
        ? intake.phone.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3")
        : null;
      return phone
        ? `Would you like a text reminder sent to ${phone}? Reply yes or no — you can opt out any time.`
        : "Would you also like a text reminder for your appointment? Reply yes or no.";
    }
    case "INTAKE_REASON":
      return `Almost done, ${hi}what's the main reason for your visit today?`;
    default:
      return null; // not a deterministic stage
  }
}

// ── Clinic / prescription quick replies ─────────────────────────
export function clinicInfoReply() {
  return `${env.clinic.name} is open ${env.clinic.hours}. You can find us at ${env.clinic.address}. Call us at ${env.clinic.phone} or email ${env.clinic.email}. Would you also like to schedule an appointment?`;
}

export function prescriptionReply() {
  return `For prescription refills, please contact your pharmacy directly or call us at ${env.clinic.phone} and our team will coordinate with your doctor. Is there anything else I can help you with — like scheduling an appointment?`;
}

// ── AI reply (only for CONFIRMATION, SCHEDULING, and unknown inputs) ──
async function aiReply({ stage, context, history }) {
  const intake  = context?.intake || {};
  const doctor  = context?.matchedDoctor;
  const slots   = context?.slots;

  const stateBlock = [
    `Stage: ${stage}`,
    `Patient: ${intake.firstName || ""} ${intake.lastName || ""}`.trim(),
    `Reason: ${intake.reason || "not stated"}`,
    doctor ? `Matched doctor: ${doctor.name} (${doctor.specialty})` : "",
    slots   ? `Slots: shown as buttons in the UI — do NOT list them verbally` : ""
  ].filter(Boolean).join("\n");

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.slice(-12).map(m => ({ role: m.role, content: m.content })),
    { role: "user",   content: `[STATE]\n${stateBlock}\n\nRespond naturally as the care coordinator. No JSON, no slot lists.` }
  ];

  const response = await client.responses.create({
    model: env.openAIModel,
    input: messages
  });
  return response.output_text?.trim() || null;
}

// ── Fallback for CONFIRMATION / SCHEDULING ───────────────────────
function confirmationFallback({ stage, context }) {
  const doctor = context?.matchedDoctor;
  if (stage === "SCHEDULING") {
    return `Great — I've matched you with ${doctor?.name || "a provider"}${doctor?.specialty ? `, our ${doctor.specialty}` : ""}. Here are the available times — tap one to book, or ask for a specific day like "Tuesday morning".`;
  }
  if (stage === "CONFIRMATION") {
    return `Perfect, I have everything I need. I've matched you with ${doctor?.name || "a specialist"}. Would you like to see the available times?`;
  }
  return "I'm here to help. Would you like to schedule an appointment, get prescription info, or find clinic hours?";
}

// ── Main entry point ─────────────────────────────────────────────
export async function generateAssistantReply({ intent, stage, context, history }) {
  // 1. Instant replies for clinic info / prescriptions
  if (intent === "CLINIC_INFO") return clinicInfoReply();
  if (intent === "PRESCRIPTION")    return prescriptionReply();
  if (stage  === "NOT_SUPPORTED")   return notSupportedReply(context?.reason);

  // 2. Deterministic intake questions — NEVER call OpenAI for these
  const det = deterministicReply({ stage, context });
  if (det !== null) return det;

  // 3. For CONFIRMATION / SCHEDULING, try OpenAI with a tight fallback
  if (!client) return confirmationFallback({ stage, context });

  try {
    const text = await aiReply({ stage, context, history });
    return text || confirmationFallback({ stage, context });
  } catch {
    return confirmationFallback({ stage, context });
  }
}
