import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Participant, RoomState, Story } from '@/types/poker';
import { RealtimeChannel } from '@supabase/supabase-js';

const generateId = () => Math.random().toString(36).substring(2, 15);

export function useRoom(roomId: string, userName: string, isModerator: boolean) {
  const myId = useRef(localStorage.getItem(`poker-user-id-${roomId}`) || generateId());
  const channelRef = useRef<RealtimeChannel | null>(null);

  const [participants, setParticipants] = useState<Record<string, Participant>>({});
  const [storyName, setStoryName] = useState('');
  const [isVoting, setIsVoting] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [history, setHistory] = useState<Story[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    localStorage.setItem(`poker-user-id-${roomId}`, myId.current);
  }, [roomId]);

  useEffect(() => {
    if (!userName || !roomId) return;

    const channel = supabase.channel(`room:${roomId}`, {
      config: { presence: { key: myId.current } },
    });

    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{
          name: string;
          role: string;
          vote: string | null;
          hasVoted: boolean;
          id: string;
        }>();
        const newParticipants: Record<string, Participant> = {};
        Object.entries(state).forEach(([key, presences]) => {
          const p = presences[0];
          if (p) {
            newParticipants[key] = {
              id: key,
              name: p.name,
              role: p.role as 'moderator' | 'player',
              vote: p.vote,
              hasVoted: p.hasVoted,
            };
          }
        });
        setParticipants(newParticipants);
      })
      .on('broadcast', { event: 'room-update' }, ({ payload }) => {
        if (payload.storyName !== undefined) setStoryName(payload.storyName);
        if (payload.isVoting !== undefined) setIsVoting(payload.isVoting);
        if (payload.isRevealed !== undefined) setIsRevealed(payload.isRevealed);
        if (payload.history !== undefined) setHistory(payload.history);
        // If votes are cleared, reset own vote via presence
        if (payload.clearVotes) {
          channel.track({
            id: myId.current,
            name: userName,
            role: isModerator ? 'moderator' : 'player',
            vote: null,
            hasVoted: false,
          });
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setConnected(true);
          await channel.track({
            id: myId.current,
            name: userName,
            role: isModerator ? 'moderator' : 'player',
            vote: null,
            hasVoted: false,
          });
        }
      });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [roomId, userName, isModerator]);

  const castVote = useCallback((value: string) => {
    channelRef.current?.track({
      id: myId.current,
      name: userName,
      role: isModerator ? 'moderator' : 'player',
      vote: value,
      hasVoted: true,
    });
  }, [userName, isModerator]);

  const broadcast = useCallback((payload: Record<string, unknown>) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'room-update',
      payload,
    });
  }, []);

  const startVote = useCallback((story: string) => {
    setStoryName(story);
    setIsVoting(true);
    setIsRevealed(false);
    broadcast({ storyName: story, isVoting: true, isRevealed: false, clearVotes: true });
  }, [broadcast]);

  const revealVotes = useCallback(() => {
    setIsRevealed(true);
    broadcast({ isRevealed: true });
  }, [broadcast]);

  const newRound = useCallback(() => {
    setIsRevealed(false);
    broadcast({ isRevealed: false, clearVotes: true });
  }, [broadcast]);

  const newStory = useCallback(() => {
    setStoryName('');
    setIsVoting(false);
    setIsRevealed(false);
    broadcast({ storyName: '', isVoting: false, isRevealed: false, clearVotes: true });
  }, [broadcast]);

  const confirmEstimate = useCallback((finalValue: string) => {
    const newHistory = [...history, { name: storyName, finalEstimate: finalValue }];
    setHistory(newHistory);
    setStoryName('');
    setIsVoting(false);
    setIsRevealed(false);
    broadcast({ history: newHistory, storyName: '', isVoting: false, isRevealed: false, clearVotes: true });
  }, [broadcast, history, storyName]);

  const resetRoom = useCallback(() => {
    setHistory([]);
    setStoryName('');
    setIsVoting(false);
    setIsRevealed(false);
    broadcast({ history: [], storyName: '', isVoting: false, isRevealed: false, clearVotes: true });
  }, [broadcast]);

  const myVote = participants[myId.current]?.vote ?? null;

  return {
    participants,
    storyName,
    isVoting,
    isRevealed,
    history,
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
