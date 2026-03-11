import { useEffect, useMemo, useState } from "react";
import type { Story, StoryDetail } from "@/types/poker";
import { Download, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiGetRoomStories } from "@/lib/api";

interface SessionHistoryProps {
  history: Story[];
  roomId: string;
}

export function SessionHistory({ history, roomId }: SessionHistoryProps) {
  const [details, setDetails] = useState<StoryDetail[]>([]);
  const [selected, setSelected] = useState<Story | null>(null);

  useEffect(() => {
    if (!roomId || history.length === 0) {
      setDetails([]);
      return;
    }
    void (async () => {
      try {
        const result = await apiGetRoomStories(roomId);
        setDetails(result.stories);
      } catch {
        setDetails([]);
      }
    })();
  }, [history.length, roomId]);

  const selectedDetail = useMemo(() => {
    if (!selected) return null;
    if (selected.id !== undefined) {
      return details.find((d) => d.id === selected.id) || null;
    }
    return details.find((d) => d.storyName === selected.name && d.finalEstimate === selected.finalEstimate) || null;
  }, [details, selected]);

  const exportCsv = () => {
    const header = "História,Estimativa Final\n";
    const rows = history.map((s) => `"${s.name}","${s.finalEstimate ?? ""}"`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `planning-poker-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (history.length === 0) return null;

  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <History className="w-4 h-4 text-muted-foreground" />
          Histórico da Sessão
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} className="w-full gap-1.5 text-xs sm:w-auto">
          <Download className="w-3.5 h-3.5" />
          Exportar CSV
        </Button>
      </div>
      <div className="space-y-2">
        {history.map((s, i) => (
          <button
            key={`${s.id ?? "legacy"}-${i}`}
            type="button"
            onClick={() => setSelected(s)}
            className="w-full text-left flex flex-col gap-1 rounded-md bg-secondary/50 px-3 py-2 hover:bg-secondary sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="mr-2 text-sm break-words">{s.name}</span>
            <span className="font-mono font-bold text-primary dark:text-foreground text-sm sm:flex-shrink-0">
              {s.finalEstimate}
            </span>
          </button>
        ))}
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhe da votação finalizada</DialogTitle>
            <DialogDescription>
              Modo somente leitura. Esta história já foi encerrada e não pode ser editada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-md border border-border p-3 bg-secondary/20">
              <div className="text-xs text-muted-foreground">História</div>
              <div className="text-sm font-medium break-words">{selected?.name}</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border border-border p-3 bg-secondary/20">
                <div className="text-xs text-muted-foreground">Estimativa final</div>
                <div className="text-sm font-mono font-bold text-primary dark:text-foreground">
                  {selected?.finalEstimate ?? "-"}
                </div>
              </div>
              <div className="rounded-md border border-border p-3 bg-secondary/20">
                <div className="text-xs text-muted-foreground">Finalizada em</div>
                <div className="text-sm">
                  {selectedDetail ? new Date(selectedDetail.finalizedAt).toLocaleString() : "Sem data detalhada"}
                </div>
              </div>
            </div>

            {selectedDetail ? (
              <>
                <div className="rounded-md border border-border p-3 bg-secondary/20">
                  <div className="text-xs text-muted-foreground mb-2">Resumo estatístico</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <div>Votos: {selectedDetail.stats.votesCount}</div>
                    <div>Média: {selectedDetail.stats.avg ?? "-"}</div>
                    <div>Mín: {selectedDetail.stats.min ?? "-"}</div>
                    <div>Máx: {selectedDetail.stats.max ?? "-"}</div>
                  </div>
                </div>
                <div className="rounded-md border border-border p-3 bg-secondary/20">
                  <div className="text-xs text-muted-foreground mb-2">Votos no fechamento</div>
                  {selectedDetail.voteSnapshot.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Sem snapshot de votos para esta história.</div>
                  ) : (
                    <div className="space-y-1.5 max-h-56 overflow-auto pr-1">
                      {selectedDetail.voteSnapshot.map((vote) => (
                        <div key={vote.id} className="flex items-center justify-between text-sm rounded bg-background px-2 py-1.5">
                          <span>{vote.name}</span>
                          <span className="font-mono">{vote.hasVoted ? vote.vote : "Sem voto"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-md border border-border p-3 bg-secondary/20 text-sm text-muted-foreground">
                Detalhes completos indisponíveis para esta história antiga. Apenas o resumo foi encontrado.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
