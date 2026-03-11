import type { Story } from '@/types/poker';
import { Download, History } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SessionHistoryProps {
  history: Story[];
}

export function SessionHistory({ history }: SessionHistoryProps) {
  const exportCsv = () => {
    const header = 'História,Estimativa Final\n';
    const rows = history.map(s => `"${s.name}","${s.finalEstimate ?? ''}"`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `planning-poker-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (history.length === 0) return null;

  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <History className="w-4 h-4 text-muted-foreground" />
          Histórico da Sessão
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5 text-xs">
          <Download className="w-3.5 h-3.5" />
          Exportar CSV
        </Button>
      </div>
      <div className="space-y-2">
        {history.map((s, i) => (
          <div key={i} className="flex items-center justify-between py-2 px-3 bg-secondary/50 rounded-md">
            <span className="text-sm truncate mr-2">{s.name}</span>
            <span className="font-mono font-bold text-primary text-sm flex-shrink-0">
              {s.finalEstimate}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
