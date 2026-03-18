import { getSession, updateSession } from "./memoryStore.js";

export function getIntake(sessionId) {
  return getSession(sessionId).intake;
}

export function saveIntake(sessionId, payload) {
  return updateSession(sessionId, { intake: payload }).intake;
}
