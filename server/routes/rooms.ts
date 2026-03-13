import { Router } from "express";
import { getRoomState, leaveRoom, listRoomStoryDetails, roomAction, upsertPresence, type RoomAction } from "../db";
import { broadcastRoom } from "../ws";
import type { Role } from "../types";
import { requireAuth } from "./auth-helpers";

export const roomsRouter = Router();

const validActions = new Set<RoomAction>([
  "start_vote",
  "reveal_votes",
  "new_round",
  "new_story",
  "confirm_estimate",
  "reset_room",
]);

function debugLog(hypothesisId: string, message: string, data: Record<string, unknown>) {
  // #region agent log
  fetch("http://127.0.0.1:7533/ingest/dba1853c-f8d2-4598-bce6-3443fc92be97", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "df5e7d" },
    body: JSON.stringify({
      sessionId: "df5e7d",
      runId: "pre-fix-review-backend",
      hypothesisId,
      location: "server/routes/rooms.ts",
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}

roomsRouter.get("/:roomId", (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const roomId = String(req.params.roomId || "");
  debugLog("H6", "rooms_get_room_called", {
    roomId,
    userId: auth.user.id,
  });
  if (!roomId) {
    res.status(400).json({ error: "roomId inválido" });
    return;
  }
  const room = getRoomState(roomId);
  res.json({ room });
});

roomsRouter.get("/:roomId/stories", (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const roomId = String(req.params.roomId || "");
  debugLog("H6", "rooms_get_stories_called", {
    roomId,
    userId: auth.user.id,
  });
  if (!roomId) {
    res.status(400).json({ error: "roomId inválido" });
    return;
  }
  const stories = listRoomStoryDetails(roomId);
  res.json({ stories });
});

roomsRouter.post("/:roomId/presence", (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const roomId = String(req.params.roomId || "");
  const participantId = String(req.body?.participantId || "").trim();
  const name = String(req.body?.name || "").trim() || auth.user.displayName;
  const role = (String(req.body?.role || "player") as Role) || "player";
  const vote = req.body?.vote === null || req.body?.vote === undefined ? null : String(req.body.vote);
  const hasVoted = Boolean(req.body?.hasVoted);
  debugLog("H6", "rooms_presence_called", {
    roomId,
    userId: auth.user.id,
    participantId,
    hasVoted,
    hasVote: vote !== null,
  });

  if (!roomId || !participantId || !name) {
    res.status(400).json({ error: "roomId, participantId e name são obrigatórios" });
    return;
  }
  upsertPresence({ roomId, participantId, userId: auth.user.id, name, role, vote, hasVoted });
  const room = getRoomState(roomId);
  broadcastRoom(roomId, room);
  res.json({ room });
});

roomsRouter.post("/:roomId/leave", (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const roomId = String(req.params.roomId || "");
  const participantId = String(req.body?.participantId || "").trim();
  if (!roomId || !participantId) {
    res.status(400).json({ error: "roomId e participantId são obrigatórios" });
    return;
  }
  leaveRoom(roomId, participantId);
  const room = getRoomState(roomId);
  broadcastRoom(roomId, room);
  res.json({ room });
});

roomsRouter.post("/:roomId/action", (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const roomId = String(req.params.roomId || "");
  const action = String(req.body?.action || "");
  const participantId = String(req.body?.participantId || "").trim();
  const storyName = req.body?.storyName === undefined ? undefined : String(req.body.storyName || "");
  const finalEstimate =
    req.body?.finalEstimate === undefined ? undefined : String(req.body.finalEstimate || "");
  debugLog("H6", "rooms_action_called", {
    roomId,
    userId: auth.user.id,
    action,
    hasStoryName: Boolean(storyName),
    hasFinalEstimate: Boolean(finalEstimate),
  });

  if (!roomId || !validActions.has(action as RoomAction)) {
    res.status(400).json({ error: "action inválida" });
    return;
  }
  if (!participantId) {
    res.status(400).json({ error: "participantId é obrigatório" });
    return;
  }

  const actorRoom = getRoomState(roomId);
  const actor = actorRoom.participants[participantId];
  if (!actor || actor.role !== "moderator") {
    res.status(403).json({ error: "Apenas moderadores podem executar ações da sala" });
    return;
  }

  roomAction(roomId, action as RoomAction, { storyName, finalEstimate });
  const room = getRoomState(roomId);
  broadcastRoom(roomId, room);
  res.json({ room });
});
