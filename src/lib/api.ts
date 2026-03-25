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
import { DECK, type Role, type RoomState, type Squad, type StoryDetail } from "@/types/poker";
import { getCurrentFirebaseSession } from "@/lib/firebase-auth";
import { firebaseDb } from "@/lib/firebase";
import { filterNumericVoteLabels, parseVoteNumeric } from "@/lib/vote-utils";

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
  squadId: string | null;
  controllerUserId: string | null;
  controllerParticipantId: string | null;
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
  blockedUserIds?: string[];
  createdAt: number;
  updatedAt: number;
};

type SquadAccess = {
  squadId: string;
  ownerUserId: string;
  memberUserIds: string[];
  blockedUserIds: string[];
};

const DEFAULT_ROOM: Omit<FirestoreRoom, "updatedAt"> = {
  squadId: null,
  controllerUserId: null,
  controllerParticipantId: null,
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
        userId: (p as { userId?: string }).userId,
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
    squadId: value.squadId ?? null,
    controllerUserId: value.controllerUserId ?? null,
    controllerParticipantId: value.controllerParticipantId ?? null,
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
  const numeric = votes.map((vote) => parseVoteNumeric(vote)).filter((value): value is number => value !== null);
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

function getMostVotedEstimate(votes: string[]) {
  const numericVotes = filterNumericVoteLabels(votes);
  if (numericVotes.length === 0) return null;

  const counts = new Map<string, number>();
  numericVotes.forEach((vote) => {
    counts.set(vote, (counts.get(vote) || 0) + 1);
  });

  const deckOrder = new Map<string, number>(DECK.map((value, index) => [value, index]));
  return Array.from(counts.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      const aOrder = deckOrder.get(a[0]);
      const bOrder = deckOrder.get(b[0]);
      if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder;
      if (aOrder !== undefined) return -1;
      if (bOrder !== undefined) return 1;
      return a[0].localeCompare(b[0]);
    })[0]?.[0] || null;
}

function getApproximateAverageEstimate(votes: string[]) {
  const candidates = DECK.map((label) => ({ label, value: parseVoteNumeric(label) })).filter(
    (item): item is { label: string; value: number } => item.value !== null,
  );
  const numeric = votes.map((vote) => parseVoteNumeric(vote)).filter((value): value is number => value !== null);
  if (numeric.length === 0) return null;
  if (candidates.length === 0) return null;

  const avg = numeric.reduce((acc, cur) => acc + cur, 0) / numeric.length;
  return candidates.reduce((prev, curr) =>
    Math.abs(curr.value - avg) < Math.abs(prev.value - avg) ? curr : prev,
  ).label;
}

function getFinalEstimateFromVotes(votes: string[]) {
  const numericVotes = filterNumericVoteLabels(votes);
  if (numericVotes.length === 0) return null;
  const counts = new Map<string, number>();
  numericVotes.forEach((vote) => {
    counts.set(vote, (counts.get(vote) || 0) + 1);
  });
  const allDifferent = Array.from(counts.values()).every((count) => count === 1);
  if (allDifferent) {
    const approximated = getApproximateAverageEstimate(numericVotes);
    if (approximated) return approximated;
  }
  return getMostVotedEstimate(numericVotes);
}

function mapSquadsFromDocs(docs: Array<{ id: string; data: () => unknown }>, currentUserId: string): Squad[] {
  return docs
    .map((item) => ({ ...((item.data() as FirestoreSquad) || {}), id: ((item.data() as FirestoreSquad)?.id || item.id) as string }))
    .sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0))
    .map((item) => ({
      id: item.id,
      name: item.name,
      invite_code: item.invite_code,
      ownerUserId: item.ownerUserId,
      memberUserIds: Array.isArray(item.memberUserIds) ? item.memberUserIds : [],
      canDelete: item.ownerUserId === currentUserId,
    }));
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

