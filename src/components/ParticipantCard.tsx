import { cn } from '@/lib/utils';
import { Check, Clock, Crown, X } from 'lucide-react';
import type { Participant } from '@/types/poker';

interface ParticipantCardProps {
  participant: Participant;
  isRevealed: boolean;
  canRemove?: boolean;
  onRemove?: () => void;
}

export function ParticipantCard({ participant, isRevealed, canRemove, onRemove }: ParticipantCardProps) {
  const { name, role, vote, hasVoted } = participant;

  return (
    <div className="flex items-center gap-3">
      {/* Mini card */}
      <div className="perspective-500 relative" style={{ perspective: '500px' }}>
        {canRemove && (
          <button
            type="button"
            aria-label="Remover participante da votação"
            className="absolute right-1 top-1 z-10 rounded-full bg-background/80 border border-border p-0.5 hover:bg-background"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove?.();
            }}
          >
            <X className="w-2.5 h-2.5 text-destructive" />
          </button>
        )}
        <div className={cn('card-inner w-12 h-16 sm:w-14 sm:h-20', isRevealed && hasVoted && 'flipped')}>
          {/* Back of card (shown by default) */}
          <div
            className={cn(
              'card-front flex items-center justify-center rounded-lg border-2 text-xs font-bold',
              hasVoted
                ? 'bg-primary/20 border-primary text-primary dark:text-foreground'
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
          hasVoted ? 'text-primary dark:text-foreground' : 'text-muted-foreground'
        )}>
          {hasVoted ? 'Votou ✓' : 'Aguardando…'}
        </span>
      </div>
    </div>
  );
}
