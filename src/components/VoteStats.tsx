import type { Participant } from '@/types/poker';
import { DECK } from "@/types/poker";
import { filterNumericVoteLabels, parseVoteNumeric } from "@/lib/vote-utils";
import { getEstimatedHoursByPoints } from "@/lib/estimate-hours";

interface VoteStatsProps {
  participants: Record<string, Participant>;
}

export function VoteStats({ participants }: VoteStatsProps) {
  const revealedVotes = Object.values(participants)
    .filter((p) => p.hasVoted && p.vote !== null)
    .map((p) => p.vote as string);
  const numericVoteLabels = filterNumericVoteLabels(revealedVotes);
  const numericVotes = revealedVotes
    .map((vote) => parseVoteNumeric(vote))
    .filter((vote): vote is number => vote !== null);

  if (numericVotes.length === 0) {
    return (
      <div className="text-center text-muted-foreground text-sm">
        Nenhum voto numérico para calcular estatísticas
      </div>
    );
  }

  const avg = numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length;
  const min = Math.min(...numericVotes);
  const max = Math.max(...numericVotes);

  const counts = new Map<string, number>();
  numericVoteLabels.forEach((vote) => {
    counts.set(vote, (counts.get(vote) || 0) + 1);
  });
  const maxCount = Math.max(...Array.from(counts.values()));
  const mostCommonVotes = Array.from(counts.entries())
    .filter(([, count]) => count === maxCount)
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      const aOrder = DECK.indexOf(a[0] as (typeof DECK)[number]);
      const bOrder = DECK.indexOf(b[0] as (typeof DECK)[number]);
      if (aOrder >= 0 && bOrder >= 0) return aOrder - bOrder;
      if (aOrder >= 0) return -1;
      if (bOrder >= 0) return 1;
      return a[0].localeCompare(b[0]);
    })
    .map(([vote]) => vote);
  const mostCommon = mostCommonVotes.join(", ");
  const estimatedHours = mostCommonVotes
    .map((vote) => getEstimatedHoursByPoints(vote))
    .filter((hours): hours is string => Boolean(hours))
    .join(" / ");

  const stats = [
    { label: 'Média', value: avg.toFixed(1) },
    { label: 'Mais votado', value: mostCommon },
    { label: 'Mínimo', value: String(min) },
    { label: 'Máximo', value: String(max) },
    { label: 'Horas estimadas', value: estimatedHours || "-" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {stats.map(s => (
        <div key={s.label} className="bg-secondary rounded-lg p-3 text-center">
          <div className="text-xs text-muted-foreground mb-1">{s.label}</div>
          <div className="text-lg sm:text-xl font-mono font-bold text-primary dark:text-foreground break-words">
            {s.value}
          </div>
        </div>
      ))}
    </div>
  );
}
