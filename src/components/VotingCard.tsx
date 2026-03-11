import { cn } from '@/lib/utils';
import { CircleAlert } from "lucide-react";
import { CARD_GUIDANCE, type CardValue } from "@/types/poker";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface VotingCardProps {
  value: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  delay?: number;
}

export function VotingCard({ value, selected, disabled, onClick, delay = 0 }: VotingCardProps) {
  const guidance = CARD_GUIDANCE[value as CardValue];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          disabled={disabled}
          style={{ animationDelay: `${delay}ms` }}
          className={cn(
            "animate-card-enter opacity-0 w-16 h-24 sm:w-20 sm:h-28 rounded-lg font-mono text-xl sm:text-2xl font-bold",
            "border-2 transition-all duration-200 flex items-center justify-center relative",
            "hover:scale-110 hover:shadow-lg hover:shadow-primary/20",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
            selected
              ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/30 scale-105"
              : "bg-card border-border text-foreground hover:border-primary/50",
          )}
          aria-label={`${value}: ${guidance}`}
        >
          <span>{value}</span>
          <span className="absolute right-1 top-1 opacity-60">
            <CircleAlert className="w-3 h-3" />
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px] text-[11px] leading-snug">
        {guidance}
      </TooltipContent>
    </Tooltip>
  );
}
