const LAST_SQUAD_ID_KEY = "poker-squad-id";
const LAST_SQUAD_ROOM_KEY = "poker-squad-last-room-map";

const generateRoomId = () => Math.random().toString(36).substring(2, 8);

export function getLastSquadId() {
  return localStorage.getItem(LAST_SQUAD_ID_KEY) || "";
}

export function setLastSquadId(squadId: string) {
  if (!squadId) return;
  localStorage.setItem(LAST_SQUAD_ID_KEY, squadId);
}

function readSquadRoomMap() {
  try {
    const raw = localStorage.getItem(LAST_SQUAD_ROOM_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeSquadRoomMap(next: Record<string, string>) {
  localStorage.setItem(LAST_SQUAD_ROOM_KEY, JSON.stringify(next));
}

export function resolveSquadRoomId(squadId: string) {
  const map = readSquadRoomMap();
  if (map[squadId]) return map[squadId];
  const created = generateRoomId();
  writeSquadRoomMap({ ...map, [squadId]: created });
  return created;
}

export function bindSquadRoom(squadId: string, roomId: string) {
  const map = readSquadRoomMap();
  writeSquadRoomMap({ ...map, [squadId]: roomId });
}
