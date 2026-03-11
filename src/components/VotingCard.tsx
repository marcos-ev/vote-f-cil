import { cn } from '@/lib/utils';

interface VotingCardProps {
  value: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  delay?: number;
}

export function VotingCard({ value, selected, disabled, onClick, delay = 0 }: VotingCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ animationDelay: `${delay}ms` }}
      className={cn(
        'animate-card-enter opacity-0 w-16 h-24 sm:w-20 sm:h-28 rounded-lg font-mono text-xl sm:text-2xl font-bold',
        'border-2 transition-all duration-200 flex items-center justify-center',
        'hover:scale-110 hover:shadow-lg hover:shadow-primary/20',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
        selected
          ? 'bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/30 scale-105'
          : 'bg-card border-border text-foreground hover:border-primary/50'
      )}
    >
      {value}
    </button>
  );
}
