import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useRoom } from '@/hooks/useRoom';
import { VotingCard } from '@/components/VotingCard';
import { ParticipantCard } from '@/components/ParticipantCard';
import { VoteStats } from '@/components/VoteStats';
import { SessionHistory } from '@/components/SessionHistory';
import { DECK } from '@/types/poker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Spade, Copy, Check, Eye, RefreshCw, SkipForward, Trash2, Play, CheckCircle2, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

export default function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const isMod = searchParams.get('mod') === '1';

  const [name, setName] = useState('');
  const [joined, setJoined] = useState(false);
  const [storyInput, setStoryInput] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('poker-user-name');
    if (saved) {
      setName(saved);
      // Auto-join if name exists
      setJoined(true);
    }
  }, []);

  const {
    participants, storyName, isVoting, isRevealed, history, connected,
    myVote, castVote, startVote, revealVotes, newRound, newStory, confirmEstimate, resetRoom,
  } = useRoom(roomId || '', joined ? name : '', isMod);

  const handleJoin = () => {
    if (!name.trim()) return;
    localStorage.setItem('poker-user-name', name.trim());
    setJoined(true);
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/sala/${roomId}`;
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

  const numericVotes = useMemo(() => {
    return Object.values(participants)
      .filter(p => p.hasVoted && p.vote !== null && p.vote !== '?' && p.vote !== '☕')
      .map(p => Number(p.vote));
  }, [participants]);

  const suggestedEstimate = useMemo(() => {
    if (numericVotes.length === 0) return null;
    const avg = numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length;
    // Find closest Fibonacci
    const fibs = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
    return String(fibs.reduce((prev, curr) =>
      Math.abs(curr - avg) < Math.abs(prev - avg) ? curr : prev
    ));
  }, [numericVotes]);

  // Join screen
  if (!joined) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <Spade className="w-8 h-8 text-primary mx-auto" />
            <h1 className="text-2xl font-bold">Entrar na Sala</h1>
            <p className="text-sm text-muted-foreground">Sala: {roomId}</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Seu nome..."
              className="bg-secondary border-border"
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
            />
            <Button onClick={handleJoin} disabled={!name.trim()} className="w-full font-semibold">
              Entrar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const participantList = Object.values(participants);
  const allVoted = participantList.length > 0 && participantList.every(p => p.hasVoted);

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Spade className="w-5 h-5 text-primary" />
            <span className="font-bold text-sm">Planning Poker</span>
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
            {/* Story name */}
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Votando em</p>
              <h2 className="text-lg font-bold font-mono">{storyName}</h2>
            </div>

            {/* Cards */}
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

            {/* Participants */}
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="text-sm font-medium mb-3">Participantes</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {participantList.map(p => (
                  <ParticipantCard key={p.id} participant={p} isRevealed={isRevealed} />
                ))}
              </div>
            </div>

            {/* Stats after reveal */}
            {isRevealed && <VoteStats participants={participants} />}

            {/* Moderator vote controls */}
            {isMod && (
              <div className="flex flex-wrap gap-2 justify-center">
                {!isRevealed ? (
                  <Button onClick={revealVotes} className="gap-1.5 font-semibold" disabled={!allVoted && participantList.length > 1}>
                    <Eye className="w-4 h-4" />
                    {allVoted ? 'Revelar Votos' : 'Revelar Votos'}
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
                      <Button onClick={() => confirmEstimate(suggestedEstimate)} className="gap-1.5 font-semibold">
                        <CheckCircle2 className="w-4 h-4" />
                        Confirmar Estimativa ({suggestedEstimate})
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Waiting indicator for non-moderator */}
            {!isMod && !isRevealed && myVote && (
              <div className="text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Aguardando o moderador revelar os votos…
              </div>
            )}
          </>
        )}

        {/* Waiting for vote to start */}
        {!isVoting && !isMod && (
          <div className="text-center py-16 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">Aguardando o moderador iniciar a votação…</p>
          </div>
        )}

        {/* Session History */}
        <SessionHistory history={history} />

        {/* Reset room (moderator only) */}
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
