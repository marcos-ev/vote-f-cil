import type { Server as HttpServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { getRoomState } from "./db";
import type { RoomState } from "./types";

type RoomClients = Map<string, Set<WebSocket>>;

const roomClients: RoomClients = new Map();

function send(ws: WebSocket, data: unknown) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify(data));
}

export function createRealtimeServer(server: HttpServer) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url || "", "http://localhost");
    if (url.pathname !== "/ws") {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (ws, request) => {
    const url = new URL(request.url || "", "http://localhost");
    const roomId = url.searchParams.get("roomId") || "";
    if (!roomId) {
      send(ws, { type: "error", message: "roomId ausente" });
      ws.close();
      return;
    }

    const set = roomClients.get(roomId) || new Set<WebSocket>();
    set.add(ws);
    roomClients.set(roomId, set);

    send(ws, { type: "room:update", payload: getRoomState(roomId) as RoomState });

    ws.on("close", () => {
      const current = roomClients.get(roomId);
      if (!current) return;
      current.delete(ws);
      if (current.size === 0) roomClients.delete(roomId);
    });
  });
}

export function broadcastRoom(roomId: string, payload: RoomState) {
  const clients = roomClients.get(roomId);
  if (!clients || clients.size === 0) return;
  clients.forEach((ws) => send(ws, { type: "room:update", payload }));
}
