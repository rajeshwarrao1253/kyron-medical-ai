const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

function getSessionId() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("sessionId") || "";
}

function saveSessionId(sessionId) {
  if (typeof window === "undefined" || !sessionId) return;
  window.localStorage.setItem("sessionId", sessionId);
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(getSessionId() ? { "x-session-id": getSessionId() } : {}),
      ...(options.headers || {})
    }
  });

  const headerSessionId = response.headers.get("x-session-id");
  if (headerSessionId) saveSessionId(headerSessionId);

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  if (data.sessionId) saveSessionId(data.sessionId);
  return data;
}

export async function sendChat(message) {
  return request("/api/chat", {
    method: "POST",
    body: JSON.stringify({ message })
  });
}

export async function bookAppointment(payload) {
  return request("/api/appointments/book", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function continueOnCall() {
  return request("/api/voice/continue-call", {
    method: "POST",
    body: JSON.stringify({})
  });
}
