import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import type { Role, RoomState, Squad, StoryDetail } from "@/types/poker";
import { getCurrentFirebaseSession } from "@/lib/firebase-auth";
import { firebaseDb } from "@/lib/firebase";

export interface AuthUserResponse {
  id: string;
  username: string;
  displayName: string;
}

export interface AuthSessionResponse {
  token: string;
  user: AuthUserResponse;
}

type FirestoreParticipant = {
  id: string;
  userId: string;
  name: string;
  role: Role;
  vote: string | null;
  hasVoted: boolean;
  lastSeen: number;
};

type FirestoreRoom = {
  storyName: string;
  isVoting: boolean;
  isRevealed: boolean;
  participants: Record<string, FirestoreParticipant>;
  storyDetails: StoryDetail[];
  updatedAt: number;
};

type FirestoreSquad = {
  id: string;
  name: string;
  invite_code: string;
  ownerUserId: string;
  memberUserIds: string[];
  createdAt: number;
  updatedAt: number;
};

const DEFAULT_ROOM: Omit<FirestoreRoom, "updatedAt"> = {
  storyName: "",
  isVoting: false,
  isRevealed: false,
  participants: {},
  storyDetails: [],
};

async function getRequiredSession() {
  const session = await getCurrentFirebaseSession();
  if (!session) throw new Error("Sessão expirada. Faça login novamente.");
  return session;
}

function roomRef(roomId: string) {
  return doc(firebaseDb, "rooms", roomId);
}

function normalizeRoomState(roomId: string, data?: Partial<FirestoreRoom>): RoomState {
  const participantsMap = data?.participants || {};
  const participants = Object.fromEntries(
    Object.entries(participantsMap).map(([id, p]) => [
      id,
      {
        id: p.id,
        name: p.name,
        role: p.role,
        vote: p.vote ?? null,
        hasVoted: Boolean(p.hasVoted),
      },
    ]),
  );

  const detailHistory = Array.isArray(data?.storyDetails) ? data.storyDetails : [];
  return {
    roomId,
    storyName: data?.storyName || "",
    isVoting: Boolean(data?.isVoting),
    isRevealed: Boolean(data?.isRevealed),
    participants,
    history: detailHistory.map((item) => ({
      id: item.id,
      name: item.storyName,
      finalEstimate: item.finalEstimate,
    })),
    updatedAt: data?.updatedAt || Date.now(),
  };
}

async function ensureRoom(roomId: string) {
  const ref = roomRef(roomId);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await setDoc(ref, { ...DEFAULT_ROOM, updatedAt: Date.now() }, { merge: true });
}

function asRoomData(data: unknown): FirestoreRoom {
  const value = (data || {}) as Partial<FirestoreRoom>;
  return {
    storyName: value.storyName || "",
    isVoting: Boolean(value.isVoting),
    isRevealed: Boolean(value.isRevealed),
    participants: value.participants || {},
    storyDetails: Array.isArray(value.storyDetails) ? value.storyDetails : [],
    updatedAt: value.updatedAt || Date.now(),
  };
}

function generateInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function ensureInviteCodeIsFree(inviteCode: string) {
  const existing = await getDocs(query(collection(firebaseDb, "squads"), where("invite_code", "==", inviteCode), limit(1)));
  return existing.empty;
}

function getNumericStats(votes: string[]) {
  const numeric = votes
    .filter((v) => v !== "?" && v !== "☕")
    .map((v) => Number(v))
    .filter((n) => !Number.isNaN(n));
  if (numeric.length === 0) {
    return { avg: null, min: null, max: null };
  }
  const avg = numeric.reduce((acc, cur) => acc + cur, 0) / numeric.length;
  return {
    avg,
    min: Math.min(...numeric),
    max: Math.max(...numeric),
  };
}

export async function subscribeRoom(roomId: string, onUpdate: (room: RoomState) => void, onError?: () => void): Promise<Unsubscribe> {
  await ensureRoom(roomId);
  return onSnapshot(
    roomRef(roomId),
    (snap) => {
      const room = normalizeRoomState(roomId, asRoomData(snap.data()));
      onUpdate(room);
    },
    () => {
      onError?.();
    },
  );
}

