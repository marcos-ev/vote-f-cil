import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import type { RoomState, Role, Squad } from "./types";
export type RoomAction =
  | "start_vote"
  | "reveal_votes"
  | "new_round"
  | "new_story"
  | "confirm_estimate"
  | "reset_room";

const dataDir = path.resolve(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, "app.sqlite");

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS squads (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    invite_code TEXT NOT NULL UNIQUE,
    created_by_name TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS squad_members (
    squad_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    joined_at INTEGER NOT NULL,
    PRIMARY KEY (squad_id, user_name),
    FOREIGN KEY (squad_id) REFERENCES squads(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    story_name TEXT NOT NULL DEFAULT '',
    is_voting INTEGER NOT NULL DEFAULT 0,
    is_revealed INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS participants (
    room_id TEXT NOT NULL,
    id TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    vote TEXT NULL,
    has_voted INTEGER NOT NULL DEFAULT 0,
    last_seen INTEGER NOT NULL,
    PRIMARY KEY (room_id, id),
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS stories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    story_name TEXT NOT NULL,
    final_estimate TEXT NULL,
    votes_count INTEGER NOT NULL,
    avg REAL NULL,
    min REAL NULL,
    max REAL NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_squads_invite_code ON squads(invite_code);
  CREATE INDEX IF NOT EXISTS idx_participants_room ON participants(room_id);
  CREATE INDEX IF NOT EXISTS idx_rooms_updated ON rooms(updated_at);
  CREATE INDEX IF NOT EXISTS idx_stories_room_created ON stories(room_id, created_at);
`);

const squadColumns = db.prepare("PRAGMA table_info(squads)").all() as Array<{ name: string }>;
if (!squadColumns.some((c) => c.name === "owner_session_id")) {
  db.exec("ALTER TABLE squads ADD COLUMN owner_session_id TEXT NOT NULL DEFAULT '';");
}
const storyColumns = db.prepare("PRAGMA table_info(stories)").all() as Array<{ name: string }>;
if (!storyColumns.some((c) => c.name === "votes_snapshot_json")) {
  db.exec("ALTER TABLE stories ADD COLUMN votes_snapshot_json TEXT NOT NULL DEFAULT '';");
}

const roomExistsStmt = db.prepare("SELECT id FROM rooms WHERE id = ?");
const createRoomStmt = db.prepare(
  "INSERT INTO rooms (id, story_name, is_voting, is_revealed, created_at, updated_at) VALUES (?, '', 0, 0, ?, ?)",
);
const upsertParticipantStmt = db.prepare(`
  INSERT INTO participants (room_id, id, name, role, vote, has_voted, last_seen)
  VALUES (@roomId, @participantId, @name, @role, @vote, @hasVoted, @lastSeen)
  ON CONFLICT(room_id, id) DO UPDATE SET
    name = excluded.name,
    role = excluded.role,
    vote = excluded.vote,
    has_voted = excluded.has_voted,
    last_seen = excluded.last_seen
`);
const touchRoomStmt = db.prepare("UPDATE rooms SET updated_at = ? WHERE id = ?");
const getRoomStmt = db.prepare("SELECT id, story_name, is_voting, is_revealed, updated_at FROM rooms WHERE id = ?");
const getParticipantsStmt = db.prepare(
  "SELECT id, name, role, vote, has_voted FROM participants WHERE room_id = ? ORDER BY last_seen DESC",
);
const getStoriesStmt = db.prepare(
  "SELECT id, story_name, final_estimate FROM stories WHERE room_id = ? ORDER BY created_at ASC, id ASC",
);
const getStoryDetailsStmt = db.prepare(
  "SELECT id, story_name, final_estimate, votes_count, avg, min, max, created_at, votes_snapshot_json FROM stories WHERE room_id = ? ORDER BY created_at ASC, id ASC",
);

function ensureRoom(roomId: string) {
  const exists = roomExistsStmt.get(roomId);
  if (exists) return;
  const now = Date.now();
  createRoomStmt.run(roomId, now, now);
}

function generateInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

type SquadDb = Squad & { owner_session_id: string };

function tryInsertSquad(name: string, createdByName: string, inviteCode: string, ownerSessionId: string) {
  const id = randomUUID();
  const now = Date.now();
  db.prepare(
    "INSERT INTO squads (id, name, invite_code, created_by_name, owner_session_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(id, name, inviteCode, createdByName, ownerSessionId, now);
  db.prepare("INSERT INTO squad_members (squad_id, user_name, joined_at) VALUES (?, ?, ?)").run(
    id,
    createdByName.trim().toLowerCase(),
    now,
  );
  return { id, name, invite_code: inviteCode } as Squad;
}

export function listSquads(): Squad[] {
  return db
    .prepare("SELECT id, name, invite_code, owner_session_id FROM squads ORDER BY created_at ASC")
    .all() as SquadDb[];
}

export function createSquad(name: string, createdByName: string, ownerSessionId: string): Squad {
  for (let i = 0; i < 10; i += 1) {
    const inviteCode = generateInviteCode();
    try {
      return tryInsertSquad(name, createdByName, inviteCode, ownerSessionId);
    } catch (error: any) {
      if (String(error?.message || "").includes("UNIQUE constraint failed: squads.invite_code")) {
        continue;
      }
      throw error;
    }
  }
  throw new Error("invite_code_generation_failed");
}

export function joinSquadByInvite(inviteCode: string, userName: string): Squad | null {
  const squad = db
    .prepare("SELECT id, name, invite_code FROM squads WHERE invite_code = ? LIMIT 1")
    .get(inviteCode) as Squad | undefined;
  if (!squad) return null;
  db.prepare("INSERT OR REPLACE INTO squad_members (squad_id, user_name, joined_at) VALUES (?, ?, ?)").run(
    squad.id,
    userName.trim().toLowerCase(),
    Date.now(),
  );
  return squad;
}

export function deleteSquadByOwner(squadId: string, ownerSessionId: string): "deleted" | "forbidden" | "not_found" {
  const squad = db
    .prepare("SELECT owner_session_id FROM squads WHERE id = ? LIMIT 1")
    .get(squadId) as { owner_session_id: string } | undefined;
  if (!squad) return "not_found";
  if (squad.owner_session_id !== ownerSessionId) return "forbidden";
  db.prepare("DELETE FROM squads WHERE id = ?").run(squadId);
  return "deleted";
}

export function deleteSquad(squadId: string): "deleted" | "not_found" {
  const squad = db.prepare("SELECT id FROM squads WHERE id = ? LIMIT 1").get(squadId) as { id: string } | undefined;
  if (!squad) return "not_found";
  db.prepare("DELETE FROM squads WHERE id = ?").run(squadId);
  return "deleted";
}

export function getRoomState(roomId: string): RoomState {
  ensureRoom(roomId);
  const room = getRoomStmt.get(roomId) as
    | { id: string; story_name: string; is_voting: number; is_revealed: number; updated_at: number }
    | undefined;
  if (!room) {
    throw new Error("room_not_found");
  }
  const participantsRows = getParticipantsStmt.all(roomId) as Array<{
    id: string;
    name: string;
    role: Role;
    vote: string | null;
    has_voted: number;
  }>;
  const participants: RoomState["participants"] = {};
  participantsRows.forEach((p) => {
    participants[p.id] = {
      id: p.id,
      name: p.name,
      role: p.role,
      vote: p.vote ?? null,
      hasVoted: Boolean(p.has_voted),
    };
  });

  const history = (
    getStoriesStmt.all(roomId) as Array<{ id: number; story_name: string; final_estimate: string | null }>
  ).map((item) => ({
    id: item.id,
    name: item.story_name,
    finalEstimate: item.final_estimate,
  }));

  return {
    roomId,
    storyName: room.story_name,
    isVoting: Boolean(room.is_voting),
    isRevealed: Boolean(room.is_revealed),
    participants,
    history,
    updatedAt: room.updated_at,
  };
}

export function upsertPresence(input: {
  roomId: string;
  participantId: string;
  name: string;
  role: Role;
  vote: string | null;
  hasVoted: boolean;
}) {
  ensureRoom(input.roomId);
  const now = Date.now();
  upsertParticipantStmt.run({
    roomId: input.roomId,
    participantId: input.participantId,
    name: input.name,
    role: input.role,
    vote: input.vote,
    hasVoted: input.hasVoted ? 1 : 0,
    lastSeen: now,
  });
  touchRoomStmt.run(now, input.roomId);
}

export function listRoomStoryDetails(roomId: string) {
  ensureRoom(roomId);
  const rows = getStoryDetailsStmt.all(roomId) as Array<{
    id: number;
    story_name: string;
    final_estimate: string | null;
    votes_count: number;
    avg: number | null;
    min: number | null;
    max: number | null;
    created_at: number;
    votes_snapshot_json: string;
  }>;
  return rows.map((row) => {
    let voteSnapshot: Array<{ id: string; name: string; role: Role; vote: string | null; hasVoted: boolean }> = [];
    try {
      const parsed = JSON.parse(row.votes_snapshot_json || "[]");
      if (Array.isArray(parsed)) voteSnapshot = parsed;
    } catch {
      voteSnapshot = [];
    }
    return {
      id: row.id,
      storyName: row.story_name,
      finalEstimate: row.final_estimate,
      stats: {
        votesCount: row.votes_count,
        avg: row.avg,
        min: row.min,
        max: row.max,
      },
      voteSnapshot,
      finalizedAt: row.created_at,
    };
  });
}

export function leaveRoom(roomId: string, participantId: string) {
  ensureRoom(roomId);
  db.prepare("DELETE FROM participants WHERE room_id = ? AND id = ?").run(roomId, participantId);
  touchRoomStmt.run(Date.now(), roomId);
}

function clearVotes(roomId: string) {
  db.prepare("UPDATE participants SET vote = NULL, has_voted = 0 WHERE room_id = ?").run(roomId);
}

export function roomAction(
  roomId: string,
  action: RoomAction,
  payload?: { storyName?: string; finalEstimate?: string },
) {
  ensureRoom(roomId);
  const now = Date.now();

  if (action === "start_vote") {
    clearVotes(roomId);
    db.prepare("UPDATE rooms SET story_name = ?, is_voting = 1, is_revealed = 0, updated_at = ? WHERE id = ?").run(
      payload?.storyName || "",
      now,
      roomId,
    );
    return;
  }

  if (action === "reveal_votes") {
    db.prepare("UPDATE rooms SET is_revealed = 1, updated_at = ? WHERE id = ?").run(now, roomId);
    return;
  }

  if (action === "new_round") {
    clearVotes(roomId);
    db.prepare("UPDATE rooms SET is_revealed = 0, updated_at = ? WHERE id = ?").run(now, roomId);
    return;
  }

  if (action === "new_story") {
    clearVotes(roomId);
    db.prepare("UPDATE rooms SET story_name = '', is_voting = 0, is_revealed = 0, updated_at = ? WHERE id = ?").run(
      now,
      roomId,
    );
    return;
  }

  if (action === "confirm_estimate") {
    const room = getRoomStmt.get(roomId) as { story_name: string } | undefined;
    const storyName = room?.story_name || "";
    const participantsSnapshot = db
      .prepare("SELECT id, name, role, vote, has_voted FROM participants WHERE room_id = ? ORDER BY last_seen DESC")
      .all(roomId) as Array<{ id: string; name: string; role: Role; vote: string | null; has_voted: number }>;
    const voteSnapshot = participantsSnapshot.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      vote: p.vote ?? null,
      hasVoted: Boolean(p.has_voted),
    }));
    const votes = db
      .prepare("SELECT vote FROM participants WHERE room_id = ? AND has_voted = 1 AND vote IS NOT NULL")
      .all(roomId) as Array<{ vote: string }>;
    const numeric = votes
      .map((v) => v.vote)
      .filter((v) => v !== "?" && v !== "☕")
      .map((v) => Number(v))
      .filter((v) => !Number.isNaN(v));
    const avg = numeric.length ? numeric.reduce((acc, cur) => acc + cur, 0) / numeric.length : null;
    const min = numeric.length ? Math.min(...numeric) : null;
    const max = numeric.length ? Math.max(...numeric) : null;
    db.prepare(
      "INSERT INTO stories (room_id, story_name, final_estimate, votes_count, avg, min, max, created_at, votes_snapshot_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(roomId, storyName, payload?.finalEstimate || null, votes.length, avg, min, max, now, JSON.stringify(voteSnapshot));
    clearVotes(roomId);
    db.prepare("UPDATE rooms SET story_name = '', is_voting = 0, is_revealed = 0, updated_at = ? WHERE id = ?").run(
      now,
      roomId,
    );
    return;
  }

  if (action === "reset_room") {
    clearVotes(roomId);
    db.prepare("DELETE FROM stories WHERE room_id = ?").run(roomId);
    db.prepare("UPDATE rooms SET story_name = '', is_voting = 0, is_revealed = 0, updated_at = ? WHERE id = ?").run(
      now,
      roomId,
    );
  }
}
