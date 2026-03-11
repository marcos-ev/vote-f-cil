import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useRoom } from '@/hooks/useRoom';
import { supabase } from '@/integrations/supabase/client';
import { VotingCard } from '@/components/VotingCard';
import { ParticipantCard } from '@/components/ParticipantCard';
import { VoteStats } from '@/components/VoteStats';
import { SessionHistory } from '@/components/SessionHistory';
import { DECK } from '@/types/poker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Spade, Copy, Check, Eye, RefreshCw, SkipForward, Trash2, Play, CheckCircle2, Loader2, ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';

export default function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const isMod = searchParams.get('mod') === '1';
  const teamId = searchParams.get('team');
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const userName = profile?.display_name || user?.email || 'Jogador';

  const [storyInput, setStoryInput] = useState('');
  const [copied, setCopied] = useState(false);

  const {
    participants, storyName, isVoting, isRevealed, history, connected,
    myVote, castVote, startVote, revealVotes, newRound, newStory, confirmEstimate, resetRoom,
  } = useRoom(roomId || '', userName, isMod);

  const handleCopyLink = () => {
    // Participants join without mod flag, but with team
    const url = teamId
      ? `${window.location.origin}/sala/${roomId}?team=${teamId}`
      : `${window.location.origin}/sala/${roomId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartVote = () => {
    if (!storyInput.trim()) return;
    startVote(storyInput.trim());
    setStoryInput('');
  };

  const handleConfirmEstimate = async (value: string) => {
    confirmEstimate(value);

    // Persist to DB if team is set
    if (teamId && user) {
      try {
        const { data: session } = await supabase
          .from('vote_sessions')
          .insert({
            team_id: teamId,
            room_id: roomId!,
            story_name: storyName,
            final_estimate: value,
            created_by: user.id,
          })
          .select()
          .single();

        if (session) {
          // Save individual votes
          const votesToInsert = Object.values(participants)
            .filter(p => p.hasVoted && p.vote)
            .map(p => ({
              session_id: session.id,
              user_id: user.id, // We only know own user_id for RLS
              vote_value: p.vote!,
            }));

          // We can only insert our own vote due to RLS
          if (myVote) {
            await supabase.from('votes').insert({
              session_id: session.id,
              user_id: user.id,
              vote_value: myVote,
            });
          }
        }
      } catch (e) {
        // Non-critical, don't block flow
      }
    }
  };

  const numericVotes = useMemo(() => {
    return Object.values(participants)
      .filter(p => p.hasVoted && p.vote !== null && p.vote !== '?' && p.vote !== '☕')
      .map(p => Number(p.vote));
  }, [participants]);

  const suggestedEstimate = useMemo(() => {
    if (numericVotes.length === 0) return null;
    const avg = numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length;
    const deckNums = [0, 0.5, 1, 2, 3, 5, 8, 13, 20, 40, 100];
    return String(deckNums.reduce((prev, curr) =>
      Math.abs(curr - avg) < Math.abs(prev - avg) ? curr : prev
    ));
  }, [numericVotes]);

  const participantList = Object.values(participants);
  const allVoted = participantList.length > 0 && participantList.every(p => p.hasVoted);

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="gap-1 text-xs p-1">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Spade className="w-5 h-5 text-primary" />
            <span className="font-bold text-sm">CD2 Poker Planning</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-primary' : 'bg-destructive'}`} />
            <span className="text-xs text-muted-foreground">
              {participantList.length} {participantList.length === 1 ? 'participante' : 'participantes'}
            </span>
            <Button variant="outline" size="sm" onClick={handleCopyLink} className="gap-1.5 text-xs ml-2">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado!' : 'Copiar Link'}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 mt-6 space-y-6">
        {/* Moderator controls - start vote */}
        {isMod && !isVoting && (
          <div className="bg-card rounded-xl border border-border p-5">
            <label className="text-sm font-medium mb-2 block">Nome da história / ticket</label>
            <div className="flex gap-2">
              <Input
                value={storyInput}
                onChange={e => setStoryInput(e.target.value)}
                placeholder="Ex: US-123 — Tela de login"
                className="bg-secondary border-border flex-1"
                onKeyDown={e => e.key === 'Enter' && handleStartVote()}
              />
              <Button onClick={handleStartVote} disabled={!storyInput.trim()} className="gap-1.5 font-semibold">
                <Play className="w-4 h-4" />
                Iniciar Votação
              </Button>
            </div>
          </div>
        )}

        {/* Active voting */}
        {isVoting && (
          <>
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Votando em</p>
              <h2 className="text-lg font-bold font-mono">{storyName}</h2>
            </div>

            {!isRevealed && (
              <div className="flex flex-wrap justify-center gap-3">
                {DECK.map((value, i) => (
                  <VotingCard
                    key={value}
                    value={value}
                    selected={myVote === value}
                    onClick={() => castVote(value)}
                    delay={i * 30}
                  />
                ))}
              </div>
            )}

            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="text-sm font-medium mb-3">Participantes</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {participantList.map(p => (
                  <ParticipantCard key={p.id} participant={p} isRevealed={isRevealed} />
                ))}
              </div>
            </div>

            {isRevealed && <VoteStats participants={participants} />}

            {isMod && (
              <div className="flex flex-wrap gap-2 justify-center">
                {!isRevealed ? (
                  <Button onClick={revealVotes} className="gap-1.5 font-semibold">
                    <Eye className="w-4 h-4" />
                    Revelar Votos
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={newRound} className="gap-1.5">
                      <RefreshCw className="w-4 h-4" />
                      Votar Novamente
                    </Button>
                    <Button variant="outline" onClick={newStory} className="gap-1.5">
                      <SkipForward className="w-4 h-4" />
                      Nova História
                    </Button>
                    {suggestedEstimate && (
                      <Button onClick={() => handleConfirmEstimate(suggestedEstimate)} className="gap-1.5 font-semibold">
                        <CheckCircle2 className="w-4 h-4" />
                        Confirmar Estimativa ({suggestedEstimate})
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}

            {!isMod && !isRevealed && myVote && (
              <div className="text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Aguardando o moderador revelar os votos…
              </div>
            )}
          </>
        )}

        {!isVoting && !isMod && (
          <div className="text-center py-16 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">Aguardando o moderador iniciar a votação…</p>
          </div>
        )}

        <SessionHistory history={history} />

        {isMod && history.length > 0 && (
          <div className="text-center">
            <Button variant="ghost" size="sm" onClick={resetRoom} className="text-destructive hover:text-destructive gap-1.5 text-xs">
              <Trash2 className="w-3.5 h-3.5" />
              Resetar Sala
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