export async function apiRegister(_input: { username: string; displayName: string; password: string }) {
  throw new Error("Cadastro via API foi desativado. Use Firebase Auth.");
}

export async function apiLogin(_input: { username: string; password: string }) {
  throw new Error("Login via API foi desativado. Use Firebase Auth.");
}

export async function apiMe() {
  const session = await getRequiredSession();
  return { user: session.user };
}

export async function apiLogout() {
  return { ok: true };
}

export async function apiListSquads() {
  const session = await getRequiredSession();
  const docs = await getDocs(
    query(collection(firebaseDb, "squads"), where("memberUserIds", "array-contains", session.user.id)),
  );
  const squads = docs.docs
    .map((item) => ({ ...(item.data() as FirestoreSquad), id: (item.data() as FirestoreSquad).id || item.id }))
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((item) => ({
      id: item.id,
      name: item.name,
      invite_code: item.invite_code,
      canDelete: item.ownerUserId === session.user.id,
    }));
  return { squads };
}

export async function apiListSquadsForSession(_sessionId: string) {
  return apiListSquads();
}

export async function apiCreateSquad(input: { name: string; createdByName: string; ownerSessionId: string }) {
  const session = await getRequiredSession();
  const squadName = input.name.trim();
  if (!squadName) throw new Error("Nome da squad é obrigatório.");

  let inviteCode = "";
  for (let i = 0; i < 12; i += 1) {
    const candidate = generateInviteCode();
    if (await ensureInviteCodeIsFree(candidate)) {
      inviteCode = candidate;
      break;
    }
  }
  if (!inviteCode) throw new Error("Falha ao gerar código de convite.");

  const squadId = crypto.randomUUID();
  const now = Date.now();
  const payload: FirestoreSquad = {
    id: squadId,
    name: squadName,
    invite_code: inviteCode,
    ownerUserId: session.user.id,
    memberUserIds: [session.user.id],
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(firebaseDb, "squads", squadId), payload);
  return {
    squad: {
      id: squadId,
      name: squadName,
      invite_code: inviteCode,
      canDelete: true,
    },
  };
}

export async function apiJoinSquad(input: { inviteCode: string; userName: string }) {
  const session = await getRequiredSession();
  const inviteCode = input.inviteCode.trim().toUpperCase();
  if (!inviteCode) throw new Error("Convite inválido.");

  const found = await getDocs(query(collection(firebaseDb, "squads"), where("invite_code", "==", inviteCode), limit(1)));
  if (found.empty) throw new Error("convite inválido");

  const squadDoc = found.docs[0];
  await updateDoc(squadDoc.ref, {
    memberUserIds: arrayUnion(session.user.id),
    updatedAt: Date.now(),
  });

  const squad = { ...(squadDoc.data() as FirestoreSquad), id: (squadDoc.data() as FirestoreSquad).id || squadDoc.id };
  return {
    squad: {
      id: squad.id,
      name: squad.name,
      invite_code: squad.invite_code,
      canDelete: squad.ownerUserId === session.user.id,
    },
  };
}

