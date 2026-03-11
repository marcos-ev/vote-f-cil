import { useState, useEffect, useCallback, useRef } from "react";
import { apiGetRoom, apiLeaveRoom, apiRoomAction, apiUpsertPresence } from "@/lib/api";
import { connectRoomRealtime } from "@/lib/realtime";
import type { RoomState } from "@/types/poker";
import { toast } from "sonner";

const generateId = () => Math.random().toString(36).substring(2, 15);

function getErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message.trim() : "";
  return message || fallback;
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
    setRoomState(room);
  }, [roomId]);

  const upsertPresence = useCallback(
    async (vote: string | null, hasVoted: boolean) => {
      if (!roomId || !userName) return;
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
      await apiRoomAction(roomId, { action, ...payload });
    },
    [roomId],
  );

  useEffect(() => {
    if (!roomId) return;
    void refreshRoom().catch(() => undefined);
    const connection = connectRoomRealtime(roomId, {
      onOpen: () => setConnected(true),
      onClose: () => setConnected(false),
      onRoomUpdate: (state) => setRoomState(state),
    });
    return () => {
      connection.close();
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
