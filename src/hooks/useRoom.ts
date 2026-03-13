import { useState, useEffect, useCallback, useRef } from "react";
import { apiGetRoom, apiLeaveRoom, apiRoomAction, apiUpsertPresence, subscribeRoom } from "@/lib/api";
import type { RoomState } from "@/types/poker";
import { toast } from "sonner";

const generateId = () => Math.random().toString(36).substring(2, 15);

function getErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message.trim() : "";
  return message || fallback;
}

function debugLog(hypothesisId: string, message: string, data: Record<string, unknown>) {
  // #region agent log
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    navigator.sendBeacon(
      "http://127.0.0.1:7533/ingest/dba1853c-f8d2-4598-bce6-3443fc92be97",
      JSON.stringify({
        sessionId: "df5e7d",
        runId: "pre-fix-review",
        hypothesisId,
        location: "src/hooks/useRoom.ts",
        message,
        data,
        timestamp: Date.now(),
      }),
    );
  }
  fetch("http://127.0.0.1:7533/ingest/dba1853c-f8d2-4598-bce6-3443fc92be97", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "df5e7d" },
    body: JSON.stringify({
      sessionId: "df5e7d",
      runId: "pre-fix-review",
      hypothesisId,
      location: "src/hooks/useRoom.ts",
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}

const emptyRoomState = (roomId: string): RoomState => ({
  roomId,
  storyName: "",
  isVoting: false,
  isRevealed: false,
  participants: {},
  history: [],
  updatedAt: Date.now(),
});

export function useRoom(roomId: string, userName: string, enabled = true, squadId?: string | null) {
  const myId = useRef(generateId());
  const [connected, setConnected] = useState(false);
  const [roomState, setRoomState] = useState<RoomState>(() => emptyRoomState(roomId));

  useEffect(() => {
    if (!roomId) return;
    const storageKey = `poker-user-id-${roomId}`;
    const stored = localStorage.getItem(storageKey);
    myId.current = stored || generateId();
    localStorage.setItem(storageKey, myId.current);
  }, [roomId]);

  const refreshRoom = useCallback(async () => {
    if (!enabled || !roomId) return;
    const { room } = await apiGetRoom(roomId);
    debugLog("H3", "use_room_refresh_ok", {
      roomId,
      isVoting: room.isVoting,
      participantsCount: Object.keys(room.participants).length,
    });
    setRoomState(room);
  }, [enabled, roomId]);

  const upsertPresence = useCallback(
    async (vote: string | null, hasVoted: boolean) => {
      if (!roomId || !userName) return;
      debugLog("H3", "use_room_upsert_presence_start", {
        roomId,
        hasUserName: Boolean(userName),
        hasVoted,
        voteProvided: vote !== null,
      });
      await apiUpsertPresence(roomId, {
        participantId: myId.current,
        name: userName,
        role: "player",
        vote,
        hasVoted,
        squadId: squadId || undefined,
      });
    },
    [roomId, squadId, userName],
  );

  const runRoomAction = useCallback(
    async (
      action:
        | "start_vote"
        | "reveal_votes"
        | "new_round"
        | "new_story"
        | "confirm_estimate"
        | "reset_room"
        | "transfer_moderator",
      payload?: { storyName?: string; finalEstimate?: string; targetParticipantId?: string },
    ) => {
      if (!roomId) return;
      debugLog("H3", "use_room_action_start", {
        roomId,
        action,
        payloadPresent: Boolean(payload),
      });
      await apiRoomAction(roomId, { participantId: myId.current, action, ...payload });
    },
    [roomId],
  );

  useEffect(() => {
    if (!enabled || !roomId) return;
    let unsubscribe: (() => void) | null = null;
    let active = true;
    setConnected(false);
    void refreshRoom().catch(() => undefined);
    void subscribeRoom(
      roomId,
      (state) => {
        if (!active) return;
        setConnected(true);
        setRoomState(state);
      },
      () => {
        if (!active) return;
        setConnected(false);
      },
    ).then((unsub) => {
      if (!active) {
        unsub();
        return;
      }
      unsubscribe = unsub;
    });
    return () => {
      active = false;
      setConnected(false);
      unsubscribe?.();
    };
  }, [enabled, refreshRoom, roomId]);

  useEffect(() => {
    if (!enabled || !roomId || !userName) return;
    void upsertPresence(null, false).catch((error) => {
      toast.error(`Falha ao entrar na sala. ${getErrorMessage(error, "Tente novamente.")}`);
    });
    const heartbeat = setInterval(() => {
      void upsertPresence(null, false).catch(() => undefined);
    }, 10000);
    return () => {
      clearInterval(heartbeat);
      void apiLeaveRoom(roomId, myId.current).catch(() => undefined);
    };
  }, [enabled, roomId, upsertPresence, userName]);

  const castVote = useCallback(
    (value: string) => {
      void upsertPresence(value, true).catch((error) => {
        toast.error(`Falha ao enviar voto. ${getErrorMessage(error, "Tente novamente.")}`);
      });
    },
    [upsertPresence],
  );

  const startVote = useCallback(
    (story: string) => {
      void runRoomAction("start_vote", { storyName: story }).catch((error) => {
        toast.error(`Falha ao iniciar votação. ${getErrorMessage(error, "Tente novamente.")}`);
      });
    },
    [runRoomAction],
  );

  const revealVotes = useCallback(() => {
    void runRoomAction("reveal_votes").catch((error) => {
      toast.error(`Falha ao revelar votos. ${getErrorMessage(error, "Tente novamente.")}`);
    });
  }, [runRoomAction]);

  const newRound = useCallback(() => {
    void runRoomAction("new_round").catch((error) => {
      toast.error(`Falha ao iniciar nova rodada. ${getErrorMessage(error, "Tente novamente.")}`);
    });
  }, [runRoomAction]);

  const newStory = useCallback(() => {
    void runRoomAction("new_story").catch((error) => {
      toast.error(`Falha ao limpar história atual. ${getErrorMessage(error, "Tente novamente.")}`);
    });
  }, [runRoomAction]);

  const confirmEstimate = useCallback(
    (finalValue: string) => {
      void runRoomAction("confirm_estimate", { finalEstimate: finalValue }).catch((error) => {
        toast.error(`Falha ao confirmar estimativa. ${getErrorMessage(error, "Tente novamente.")}`);
      });
    },
    [runRoomAction],
  );

  const resetRoom = useCallback(() => {
    void runRoomAction("reset_room").catch((error) => {
      toast.error(`Falha ao resetar sala. ${getErrorMessage(error, "Tente novamente.")}`);
    });
  }, [runRoomAction]);

  const transferModerator = useCallback(
    (targetParticipantId: string) => {
      if (!targetParticipantId) return;
      void runRoomAction("transfer_moderator", { targetParticipantId }).catch((error) => {
        toast.error(`Falha ao transferir moderação. ${getErrorMessage(error, "Tente novamente.")}`);
      });
    },
    [runRoomAction],
  );

  const myVote = roomState.participants[myId.current]?.vote ?? null;
  const isModerator = roomState.participants[myId.current]?.role === "moderator";

  return {
    participants: roomState.participants,
    storyName: roomState.storyName,
    isVoting: roomState.isVoting,
    isRevealed: roomState.isRevealed,
    history: roomState.history,
    connected,
    myId: myId.current,
    myVote,
    isModerator,
    castVote,
    startVote,
    revealVotes,
    newRound,
    newStory,
    confirmEstimate,
    resetRoom,
    transferModerator,
  };
}
