import { Router } from "express";
import { createSquad, deleteSquadByOwner, joinSquadByInvite, listSquads } from "../db";

export const squadsRouter = Router();

squadsRouter.get("/", (req, res) => {
  const sessionId = String(req.query?.sessionId || "").trim();
  const squads = listSquads().map((s: any) => ({
    id: s.id,
    name: s.name,
    invite_code: s.invite_code,
    canDelete: Boolean(sessionId) && s.owner_session_id === sessionId,
  }));
  res.json({ squads });
});

squadsRouter.post("/", (req, res) => {
  const name = String(req.body?.name || "").trim();
  const createdByName = String(req.body?.createdByName || "").trim();
  const ownerSessionId = String(req.body?.ownerSessionId || "").trim();
  if (!name || !createdByName || !ownerSessionId) {
    res.status(400).json({ error: "name, createdByName e ownerSessionId são obrigatórios" });
    return;
  }
  const squad = createSquad(name, createdByName, ownerSessionId);
  res.status(201).json({ squad });
});

squadsRouter.post("/join", (req, res) => {
  const inviteCode = String(req.body?.inviteCode || "").trim().toUpperCase();
  const userName = String(req.body?.userName || "").trim();
  if (!inviteCode || !userName) {
    res.status(400).json({ error: "inviteCode e userName são obrigatórios" });
    return;
  }
  const squad = joinSquadByInvite(inviteCode, userName);
  if (!squad) {
    res.status(404).json({ error: "convite inválido" });
    return;
  }
  res.json({ squad });
});

squadsRouter.delete("/:squadId", (req, res) => {
  const squadId = String(req.params.squadId || "").trim();
  const ownerSessionId = String(req.body?.ownerSessionId || "").trim();
  if (!squadId) {
    res.status(400).json({ error: "squadId é obrigatório" });
    return;
  }
  if (!ownerSessionId) {
    res.status(400).json({ error: "ownerSessionId é obrigatório" });
    return;
  }
  const status = deleteSquadByOwner(squadId, ownerSessionId);
  if (status === "not_found") {
    res.status(404).json({ error: "squad não encontrada" });
    return;
  }
  if (status === "forbidden") {
    res.status(403).json({ error: "apenas o criador da squad pode apagar" });
    return;
  }
  res.json({ ok: true });
});
