import type { Participant } from '@/types/poker';

interface VoteStatsProps {
  participants: Record<string, Participant>;
}

export function VoteStats({ participants }: VoteStatsProps) {
  const votes = Object.values(participants)
    .filter(p => p.hasVoted && p.vote !== null && p.vote !== '?' && p.vote !== '☕')
    .map(p => Number(p.vote))
    .filter(v => !Number.isNaN(v));

  if (votes.length === 0) {
    return (
      <div className="text-center text-muted-foreground text-sm">
        Nenhum voto numérico para calcular estatísticas
      </div>
    );
  }

  const avg = votes.reduce((a, b) => a + b, 0) / votes.length;
  const min = Math.min(...votes);
  const max = Math.max(...votes);

  // Most common
  const freq: Record<number, number> = {};
  votes.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
  const maxFreq = Math.max(...Object.values(freq));
  const mostCommon = Object.entries(freq)
    .filter(([, f]) => f === maxFreq)
    .map(([v]) => v)
    .join(', ');

  const stats = [
    { label: 'Média', value: avg.toFixed(1) },
    { label: 'Mais votado', value: mostCommon },
    { label: 'Mínimo', value: String(min) },
    { label: 'Máximo', value: String(max) },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
