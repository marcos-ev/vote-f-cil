import type { Role, RoomState, Squad, StoryDetail } from "@/types/poker";
import { getAuthToken } from "@/lib/auth-session";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  `${window.location.protocol}//${window.location.hostname}:8787`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
    ...init,
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || `HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export interface AuthUserResponse {
  id: string;
  username: string;
  displayName: string;
}

export interface AuthSessionResponse {
  token: string;
  user: AuthUserResponse;
}

export async function apiRegister(input: { username: string; displayName: string; password: string }) {
  return request<AuthSessionResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function apiLogin(input: { username: string; password: string }) {
  return request<AuthSessionResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function apiMe() {
  return request<{ user: AuthUserResponse }>("/api/auth/me");
}

export async function apiLogout() {
  return request<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
}

export async function apiListSquads() {
  return request<{ squads: Squad[] }>("/api/squads");
}

export async function apiListSquadsForSession(sessionId: string) {
  return request<{ squads: Squad[] }>(`/api/squads?sessionId=${encodeURIComponent(sessionId)}`);
}

export async function apiCreateSquad(input: { name: string; createdByName: string; ownerSessionId: string }) {
  return request<{ squad: Squad }>("/api/squads", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function apiJoinSquad(input: { inviteCode: string; userName: string }) {
  return request<{ squad: Squad }>("/api/squads/join", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function apiDeleteSquad(squadId: string, ownerSessionId: string) {
  return request<{ ok: boolean }>(`/api/squads/${encodeURIComponent(squadId)}`, {
    method: "DELETE",
    body: JSON.stringify({ ownerSessionId }),
  });
}

export async function apiGetRoom(roomId: string) {
  return request<{ room: RoomState }>(`/api/rooms/${encodeURIComponent(roomId)}`);
}

export async function apiGetRoomStories(roomId: string) {
  return request<{ stories: StoryDetail[] }>(`/api/rooms/${encodeURIComponent(roomId)}/stories`);
}

export async function apiUpsertPresence(
  roomId: string,
  input: {
    participantId: string;
    name: string;
    role: Role;
    vote: string | null;
    hasVoted: boolean;
  },
) {
  return request<{ room: RoomState }>(`/api/rooms/${encodeURIComponent(roomId)}/presence`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function apiRoomAction(
  roomId: string,
  input: {
    participantId: string;
    action: "start_vote" | "reveal_votes" | "new_round" | "new_story" | "confirm_estimate" | "reset_room";
    storyName?: string;
    finalEstimate?: string;
  },
) {
  return request<{ room: RoomState }>(`/api/rooms/${encodeURIComponent(roomId)}/action`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function apiLeaveRoom(roomId: string, participantId: string) {
  return request<{ room: RoomState }>(`/api/rooms/${encodeURIComponent(roomId)}/leave`, {
    method: "POST",
    body: JSON.stringify({ participantId }),
  });
}
