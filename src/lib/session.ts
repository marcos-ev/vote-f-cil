const SESSION_KEY = "poker-owner-session-id";

export function getOrCreateSessionId() {
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(SESSION_KEY, created);
  return created;
}
