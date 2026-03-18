import { DOCTORS } from "../constants/doctors.js";

function normalize(text = "") {
  return String(text).toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function scoreKeywordMatch(text, keywords = []) {
  const normalized = normalize(text);
  let score = 0;
  for (const keyword of keywords) {
    const k = normalize(keyword);
    if (!k) continue;
    if (normalized.includes(k)) score += 4;
    const stem = k.slice(0, Math.min(5, k.length));
    if (stem && normalized.split(" ").some((word) => word.startsWith(stem))) {
      score += 1;
    }
  }
  return score;
}

function semanticHints(text = "") {
  const normalized = normalize(text);
  const hints = {
    Cardiologist: ["heart", "chest", "pressure", "beating", "palpit", "cardio"],
    Dermatologist: ["skin", "rash", "itch", "itchy", "red", "spot", "hive"],
    Orthopedic: ["bone", "joint", "knee", "back", "shoulder", "hip", "ankle", "arm", "leg"],
    Neurologist: ["brain", "head", "headache", "migraine", "nerve", "tingling", "numb", "memory", "dizzy"]
  };

  const scores = {};
  for (const [specialty, words] of Object.entries(hints)) {
    scores[specialty] = words.reduce((acc, word) => acc + (normalized.includes(word) ? 2 : 0), 0);
  }
  return scores;
}

export function matchDoctor(reason = "", bodyPart = "") {
  const source = `${reason} ${bodyPart}`.trim();
  const semantic = semanticHints(source);

  let bestDoctor = DOCTORS[0];
  let bestScore = -1;

  for (const doctor of DOCTORS) {
    const keywordScore = scoreKeywordMatch(source, [...doctor.keywords, ...doctor.bodyParts]);
    const semanticScore = semantic[doctor.specialty] || 0;
    const score = keywordScore + semanticScore;
    if (score > bestScore) {
      bestScore = score;
      bestDoctor = doctor;
    }
  }

  // Require a minimum match score. Score 0 means no keyword matched at all —
  // the practice genuinely doesn't have a relevant specialist.
  const supported = bestScore > 0;
  return {
    doctor:    bestDoctor,
    score:     bestScore,
    supported,
    explanation: supported
      ? `Matched ${bestDoctor.specialty} based on the visit reason provided.`
      : `No specialty match found for the reason provided.`
  };
}

export function listDoctors() {
  return DOCTORS;
}
