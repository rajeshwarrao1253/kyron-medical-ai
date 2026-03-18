const EMERGENCY_PATTERNS = [
  /chest pain/i,
  /trouble breathing/i,
  /difficulty breathing/i,
  /severe bleeding/i,
  /loss of consciousness/i,
  /suicidal/i,
  /stroke/i,
  /seizure/i
];

const MEDICAL_PATTERNS = [
  /what medicine/i,
  /what medication/i,
  /should i take/i,
  /can i take/i,
  /dosage/i,
  /treatment/i,
  /diagnose/i,
  /do i have/i,
  /is this cancer/i,
  /do i have cancer/i,
  /what disease/i,
  /what does this mean/i,
  /what is wrong with me/i
];

const RESPONSE_UNSAFE_PATTERNS = [
  /you should take/i,
  /try ibuprofen/i,
  /likely have/i,
  /sounds like/i,
  /take .* mg/i,
  /diagnosis/i,
  /treatment plan/i
];

export function classifyUserMessage(message = "") {
  if (EMERGENCY_PATTERNS.some((p) => p.test(message))) {
    return { blocked: true, category: "emergency" };
  }
  if (MEDICAL_PATTERNS.some((p) => p.test(message))) {
    return { blocked: true, category: "medical" };
  }
  return { blocked: false, category: "safe" };
}

export function safeResponse(category = "medical") {
  if (category === "emergency") {
    return "This could be urgent. Please call 911 or go to the nearest emergency room right away. I’m not able to provide medical advice, but I can still help with non-emergency appointment scheduling.";
  }
  return "I’m not able to provide medical advice, diagnosis, or treatment guidance, but I can help you schedule an appointment with a doctor or share clinic information.";
}

export function validateAssistantResponse(message = "") {
  return !RESPONSE_UNSAFE_PATTERNS.some((p) => p.test(message));
}
