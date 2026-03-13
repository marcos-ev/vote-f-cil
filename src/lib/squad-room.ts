const LAST_SQUAD_ID_KEY = "poker-squad-id";

export function getLastSquadId() {
  return localStorage.getItem(LAST_SQUAD_ID_KEY) || "";
}

export function setLastSquadId(squadId: string) {
  if (!squadId) return;
  localStorage.setItem(LAST_SQUAD_ID_KEY, squadId);
}

export function resolveSquadRoomId(squadId: string) {
  return squadId;
}

export function bindSquadRoom(_squadId: string, _roomId: string) {
  // roomId de squad agora é determinístico (igual ao squadId).
}