export async function subscribeSquads(
  onUpdate: (squads: Squad[]) => void,
  onError?: () => void,
): Promise<Unsubscribe> {
  const session = await getRequiredSession();
  return onSnapshot(
    query(collection(firebaseDb, "squads")),
    (snap) => {
      onUpdate(mapSquadsFromDocs(snap.docs, session.user.id));
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
  const docs = await getDocs(query(collection(firebaseDb, "squads")));
  const squads = mapSquadsFromDocs(docs.docs, session.user.id);
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
    blockedUserIds: [],
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(firebaseDb, "squads", squadId), payload);
  return {
    squad: {
      id: squadId,
      name: squadName,
      invite_code: inviteCode,
      ownerUserId: session.user.id,
      memberUserIds: [session.user.id],
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
      ownerUserId: squad.ownerUserId,
      memberUserIds: Array.isArray(squad.memberUserIds) ? squad.memberUserIds : [],
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

export async function apiRemoveSquadMember(squadId: string, targetUserId: string) {
  const session = await getRequiredSession();
  const normalizedTarget = String(targetUserId || "").trim();
  if (!normalizedTarget) throw new Error("Usuário inválido.");

  const squadRef = doc(firebaseDb, "squads", squadId);
  await runTransaction(firebaseDb, async (tx) => {
    const squadSnap = await tx.get(squadRef);
    if (!squadSnap.exists()) throw new Error("squad não encontrada");
    const squad = squadSnap.data() as FirestoreSquad;
    if (squad.ownerUserId !== session.user.id) {
      throw new Error("Apenas o owner da squad pode remover membros.");
    }
    if (normalizedTarget === squad.ownerUserId) {
      throw new Error("O owner não pode ser removido da própria squad.");
    }
    const memberUserIds = Array.isArray(squad.memberUserIds) ? squad.memberUserIds : [];
    const blockedUserIds = Array.isArray(squad.blockedUserIds) ? squad.blockedUserIds : [];
    tx.update(squadRef, {
      memberUserIds: memberUserIds.filter((id) => id !== normalizedTarget),
      blockedUserIds: Array.from(new Set([...blockedUserIds, normalizedTarget])),
      updatedAt: Date.now(),
    });
  });

  const roomsSnap = await getDocs(query(collection(firebaseDb, "rooms"), where("squadId", "==", squadId)));
  for (const roomDoc of roomsSnap.docs) {
    const room = asRoomData(roomDoc.data());
    const participants = { ...(room.participants || {}) };
    let changed = false;
    Object.keys(participants).forEach((participantId) => {
      if (participants[participantId]?.userId === normalizedTarget) {
        delete participants[participantId];
        changed = true;
      }
    });
    if (!changed) continue;

    let controllerUserId = room.controllerUserId;
    let controllerParticipantId = room.controllerParticipantId;
    if (controllerUserId === normalizedTarget) {
      controllerUserId = null;
      controllerParticipantId = null;
    }
    Object.keys(participants).forEach((participantId) => {
      const participant = participants[participantId];
      if (controllerUserId && participant.userId === controllerUserId) {
        participants[participantId] = { ...participant, role: "moderator", lastSeen: Date.now() };
        controllerParticipantId = participantId;
      } else {
        participants[participantId] = { ...participant, role: "player", lastSeen: Date.now() };
      }
    });

    await updateDoc(roomDoc.ref, {
      participants,
      controllerUserId,
      controllerParticipantId,
      updatedAt: Date.now(),
    });
  }
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
    vote?: string | null;
    hasVoted?: boolean;
    squadId?: string;
  },
) {
  void input.role;
  const session = await getRequiredSession();
  await runTransaction(firebaseDb, async (tx) => {
    const ref = roomRef(roomId);
    const snap = await tx.get(ref);
    const current = snap.exists() ? asRoomData(snap.data()) : { ...DEFAULT_ROOM, updatedAt: Date.now() };
    const nextParticipants = { ...(current.participants || {}) };
    const now = Date.now();
    const previous = nextParticipants[input.participantId];
    const incomingSquadId = String(input.squadId || "").trim() || null;
    const effectiveSquadId = current.squadId || incomingSquadId;
    let squadAccess: SquadAccess | null = null;

    if (effectiveSquadId) {
      const squadSnap = await tx.get(doc(firebaseDb, "squads", effectiveSquadId));
      if (!squadSnap.exists()) {
        throw new Error("Squad da sala não encontrada.");
      }
      const squadData = squadSnap.data() as FirestoreSquad;
      squadAccess = {
        squadId: effectiveSquadId,
        ownerUserId: squadData.ownerUserId,
        memberUserIds: Array.isArray(squadData.memberUserIds) ? squadData.memberUserIds : [],
        blockedUserIds: Array.isArray(squadData.blockedUserIds) ? squadData.blockedUserIds : [],
      };
      if (squadAccess.blockedUserIds.includes(session.user.id)) {
        throw new Error("Você foi removido desta squad e não pode participar desta sala.");
      }
    }

    let controllerUserId = current.controllerUserId;
    let controllerParticipantId = current.controllerParticipantId;

    if (!controllerUserId) {
      if (squadAccess) {
        controllerUserId = squadAccess.ownerUserId || session.user.id;
      } else {
        controllerUserId = session.user.id;
      }
    }

    const nextVote = input.vote === undefined ? previous?.vote ?? null : input.vote;
    const nextHasVoted = input.hasVoted === undefined ? Boolean(previous?.hasVoted) : input.hasVoted;
    const shouldKeepPreviousVote =
      Boolean(current.isVoting) &&
      Boolean(previous?.hasVoted) &&
      !nextHasVoted;

    nextParticipants[input.participantId] = {
      id: input.participantId,
      userId: session.user.id,
      name: input.name.trim() || session.user.displayName,
      role: "player",
      vote: shouldKeepPreviousVote ? previous?.vote ?? null : nextVote,
      hasVoted: shouldKeepPreviousVote ? true : nextHasVoted,
      lastSeen: now,
    };

    Object.keys(nextParticipants).forEach((participantId) => {
      const participant = nextParticipants[participantId];
      if (participant.userId === controllerUserId) {
        nextParticipants[participantId] = { ...participant, role: "moderator" };
        controllerParticipantId = participantId;
      } else {
        nextParticipants[participantId] = { ...participant, role: "player" };
      }
    });

    tx.set(
      ref,
      {
        ...current,
        squadId: effectiveSquadId,
        controllerUserId,
        controllerParticipantId,
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
    action:
      | "start_vote"
      | "reveal_votes"
      | "new_round"
      | "new_story"
      | "confirm_estimate"
      | "reset_room"
      | "transfer_moderator";
    storyName?: string;
    finalEstimate?: string;
    targetParticipantId?: string;
  },
) {
  const session = await getRequiredSession();
  await runTransaction(firebaseDb, async (tx) => {
    const ref = roomRef(roomId);
    const snap = await tx.get(ref);
    const current = snap.exists() ? asRoomData(snap.data()) : { ...DEFAULT_ROOM, updatedAt: Date.now() };
    const participants = { ...(current.participants || {}) };
    const actor = participants[input.participantId];
    if (!actor) {
      throw new Error("Participante não encontrado na sala.");
    }
    if (actor.userId !== session.user.id) {
      throw new Error("Participante não corresponde à conta logada.");
    }
    const now = Date.now();
    let squadAccess: SquadAccess | null = null;
    if (current.squadId) {
      const squadSnap = await tx.get(doc(firebaseDb, "squads", current.squadId));
      if (!squadSnap.exists()) {
        throw new Error("Squad da sala não encontrada.");
      }
      const squadData = squadSnap.data() as FirestoreSquad;
      squadAccess = {
        squadId: current.squadId,
        ownerUserId: squadData.ownerUserId,
        memberUserIds: Array.isArray(squadData.memberUserIds) ? squadData.memberUserIds : [],
        blockedUserIds: Array.isArray(squadData.blockedUserIds) ? squadData.blockedUserIds : [],
      };
    }
    const isCurrentResponsible = Boolean(current.controllerUserId && session.user.id === current.controllerUserId);

    if (!isCurrentResponsible) {
      throw new Error("Somente o responsável atual da votação pode executar esta ação.");
    }
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
      const numericVotes = filterNumericVoteLabels(votes);
      const finalEstimate = getFinalEstimateFromVotes(votes);
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
        finalEstimate: finalEstimate || input.finalEstimate || null,
        stats: {
          votesCount: numericVotes.length,
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
      return;
    }

    if (input.action === "transfer_moderator") {
      const targetId = String(input.targetParticipantId || "").trim();
      if (!targetId) throw new Error("Selecione um participante para receber moderação.");
      if (targetId === input.participantId && isCurrentResponsible) {
        throw new Error("Você já é o moderador atual.");
      }
      const target = participants[targetId];
      if (!target) throw new Error("Participante alvo não encontrado na sala.");
      Object.keys(participants).forEach((participantId) => {
        participants[participantId] = {
          ...participants[participantId],
          role: participantId === targetId ? "moderator" : "player",
          lastSeen: now,
        };
      });
      tx.set(
        ref,
        {
          ...current,
          controllerUserId: target.userId,
          controllerParticipantId: targetId,
          participants,
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
    let controllerParticipantId = current.controllerParticipantId;
    if (controllerParticipantId === participantId) {
      controllerParticipantId = null;
    }
    Object.keys(participants).forEach((id) => {
      const participant = participants[id];
      participants[id] = {
        ...participant,
        role: participant.userId === current.controllerUserId ? "moderator" : "player",
      };
      if (participant.userId === current.controllerUserId) {
        controllerParticipantId = id;
      }
    });
    tx.set(
      ref,
      {
        ...current,
        participants,
        controllerParticipantId,
        updatedAt: Date.now(),
      },
      { merge: true },
    );
  });
  return apiGetRoom(roomId);
}
