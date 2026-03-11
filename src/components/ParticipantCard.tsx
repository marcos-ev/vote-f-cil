import { cn } from '@/lib/utils';
import { Check, Clock, Crown } from 'lucide-react';
import type { Participant } from '@/types/poker';

interface ParticipantCardProps {
  participant: Participant;
  isRevealed: boolean;
}

export function ParticipantCard({ participant, isRevealed }: ParticipantCardProps) {
  const { name, role, vote, hasVoted } = participant;

  return (
    <div className="flex items-center gap-3">
      {/* Mini card */}
      <div className="perspective-500" style={{ perspective: '500px' }}>
        <div className={cn('card-inner w-12 h-16 sm:w-14 sm:h-20', isRevealed && hasVoted && 'flipped')}>
          {/* Back of card (shown by default) */}
          <div
            className={cn(
              'card-front flex items-center justify-center rounded-lg border-2 text-xs font-bold',
              hasVoted
                ? 'bg-primary/20 border-primary text-primary'
                : 'bg-muted border-border text-muted-foreground animate-pulse-glow'
            )}
          >
            {hasVoted ? <Check className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
          </div>
          {/* Front of card (vote value, shown on reveal) */}
          <div className="card-back flex items-center justify-center rounded-lg border-2 bg-primary border-primary text-primary-foreground font-mono text-lg font-bold">
            {vote ?? '—'}
          </div>
        </div>
      </div>

      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate">{name}</span>
          {role === 'moderator' && <Crown className="w-3.5 h-3.5 text-accent flex-shrink-0" />}
        </div>
        <span className={cn(
          'text-xs',
          hasVoted ? 'text-primary' : 'text-muted-foreground'
        )}>
          {hasVoted ? 'Votou ✓' : 'Aguardando…'}
        </span>
      </div>
    </div>
  );
}
