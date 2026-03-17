import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  RefreshCw,
  SkipForward,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useRoom } from "@/hooks/useRoom";
import { DECK } from "@/types/poker";
import { VotingCard } from "@/components/VotingCard";
import { ParticipantCard } from "@/components/ParticipantCard";
import { VoteStats } from "@/components/VoteStats";
import { SessionHistory } from "@/components/SessionHistory";
import { ThemeToggle } from "@/components/theme-toggle";
import { DeleteSquadDialog } from "@/components/delete-squad-dialog";
import { AccountMenu } from "@/components/account-menu";
import { brandAssets } from "@/lib/branding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiDeleteSquad, subscribeSquads } from "@/lib/api";
import { getCurrentFirebaseSession, logoutFirebase } from "@/lib/firebase-auth";
import { clearAuthSession, getAuthSession } from "@/lib/auth-session";
import { bindSquadRoom, resolveSquadRoomId, setLastSquadId } from "@/lib/squad-room";
import { getOrCreateSessionId } from "@/lib/session";
import { parseVoteNumeric } from "@/lib/vote-utils";

const NAME_KEY = "poker-display-name";
type Squad = {
  id: string;
  name: string;
  invite_code: string;
  ownerUserId?: string;
  canDelete?: boolean;
};

function getApiErrorMessage(error: unknown, fallback: string) {
  const raw = error instanceof Error ? String(error.message || "").trim() : "";
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as { error?: string };
    return parsed.error || fallback;
  } catch {
    return raw || fallback;
  }
}

function debugLog(hypothesisId: string, message: string, data: Record<string, unknown>) {
  const payload = {
    sessionId: "df5e7d",
    runId: "pre-fix-review",
    hypothesisId,
    location: "src/pages/Room.tsx",
    message,
    data,
    timestamp: Date.now(),
  };
  // #region agent log
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    navigator.sendBeacon("http://127.0.0.1:7533/ingest/dba1853c-f8d2-4598-bce6-3443fc92be97", JSON.stringify(payload));
  }
  fetch("http://127.0.0.1:7533/ingest/dba1853c-f8d2-4598-bce6-3443fc92be97", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "df5e7d" },
    body: JSON.stringify(payload),
  }).catch(() => { });
  // #endregion
}

