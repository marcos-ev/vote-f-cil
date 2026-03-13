import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link2, LogOut, PanelLeftClose, PanelLeftOpen, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { DeleteSquadDialog } from "@/components/delete-squad-dialog";
import { brandAssets } from "@/lib/branding";
import { apiCreateSquad, apiDeleteSquad, apiListSquadsForSession, subscribeSquads } from "@/lib/api";
import { getCurrentFirebaseSession, logoutFirebase } from "@/lib/firebase-auth";
import { clearAuthSession, getAuthSession } from "@/lib/auth-session";
import { bindSquadRoom, getLastSquadId, resolveSquadRoomId, setLastSquadId } from "@/lib/squad-room";
import { getOrCreateSessionId } from "@/lib/session";

const LAST_NAME_KEY = "poker-display-name";
const generateRoomId = () => Math.random().toString(36).substring(2, 8);
type Squad = Awaited<ReturnType<typeof apiListSquadsForSession>>["squads"][number];

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
  // #region agent log
  fetch("http://127.0.0.1:7533/ingest/dba1853c-f8d2-4598-bce6-3443fc92be97", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "df5e7d" },
    body: JSON.stringify({
      sessionId: "df5e7d",
      runId: "pre-fix-review",
      hypothesisId,
      location: "src/pages/Dashboard.tsx",
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}

function isValidRoomId(roomId: string) {
  return /^[a-zA-Z0-9_-]{4,32}$/.test(roomId);
}

function parseRoomInput(value: string): { roomId: string; queryParams: URLSearchParams } | null {
  const input = value.trim();
  if (!input) return null;
  if (!input.includes("/")) {
    return isValidRoomId(input) ? { roomId: input, queryParams: new URLSearchParams() } : null;
  }

  try {
    const base = window.location.origin;
    const url = new URL(input, base);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "sala" && parts[1] && isValidRoomId(parts[1])) {
      return { roomId: parts[1], queryParams: url.searchParams };
    }
    return null;
  } catch {
    return null;
  }
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [name, setName] = useState(localStorage.getItem(LAST_NAME_KEY) || "");
  const [authChecked, setAuthChecked] = useState(false);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [newSquadName, setNewSquadName] = useState("");
  const [activeSquadId, setActiveSquadId] = useState(getLastSquadId());
  const [roomInput, setRoomInput] = useState("");
  const [creatingSquad, setCreatingSquad] = useState(false);
  const [loadingSquads, setLoadingSquads] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [deletingSquadId, setDeletingSquadId] = useState("");
  const [squadToDelete, setSquadToDelete] = useState<Squad | null>(null);

  const canStart = useMemo(() => name.trim().length >= 2, [name]);
  const activeSquad = squads.find((s) => s.id === activeSquadId);
  const sessionId = useMemo(() => getOrCreateSessionId(), []);

  const persistIdentity = () => {
    localStorage.setItem(LAST_NAME_KEY, name.trim());
    if (activeSquadId) setLastSquadId(activeSquadId);
  };

  const goToRoom = (squad?: { id: string; name: string }, preferredRoomId?: string) => {
    const roomId = preferredRoomId || generateRoomId();
    const params = new URLSearchParams();
    if (squad) {
      params.set("squadId", squad.id);
      params.set("squadName", squad.name);
      bindSquadRoom(squad.id, roomId);
    }
    navigate(`/sala/${roomId}?${params.toString()}`);
  };

  useEffect(() => {
    const session = getAuthSession();
    debugLog("H1", "dashboard_auth_bootstrap_start", {
      hasSession: Boolean(session),
      hasToken: Boolean(session?.token),
    });
    if (!session) {
      debugLog("H1", "dashboard_auth_bootstrap_redirect_login", {});
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
        debugLog("H1", "dashboard_auth_bootstrap_me_ok", {
          userId: me.user.id,
          username: me.user.username,
        });
        const savedName = (localStorage.getItem(LAST_NAME_KEY) || "").trim();
        const preferredName = savedName || me.user.displayName;
        setName(preferredName);
        if (!savedName) {
          localStorage.setItem(LAST_NAME_KEY, me.user.displayName);
        }
      } catch {
        debugLog("H1", "dashboard_auth_bootstrap_me_failed", {});
        clearAuthSession();
        navigate("/login");
        return;
      } finally {
        setAuthChecked(true);
      }
    })();
  }, [navigate]);

  useEffect(() => {
    if (!authChecked) return;
    let unsubscribe: (() => void) | null = null;
    let active = true;
    setLoadingSquads(true);
    void subscribeSquads(
      (nextSquads) => {
        if (!active) return;
        debugLog("H2", "dashboard_squads_realtime_update", {
          squadsCount: nextSquads.length,
          hasActiveSquad: Boolean(activeSquadId && nextSquads.some((squad) => squad.id === activeSquadId)),
        });
        setSquads(nextSquads);
        setLoadingSquads(false);
      },
      () => {
        if (!active) return;
        toast.error("Falha ao sincronizar squads em tempo real.");
        setLoadingSquads(false);
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
  }, [activeSquadId, authChecked, sessionId]);

  const logout = async () => {
    await logoutFirebase();
    navigate("/login");
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Carregando usuário...
      </div>
    );
  }

  const createSquad = async () => {
    if (!canStart) {
      toast.error("Digite seu nome primeiro");
      return;
    }
    if (!newSquadName.trim()) {
      toast.error("Digite o nome da squad");
      return;
    }

    setCreatingSquad(true);
    try {
      const result = await apiCreateSquad({
        name: newSquadName.trim(),
        createdByName: name.trim(),
        ownerSessionId: sessionId,
      });
      const squad = result.squad;
      debugLog("H2", "dashboard_create_squad_ok", {
        squadId: squad.id,
        squadName: squad.name,
      });
      toast.success(`Squad criada! Convite: ${squad.invite_code}`);
      setNewSquadName("");
      setActiveSquadId(squad.id);
      localStorage.setItem(LAST_NAME_KEY, name.trim());
      setLastSquadId(squad.id);
      goToRoom({ id: squad.id, name: squad.name });
    } catch (error) {
      debugLog("H2", "dashboard_create_squad_failed", {
        error: error instanceof Error ? error.message : "unknown",
      });
      console.error(error);
      toast.error("Não foi possível criar a squad.");
    } finally {
      setCreatingSquad(false);
    }
  };

  const deleteSquad = async (squad: Squad) => {
    setDeletingSquadId(squad.id);
    try {
      await apiDeleteSquad(squad.id, sessionId);
      if (activeSquadId === squad.id) {
        setActiveSquadId("");
      }
      toast.success(`Squad "${squad.name}" apagada.`);
    } catch (error: any) {
      toast.error(getApiErrorMessage(error, "Falha ao apagar squad."));
    } finally {
      setDeletingSquadId("");
      setSquadToDelete(null);
    }
  };

  const goToActiveSquadRoom = () => {
    if (!canStart) {
      toast.error("Digite seu nome para continuar");
      return;
    }
    persistIdentity();
    if (!activeSquad) {
      toast.error("Selecione uma squad ativa para continuar.");
      return;
    }
    const roomId = resolveSquadRoomId(activeSquad.id);
    goToRoom({ id: activeSquad.id, name: activeSquad.name }, roomId);
  };

  const createQuickRoom = () => {
    if (!canStart) {
      toast.error("Digite seu nome para continuar");
      return;
    }
    persistIdentity();
    goToRoom();
  };

  const joinRoom = () => {
    if (!canStart) {
      toast.error("Digite seu nome para entrar na sala");
      return;
    }
    const parsedInput = parseRoomInput(roomInput);
    if (!parsedInput) {
      toast.error("Código ou link de sala inválido");
      return;
    }
    persistIdentity();
    const params = new URLSearchParams(parsedInput.queryParams);
    params.delete("name");
    params.delete("mod");
    if (activeSquad) {
      params.set("squadId", activeSquad.id);
      params.set("squadName", activeSquad.name);
    }
    navigate(`/sala/${parsedInput.roomId}?${params.toString()}`);
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 relative flex items-center justify-center">
          <button
            type="button"
            onClick={() => navigate("/")}
            aria-label="Voltar para a tela principal"
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            <img src={brandAssets.wordmarkDark} alt="CD2 Tech" className="h-8 hidden dark:block cursor-pointer" />
            <img src={brandAssets.wordmarkLight} alt="CD2 Tech" className="h-8 block dark:hidden cursor-pointer" />
          </button>
          <div className="absolute right-4">
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="outline" size="sm" onClick={logout} className="gap-1.5">
                <LogOut className="w-3.5 h-3.5" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      <aside
        className={`hidden md:block fixed left-0 top-0 h-screen pt-16 bg-card border-r border-border p-3 transition-all z-20 ${
          sidebarCollapsed ? "w-16" : "w-72"
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
              <div className="mt-3 space-y-2">
                <p className="text-xs text-muted-foreground">Escolha a squad sem se perder no fluxo.</p>
                <p className="text-xs text-muted-foreground">A lixeira aparece apenas para squads criadas por você.</p>
                {loadingSquads ? (
                  <p className="text-xs text-muted-foreground">Carregando squads...</p>
                ) : squads.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sem squads disponíveis.</p>
                ) : (
                  <div className="space-y-1.5 max-h-72 overflow-auto pr-1">
                    {squads.map((s) => (
                      <div
                        key={s.id}
                        className={`w-full rounded-md border px-2 py-1.5 text-sm transition-colors flex items-center gap-1 ${
                          s.id === activeSquadId
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border bg-secondary/30 hover:bg-secondary"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setActiveSquadId(s.id);
                            if (!canStart) {
                              toast.error("Digite seu nome para entrar na sala da squad");
                              return;
                            }
                            localStorage.setItem(LAST_NAME_KEY, name.trim());
                            setLastSquadId(s.id);
                            const roomId = resolveSquadRoomId(s.id);
                            goToRoom({ id: s.id, name: s.name }, roomId);
                          }}
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

      <main className={`${sidebarCollapsed ? "md:pl-20" : "md:pl-72"} px-4 py-6 sm:py-8 transition-all`}>
        <div className="max-w-4xl mx-auto space-y-6">
        <section className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-4">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold">Poker Planning interno</h1>
            <p className="text-sm text-muted-foreground">Escolha a squad ativa e entre na sala em um clique.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-1">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Seu nome</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Marco"
                className="bg-secondary border-border"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Sugestão inicial vem da conta, mas você pode editar para esta sessão.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {activeSquad ? (
              <Button onClick={goToActiveSquadRoom} className="w-full sm:w-auto gap-1.5 font-semibold">
                <Users className="w-4 h-4" />
                Entrar na sala da squad
              </Button>
            ) : (
              <Button onClick={createQuickRoom} className="w-full sm:w-auto gap-1.5 font-semibold">
                <Users className="w-4 h-4" />
                Criar sala rápida
              </Button>
            )}
          </div>
        </section>

        <section className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-4">
          <h2 className="text-sm font-medium">Gerenciar squads</h2>
          <p className="text-xs text-muted-foreground">Crie uma squad nova. Ao concluir, você entra direto na sala da squad.</p>

          <div className="grid gap-3 md:grid-cols-1">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Criar squad</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={newSquadName}
                  onChange={(e) => setNewSquadName(e.target.value)}
                  placeholder="Ex: Squad Backend"
                  className="bg-secondary border-border"
                />
                <Button onClick={createSquad} disabled={creatingSquad} className="w-full sm:w-auto gap-1.5">
                  <Plus className="w-4 h-4" />
                  {creatingSquad ? "Criando..." : "Criar"}
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-3">
          <div className="space-y-1">
            <h2 className="text-sm font-medium">Entrar por link ou código de sala</h2>
            <p className="text-xs text-muted-foreground">Cole o link completo ou só o código curto da sala (ex: ab12cd).</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value)}
              placeholder="Ex: ab12cd ou https://.../sala/ab12cd"
              className="bg-secondary border-border flex-1"
              onKeyDown={(e) => e.key === "Enter" && joinRoom()}
            />
            <Button variant="outline" onClick={joinRoom} className="w-full sm:w-auto gap-1.5">
              <Link2 className="w-4 h-4" />
              Entrar na sala
            </Button>
          </div>
        </section>
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
