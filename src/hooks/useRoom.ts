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

export function useRoom(roomId: string, userName: string, isModerator: boolean) {
  const myId = useRef(localStorage.getItem(`poker-user-id-${roomId}`) || generateId());
  const [connected, setConnected] = useState(false);
  const [roomState, setRoomState] = useState<RoomState>(() => emptyRoomState(roomId));

  useEffect(() => {
    localStorage.setItem(`poker-user-id-${roomId}`, myId.current);
  }, [roomId]);

  const refreshRoom = useCallback(async () => {
    if (!roomId) return;
    const { room } = await apiGetRoom(roomId);
    debugLog("H3", "use_room_refresh_ok", {
      roomId,
      isVoting: room.isVoting,
      participantsCount: Object.keys(room.participants).length,
    });
    setRoomState(room);
  }, [roomId]);

  const upsertPresence = useCallback(
    async (vote: string | null, hasVoted: boolean) => {
      if (!roomId || !userName) return;
      debugLog("H3", "use_room_upsert_presence_start", {
        roomId,
        hasUserName: Boolean(userName),
        isModerator,
        hasVoted,
        voteProvided: vote !== null,
      });
      await apiUpsertPresence(roomId, {
        participantId: myId.current,
        name: userName,
        role: isModerator ? "moderator" : "player",
        vote,
        hasVoted,
      });
    },
    [isModerator, roomId, userName],
  );

  const runRoomAction = useCallback(
    async (
      action: "start_vote" | "reveal_votes" | "new_round" | "new_story" | "confirm_estimate" | "reset_room",
      payload?: { storyName?: string; finalEstimate?: string },
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
    if (!roomId) return;
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
  }, [refreshRoom, roomId]);

  useEffect(() => {
    if (!roomId || !userName) return;
    void upsertPresence(null, false).catch(() => undefined);
    return () => {
      void apiLeaveRoom(roomId, myId.current).catch(() => undefined);
    };
  }, [roomId, upsertPresence, userName]);

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

  const myVote = roomState.participants[myId.current]?.vote ?? null;

  return {
    participants: roomState.participants,
    storyName: roomState.storyName,
    isVoting: roomState.isVoting,
    isRevealed: roomState.isRevealed,
    history: roomState.history,
    connected,
    myId: myId.current,
    myVote,
    castVote,
    startVote,
    revealVotes,
    newRound,
    newStory,
    confirmEstimate,
    resetRoom,
  };
}
