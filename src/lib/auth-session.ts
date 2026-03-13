export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

const AUTH_SESSION_KEY = "poker-auth-session";

export function getAuthSession(): AuthSession | null {
  const raw = localStorage.getItem(AUTH_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.token || !parsed?.user?.id || !parsed?.user?.displayName || !parsed?.user?.username) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function setAuthSession(session: AuthSession) {
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

export function clearAuthSession() {
  localStorage.removeItem(AUTH_SESSION_KEY);
}

export function getAuthToken() {
  return getAuthSession()?.token || "";
}
