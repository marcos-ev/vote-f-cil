import type { RoomState } from "@/types/poker";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  `${window.location.protocol}//${window.location.hostname}:8787`;

function getWsBaseUrl() {
  if (API_BASE_URL.startsWith("https://")) return API_BASE_URL.replace("https://", "wss://");
  if (API_BASE_URL.startsWith("http://")) return API_BASE_URL.replace("http://", "ws://");
  return API_BASE_URL;
}

type Handlers = {
  onOpen: () => void;
  onClose: () => void;
  onRoomUpdate: (state: RoomState) => void;
};

export function connectRoomRealtime(roomId: string, handlers: Handlers) {
  let socket: WebSocket | null = null;
  let closedByUser = false;
  let reconnectMs = 800;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const connect = () => {
    if (closedByUser) return;
    socket = new WebSocket(`${getWsBaseUrl()}/ws?roomId=${encodeURIComponent(roomId)}`);
    socket.onopen = () => {
      reconnectMs = 800;
      handlers.onOpen();
    };
    socket.onclose = () => {
      handlers.onClose();
      if (closedByUser) return;
      timer = setTimeout(connect, reconnectMs);
      reconnectMs = Math.min(5000, reconnectMs * 1.6);
    };
    socket.onerror = () => {
      socket?.close();
    };
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(String(event.data || "{}")) as { type?: string; payload?: RoomState };
        if (data.type === "room:update" && data.payload) {
          handlers.onRoomUpdate(data.payload);
        }
      } catch {
        // Ignora payload inválido.
      }
    };
  };

  connect();

  return {
    close() {
      closedByUser = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      socket?.close();
    },
  };
}
