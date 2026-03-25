import { useEffect, useMemo, useState } from "react";
import type { Story, StoryDetail } from "@/types/poker";
import { Check, Copy, Download, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiGetRoomStories } from "@/lib/api";
import { getEstimatedHoursLabel, getEstimatedHoursOnlyLabel } from "@/lib/estimate-hours";
import { toast } from "sonner";

interface SessionHistoryProps {
  history: Story[];
  roomId: string;
}

export function SessionHistory({ history, roomId }: SessionHistoryProps) {
  const [details, setDetails] = useState<StoryDetail[]>([]);
  const [selected, setSelected] = useState<Story | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Mostra as histórias mais recentes primeiro (UI do "Histórico da Sessão").
  const orderedHistory = useMemo(() => [...history].reverse(), [history]);

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
    const header = "História,Estimativa Final,Horas Estimadas\n";
    const rows = orderedHistory
      .map((s) => `"${s.name}","${s.finalEstimate ?? ""}","${getEstimatedHoursLabel(s.finalEstimate)}"`)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `planning-poker-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyRefinementText = (story: Story, key: string) => {
    const hours = getEstimatedHoursOnlyLabel(story.finalEstimate);
    const points = story.finalEstimate ?? "-";
    const text = `Realizado refinamento com estimativas de ${points} pontos (${hours})`;
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("Estimativa copiada");
    window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1200);
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
        {orderedHistory.map((s, i) => (
          <button
            // Como a lista é invertida, usamos o índice original para manter a `key` estável
            // quando histórias novas são adicionadas ao final.
            key={`${s.id ?? "legacy"}-${history.length - 1 - i}`}
            type="button"
            onClick={() => setSelected(s)}
            className="w-full text-left flex flex-col gap-1 rounded-md bg-secondary/50 px-3 py-2 hover:bg-secondary sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="mr-2 text-sm break-words">{s.name}</span>
            <div className="text-right sm:flex-shrink-0 relative pr-7">
              <button
                type="button"
                aria-label="Copiar texto de refinamento"
                className="absolute right-0 top-0 p-1 rounded hover:bg-background/70 transition-colors"
                onClick={(event) => {
                  event.stopPropagation();
                  copyRefinementText(s, `${s.id ?? "legacy"}-${i}`);
                }}
              >
                {copiedKey === `${s.id ?? "legacy"}-${i}` ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
              <span className="font-mono font-bold text-primary dark:text-foreground text-sm block">
                {s.finalEstimate}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {getEstimatedHoursLabel(s.finalEstimate)}
              </span>
            </div>
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
              <div className="rounded-md border border-border p-3 bg-secondary/20 col-span-2">
                <div className="text-xs text-muted-foreground flex items-center justify-between gap-2">
                  <span>Horas estimadas</span>
                  <button
                    type="button"
                    aria-label="Copiar texto de refinamento"
                    className="p-1 rounded hover:bg-background/70 transition-colors"
                    onClick={() => {
                      if (!selected) return;
                      copyRefinementText(selected, `detail-${selected.id ?? selected.name}`);
                    }}
                  >
                    {copiedKey === `detail-${selected?.id ?? selected?.name}` ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <div className="text-sm font-medium">{getEstimatedHoursLabel(selected?.finalEstimate)}</div>
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