export async function apiDeleteSquad(squadId: string, ownerSessionId: string) {
  void ownerSessionId;
  const session = await getRequiredSession();
  const ref = doc(firebaseDb, "squads", squadId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("squad não encontrada");
  const squad = snap.data() as FirestoreSquad;
  if (squad.ownerUserId !== session.user.id) {
    throw new Error("Apenas o dono da squad pode apagar.");
  }
  await deleteDoc(ref);
  return { ok: true };
}

export async function apiGetRoom(roomId: string) {
  await ensureRoom(roomId);
  const snap = await getDoc(roomRef(roomId));
  const room = normalizeRoomState(roomId, asRoomData(snap.data()));
  return { room };
}

export async function apiGetRoomStories(roomId: string) {
  await ensureRoom(roomId);
  const snap = await getDoc(roomRef(roomId));
  const data = asRoomData(snap.data());
  return { stories: data.storyDetails };
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
  const session = await getRequiredSession();
  await runTransaction(firebaseDb, async (tx) => {
    const ref = roomRef(roomId);
    const snap = await tx.get(ref);
    const current = snap.exists() ? asRoomData(snap.data()) : { ...DEFAULT_ROOM, updatedAt: Date.now() };
    const nextParticipants = { ...(current.participants || {}) };
    const now = Date.now();
    nextParticipants[input.participantId] = {
      id: input.participantId,
      userId: session.user.id,
      name: input.name.trim() || session.user.displayName,
      role: input.role,
      vote: input.vote,
      hasVoted: input.hasVoted,
      lastSeen: now,
    };
    tx.set(
      ref,
      {
        ...current,
        participants: nextParticipants,
        updatedAt: now,
      },
      { merge: true },
    );
  });
  return apiGetRoom(roomId);
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
  await runTransaction(firebaseDb, async (tx) => {
    const ref = roomRef(roomId);
    const snap = await tx.get(ref);
    const current = snap.exists() ? asRoomData(snap.data()) : { ...DEFAULT_ROOM, updatedAt: Date.now() };
    const participants = { ...(current.participants || {}) };
    const actor = participants[input.participantId];
    if (!actor || actor.role !== "moderator") {
      throw new Error("Apenas moderadores podem executar ações da sala.");
    }
    const now = Date.now();

    const clearVotes = () => {
      Object.keys(participants).forEach((key) => {
        const p = participants[key];
        participants[key] = {
          ...p,
          vote: null,
          hasVoted: false,
          lastSeen: now,
        };
      });
    };

    if (input.action === "start_vote") {
      clearVotes();
      tx.set(
        ref,
        {
          ...current,
          participants,
          storyName: input.storyName || "",
          isVoting: true,
          isRevealed: false,
          updatedAt: now,
        },
        { merge: true },
      );
      return;
    }

    if (input.action === "reveal_votes") {
      tx.set(ref, { ...current, isRevealed: true, updatedAt: now }, { merge: true });
      return;
    }

    if (input.action === "new_round") {
      clearVotes();
      tx.set(ref, { ...current, participants, isRevealed: false, updatedAt: now }, { merge: true });
      return;
    }

    if (input.action === "new_story") {
      clearVotes();
      tx.set(
        ref,
        {
          ...current,
          participants,
          storyName: "",
          isVoting: false,
          isRevealed: false,
          updatedAt: now,
        },
        { merge: true },
      );
      return;
    }

    if (input.action === "confirm_estimate") {
      const votes = Object.values(participants)
        .filter((p) => p.hasVoted && p.vote !== null)
        .map((p) => p.vote as string);
      const stats = getNumericStats(votes);
      const details = Array.isArray(current.storyDetails) ? [...current.storyDetails] : [];
      const nextId = details.length > 0 ? Math.max(...details.map((d) => d.id)) + 1 : 1;
      const voteSnapshot = Object.values(participants).map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        vote: p.vote,
        hasVoted: p.hasVoted,
      }));
      details.push({
        id: nextId,
        storyName: current.storyName || "",
        finalEstimate: input.finalEstimate || null,
        stats: {
          votesCount: votes.length,
          avg: stats.avg,
          min: stats.min,
          max: stats.max,
        },
        voteSnapshot,
        finalizedAt: now,
      });
      clearVotes();
      tx.set(
        ref,
        {
          ...current,
          participants,
          storyDetails: details,
          storyName: "",
          isVoting: false,
          isRevealed: false,
          updatedAt: now,
        },
        { merge: true },
      );
      return;
    }

    if (input.action === "reset_room") {
      clearVotes();
      tx.set(
        ref,
        {
          ...current,
          participants,
          storyDetails: [],
          storyName: "",
          isVoting: false,
          isRevealed: false,
          updatedAt: now,
        },
        { merge: true },
      );
    }
  });
  return apiGetRoom(roomId);
}

export async function apiLeaveRoom(roomId: string, participantId: string) {
  await runTransaction(firebaseDb, async (tx) => {
    const ref = roomRef(roomId);
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const current = asRoomData(snap.data());
    const participants = { ...(current.participants || {}) };
    delete participants[participantId];
    tx.set(ref, { ...current, participants, updatedAt: Date.now() }, { merge: true });
  });
  return apiGetRoom(roomId);
}