export default function Room() {
  const { roomId = "" } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const squadName = searchParams.get("squadName") || searchParams.get("team") || "";
  const squadId = searchParams.get("squadId");
  const canonicalSquadRoomId = useMemo(() => (squadId ? resolveSquadRoomId(squadId) : ""), [squadId]);
  const authSession = useMemo(() => getAuthSession(), []);
  const initialName = useMemo(
    () => localStorage.getItem(NAME_KEY) || authSession?.user.displayName || "",
    [authSession],
  );
  const [userName, setUserName] = useState(initialName);
  const [entered, setEntered] = useState(initialName.trim().length >= 2);
  const [storyInput, setStoryInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [squadsSynced, setSquadsSynced] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [deletingSquadId, setDeletingSquadId] = useState("");
  const [squadToDelete, setSquadToDelete] = useState<Squad | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState("");
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;

  const {
    participants,
    storyName,
    isVoting,
    isRevealed,
    history,
    connected,
    myId,
    myVote,
    isModerator,
    castVote,
    startVote,
    revealVotes,
    newRound,
    newStory,
    confirmEstimate,
    resetRoom,
    transferModerator,
  } = useRoom(roomId, authChecked && entered ? userName.trim() : "", authChecked, squadId);

  const participantList = useMemo(
    () =>
      Object.values(participants).sort((a, b) => {
        // Keep a deterministic order so cards do not jump around on heartbeat updates.
        if (a.role !== b.role) return a.role === "moderator" ? -1 : 1;
        const byName = a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
        if (byName !== 0) return byName;
        return a.id.localeCompare(b.id);
      }),
    [participants],
  );
  const canTransferResponsibility = isModerator;
  const transferCandidates = useMemo(
    () => participantList.filter((participant) => participant.role !== "moderator"),
    [participantList],
  );

  const numericVotes = useMemo(() => {
    return Object.values(participants)
      .filter((p) => p.hasVoted && p.vote !== null)
      .map((p) => parseVoteNumeric(p.vote as string))
      .filter((vote): vote is number => vote !== null);
  }, [participants]);

  const mostVotedEstimate = useMemo(() => {
    const votes = Object.values(participants)
      .filter((p) => p.hasVoted && p.vote !== null)
      .map((p) => p.vote as string);
    if (votes.length === 0) return null;

    const counts = new Map<string, number>();
    votes.forEach((vote) => {
      counts.set(vote, (counts.get(vote) || 0) + 1);
    });

    return DECK.filter((value) => counts.has(value))
      .sort((a, b) => {
        const countDiff = (counts.get(b) || 0) - (counts.get(a) || 0);
        if (countDiff !== 0) return countDiff;
        return DECK.indexOf(a) - DECK.indexOf(b);
      })[0] || null;
  }, [participants]);

  const suggestedEstimate = useMemo(() => {
    if (numericVotes.length === 0) return null;
    const avg = numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length;
    const deckCandidates = DECK.map((label) => ({ label, value: parseVoteNumeric(label) })).filter(
      (item): item is { label: (typeof DECK)[number]; value: number } => item.value !== null,
    );
    if (deckCandidates.length === 0) return null;
    return deckCandidates.reduce((prev, curr) =>
      Math.abs(curr.value - avg) < Math.abs(prev.value - avg) ? curr : prev,
    ).label;
  }, [numericVotes]);

  const finalSuggestedEstimate = useMemo(() => {
    const votes = Object.values(participants)
      .filter((p) => p.hasVoted && p.vote !== null)
      .map((p) => p.vote as string);
    if (votes.length === 0) return null;

    const counts = new Map<string, number>();
    votes.forEach((vote) => {
      counts.set(vote, (counts.get(vote) || 0) + 1);
    });
    const allDifferent = Array.from(counts.values()).every((count) => count === 1);
    if (allDifferent) return suggestedEstimate || mostVotedEstimate;
    return mostVotedEstimate;
  }, [mostVotedEstimate, participants, suggestedEstimate]);

  const sessionId = useMemo(() => getOrCreateSessionId(), []);

  useEffect(() => {
    debugLog("H5", "room_render_committed", {
      roomId,
      renderCount: renderCountRef.current,
      authChecked,
      entered,
      hasAuthSession: Boolean(authSession),
    });
  });

  useEffect(() => {
    if (!squadId || !roomId || !canonicalSquadRoomId) return;
    if (roomId === canonicalSquadRoomId) return;
    const params = new URLSearchParams();
    params.set("squadId", squadId);
    if (squadName) params.set("squadName", squadName);
    navigate(`/sala/${canonicalSquadRoomId}?${params.toString()}`, { replace: true });
  }, [canonicalSquadRoomId, navigate, roomId, squadId, squadName]);

  useEffect(() => {
    if (!authSession) {
      debugLog("H1", "room_auth_missing_session_redirect", { roomId });
      navigate("/login");
      return;
    }
    void (async () => {
      try {
        const me = await getCurrentFirebaseSession();
        if (!me) {
          clearAuthSession();
          navigate("/login");
          return;
        }
        debugLog("H1", "room_auth_me_ok", {
          roomId,
          userId: me.user.id,
          username: me.user.username,
          hadInitialName: Boolean(initialName),
        });
        if (!initialName) {
          setUserName(me.user.displayName);
        }
      } catch {
        debugLog("H1", "room_auth_me_failed", { roomId });
        clearAuthSession();
        navigate("/login");
        return;
      } finally {
        setAuthChecked(true);
      }
    })();
  }, [authSession, initialName, navigate, roomId]);

  const goToSquadRoom = (nextSquad: Squad) => {
    const targetRoom = resolveSquadRoomId(nextSquad.id);
    debugLog("H4", "room_go_to_squad_room", {
      fromRoomId: roomId,
      nextSquadId: nextSquad.id,
      targetRoom,
    });
    bindSquadRoom(nextSquad.id, targetRoom);
    setLastSquadId(nextSquad.id);
    const params = new URLSearchParams({
      squadId: nextSquad.id,
      squadName: nextSquad.name,
    });
    navigate(`/sala/${targetRoom}?${params.toString()}`);
  };

  useEffect(() => {
    if (!authChecked) return;
    let unsubscribe: (() => void) | null = null;
    let active = true;
    setSquadsSynced(false);
    void subscribeSquads(
      (nextSquads) => {
        if (!active) return;
        debugLog("H4", "room_squads_realtime_update", {
          roomId,
          squadId,
          squadsCount: nextSquads.length,
        });
        setSquads(nextSquads);
        setSquadsSynced(true);
      },
      () => {
        if (!active) return;
        debugLog("H4", "room_squads_realtime_failed", { roomId, squadId });
        setSquadsSynced(true);
      },
    ).then((unsub) => {
      if (!active) {
        unsub();
        return;
      }
      unsubscribe = unsub;
    });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [authChecked, roomId, squadId]);

  useEffect(() => {
    if (!authChecked || !squadId || !squadsSynced) return;
    const squadStillExists = squads.some((squad) => squad.id === squadId);
    if (!squadStillExists) {
      toast.error("Esta squad foi removida. Voltando para a página inicial.");
      navigate("/");
    }
  }, [authChecked, navigate, squadId, squads, squadsSynced]);

  useEffect(() => {
    if (!canTransferResponsibility) {
      setTransferTargetId("");
      return;
    }
    if (transferCandidates.length === 0) {
      setTransferTargetId("");
      return;
    }
    setTransferTargetId((current) => {
      if (current && transferCandidates.some((candidate) => candidate.id === current)) return current;
      return transferCandidates[0].id;
    });
  }, [canTransferResponsibility, transferCandidates]);

  const deleteSquad = async (squad: Squad) => {
    setDeletingSquadId(squad.id);
    try {
      await apiDeleteSquad(squad.id, sessionId);
      toast.success(`Squad "${squad.name}" apagada.`);
      if (squadId === squad.id) {
        navigate("/");
      }
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Falha ao apagar squad."));
    } finally {
      setDeletingSquadId("");
      setSquadToDelete(null);
    }
  };

  const handleCopyLink = () => {
    const params = new URLSearchParams();
    if (squadId) params.set("squadId", squadId);
    if (squadName) params.set("squadName", squadName);
    const suffix = params.toString();
    const url = suffix
      ? `${window.location.origin}/sala/${roomId}?${suffix}`
      : `${window.location.origin}/sala/${roomId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link da sala copiado");
    setTimeout(() => setCopied(false), 2000);
  };

  const enterRoom = () => {
    if (userName.trim().length < 2) {
      toast.error("Digite seu nome para entrar");
      return;
    }
    localStorage.setItem(NAME_KEY, userName.trim());
    setEntered(true);
  };

  const logout = async () => {
    await logoutFirebase();
    navigate("/login");
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Validando sessão...
      </div>
    );
  }

  if (!entered) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-3">
            <img src={brandAssets.iconLight} alt="CD2 Tech" className="w-16 h-16 mx-auto hidden dark:block" />
            <img src={brandAssets.iconDark} alt="CD2 Tech" className="w-16 h-16 mx-auto block dark:hidden" />
            <h1 className="text-2xl font-bold">Entrar na sala {roomId}</h1>
            <p className="text-sm text-muted-foreground">Informe seu nome para participar da votação.</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-6 space-y-3">
            <Input
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Seu nome"
              className="bg-secondary border-border"
              onKeyDown={(e) => e.key === "Enter" && enterRoom()}
            />
            <Button onClick={enterRoom} className="w-full font-semibold">
              Entrar na sala
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3 gap-1 text-xs flex-shrink-0 md:ml-3"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Voltar</span>
            </Button>
            <div className="min-w-0 flex-1 flex justify-center">
              <button
                type="button"
                onClick={() => navigate("/")}
                aria-label="Voltar para a tela principal"
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                <img src={brandAssets.wordmarkDark} alt="CD2 Tech" className="h-6 sm:h-7 hidden dark:block cursor-pointer" />
                <img src={brandAssets.wordmarkLight} alt="CD2 Tech" className="h-6 sm:h-7 block dark:hidden cursor-pointer" />
              </button>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <ThemeToggle />
              <div className={`w-2 h-2 rounded-full ${connected ? "bg-primary" : "bg-destructive"}`} />
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="justify-center gap-1.5 text-xs"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copiado!" : "Copiar Link"}
              </Button>
              <AccountMenu
                squads={squads.map((squad) => ({ id: squad.id, name: squad.name }))}
                onLogout={logout}
                onDisplayNameUpdated={(nextName) => setUserName(nextName)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {participantList.length} {participantList.length === 1 ? "participante" : "participantes"}
            </span>
          </div>
        </div>
      </header>

      <aside
        className={`hidden md:flex md:flex-col fixed left-0 top-0 h-screen pt-16 bg-card border-r border-border p-3 transition-all z-20 ${sidebarCollapsed ? "w-16" : "w-72"
          }`}
      >
        <div className="flex items-center justify-between gap-2">
          {!sidebarCollapsed && <h3 className="text-sm font-semibold">Squads</h3>}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setSidebarCollapsed((v) => !v)}
            aria-label="Alternar sidebar"
          >
            {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </Button>
        </div>
        {!sidebarCollapsed && (
          <div className="mt-3 space-y-2 flex-1 min-h-0 overflow-y-auto pr-1">
            <p className="text-xs text-muted-foreground">Troque de squad sem sair da sala.</p>
            {squads.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem squads disponíveis.</p>
            ) : (
              <div className="space-y-1.5">
                {squads.map((s) => (
                  <div
                    key={s.id}
                    className={`w-full rounded-md border px-2 py-1.5 text-sm transition-colors flex items-center gap-1 ${s.id === squadId
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-secondary/30 hover:bg-secondary"
                      }`}
                  >
                    <button
                      type="button"
                      onClick={() => goToSquadRoom(s)}
                      className="flex-1 text-left px-0.5 py-0.5"
                    >
                      {s.name}
                    </button>
                    {s.canDelete && (
                      <button
                        type="button"
                        title="Apagar squad"
                        aria-label={`Apagar squad ${s.name}`}
                        className="p-1 rounded hover:bg-destructive/15 text-destructive disabled:opacity-50"
                        disabled={deletingSquadId === s.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSquadToDelete(s);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </aside>

      <main className={`${sidebarCollapsed ? "md:pl-20" : "md:pl-72"} px-4 mt-4 sm:mt-6 transition-all`}>
        <div className="max-w-5xl mx-auto space-y-6">
          <section className="bg-card rounded-xl border border-border p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground break-words">
              <span>
                Sala: <span className="font-mono">{roomId}</span>
              </span>
              {squadName && <span>· Squad: {squadName}</span>}
              <span>· {isModerator ? "Perfil: moderador" : "Perfil: participante"}</span>
              <span>· Conexão: {connected ? "online" : "reconectando..."}</span>
            </div>
          </section>

          {isModerator && !isVoting && (
            <div className="bg-card rounded-xl border border-border p-4 sm:p-5">
              <label className="text-sm font-medium mb-2 block">Nome da história / ticket</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={storyInput}
                  onChange={(e) => setStoryInput(e.target.value)}
                  placeholder="Ex: US-123 - Login com SSO"
                  className="bg-secondary border-border flex-1"
                  onKeyDown={(e) => e.key === "Enter" && storyInput.trim() && (startVote(storyInput.trim()), setStoryInput(""))}
                />
                <Button
                  onClick={() => {
                    startVote(storyInput.trim());
                    setStoryInput("");
                  }}
                  disabled={!storyInput.trim()}
                  className="w-full sm:w-auto gap-1.5 font-semibold"
                >
                  <Play className="w-4 h-4" />
                  Iniciar Votação
                </Button>
              </div>
            </div>
          )}

          {isVoting && (
            <>
              <div className="bg-card rounded-xl border border-border p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Votando em</p>
                <h2 className="text-lg font-bold font-mono">{storyName}</h2>
              </div>

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

              <div className="bg-card rounded-xl border border-border p-4">
                <h3 className="text-sm font-medium mb-3">Participantes</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {participantList.map((p) => (
                    <ParticipantCard key={p.id} participant={p} isRevealed={isRevealed} />
                  ))}
                </div>
              </div>

              {isRevealed && <VoteStats participants={participants} />}

              {isModerator && (
                <div className="grid gap-2 sm:flex sm:flex-wrap sm:justify-center">
                  {!isRevealed ? (
                    <Button onClick={revealVotes} className="w-full sm:w-auto gap-1.5 font-semibold">
                      <Eye className="w-4 h-4" />
                      Revelar Votos
                    </Button>
                  ) : (
                    <>
                      <Button variant="outline" onClick={newRound} className="w-full sm:w-auto gap-1.5">
                        <RefreshCw className="w-4 h-4" />
                        Nova Rodada
                      </Button>
                      <Button variant="outline" onClick={newStory} className="w-full sm:w-auto gap-1.5">
                        <SkipForward className="w-4 h-4" />
                        Limpar História Atual
                      </Button>
                      {finalSuggestedEstimate && (
                        <Button
                          onClick={() => confirmEstimate(finalSuggestedEstimate)}
                          className="w-full sm:w-auto gap-1.5 font-semibold"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Confirmar Estimativa ({finalSuggestedEstimate})
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}

              {canTransferResponsibility && transferCandidates.length > 0 && (
                <div className="bg-card rounded-xl border border-border p-4 sm:p-5 space-y-2">
                  <h3 className="text-sm font-medium">Transferir responsabilidade</h3>
                  <p className="text-xs text-muted-foreground">
                    {squadId
                      ? "Apenas o owner da squad pode transferir para outro participante."
                      : "Apenas o responsável atual da sala pode transferir para outro participante."}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      value={transferTargetId}
                      onChange={(event) => setTransferTargetId(event.target.value)}
                      className="h-10 rounded-md border border-border bg-secondary px-3 text-sm"
                    >
                      {transferCandidates.map((participant) => (
                        <option key={participant.id} value={participant.id}>
                          {participant.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="outline"
                      onClick={() => transferModerator(transferTargetId)}
                      disabled={!transferTargetId}
                      className="w-full sm:w-auto"
                    >
                      Transferir
                    </Button>
                  </div>
                </div>
              )}

              {!isModerator && !isRevealed && myVote && (
                <div className="text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Aguardando o moderador revelar os votos...
                </div>
              )}
            </>
          )}

          {!isVoting && !isModerator && (
            <div className="text-center py-16 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">Aguardando o moderador iniciar a votação...</p>
            </div>
          )}

          <SessionHistory history={history} roomId={roomId} />

          <div className="flex flex-wrap justify-center gap-2">
            {isModerator && history.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetRoom}
                className="text-destructive hover:text-destructive gap-1.5 text-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Resetar Sala
              </Button>
            )}
          </div>
        </div>
      </main>
      <DeleteSquadDialog
        open={Boolean(squadToDelete)}
        squadName={squadToDelete?.name || ""}
        isDeleting={Boolean(squadToDelete && deletingSquadId === squadToDelete.id)}
        onOpenChange={(open) => {
          if (!open && !deletingSquadId) setSquadToDelete(null);
        }}
        onConfirm={async () => {
          if (!squadToDelete) return;
          await deleteSquad(squadToDelete);
        }}
      />
    </div>
  );
}
