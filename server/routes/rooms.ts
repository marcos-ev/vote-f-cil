import { Router } from "express";
import { getRoomState, leaveRoom, listRoomStoryDetails, roomAction, upsertPresence, type RoomAction } from "../db";
import { broadcastRoom } from "../ws";
import type { Role } from "../types";

export const roomsRouter = Router();

const validActions = new Set<RoomAction>([
  "start_vote",
  "reveal_votes",
  "new_round",
  "new_story",
  "confirm_estimate",
  "reset_room",
]);

roomsRouter.get("/:roomId", (req, res) => {
  const roomId = String(req.params.roomId || "");
  if (!roomId) {
    res.status(400).json({ error: "roomId inválido" });
    return;
  }
  const room = getRoomState(roomId);
  res.json({ room });
});

roomsRouter.get("/:roomId/stories", (req, res) => {
  const roomId = String(req.params.roomId || "");
  if (!roomId) {
    res.status(400).json({ error: "roomId inválido" });
    return;
  }
  const stories = listRoomStoryDetails(roomId);
  res.json({ stories });
});

roomsRouter.post("/:roomId/presence", (req, res) => {
  const roomId = String(req.params.roomId || "");
  const participantId = String(req.body?.participantId || "").trim();
  const name = String(req.body?.name || "").trim();
  const role = (String(req.body?.role || "player") as Role) || "player";
  const vote = req.body?.vote === null || req.body?.vote === undefined ? null : String(req.body.vote);
  const hasVoted = Boolean(req.body?.hasVoted);

  if (!roomId || !participantId || !name) {
    res.status(400).json({ error: "roomId, participantId e name são obrigatórios" });
    return;
  }
  upsertPresence({ roomId, participantId, name, role, vote, hasVoted });
  const room = getRoomState(roomId);
  broadcastRoom(roomId, room);
  res.json({ room });
});

roomsRouter.post("/:roomId/leave", (req, res) => {
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
  const roomId = String(req.params.roomId || "");
  const action = String(req.body?.action || "");
  const storyName = req.body?.storyName === undefined ? undefined : String(req.body.storyName || "");
  const finalEstimate =
    req.body?.finalEstimate === undefined ? undefined : String(req.body.finalEstimate || "");

  if (!roomId || !validActions.has(action as RoomAction)) {
    res.status(400).json({ error: "action inválida" });
    return;
  }

  roomAction(roomId, action as RoomAction, { storyName, finalEstimate });
  const room = getRoomState(roomId);
  broadcastRoom(roomId, room);
  res.json({ room });
});
