import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Copy, Link2, PanelLeftClose, PanelLeftOpen, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { DeleteSquadDialog } from "@/components/delete-squad-dialog";
import { brandAssets } from "@/lib/branding";
import { apiCreateSquad, apiDeleteSquad, apiJoinSquad, apiListSquads, apiListSquadsForSession } from "@/lib/api";
import { bindSquadRoom, getLastSquadId, resolveSquadRoomId, setLastSquadId } from "@/lib/squad-room";
import { getOrCreateSessionId } from "@/lib/session";

const LAST_NAME_KEY = "poker-display-name";
const generateRoomId = () => Math.random().toString(36).substring(2, 8);
type Squad = Awaited<ReturnType<typeof apiListSquads>>["squads"][number];

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

function extractRoomId(value: string): string | null {
  const input = value.trim();
  if (!input) return null;
  if (!input.includes("/")) return input;
  try {
    const url = new URL(input);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "sala" && parts[1]) return parts[1];
    return null;
  } catch {
    return null;
  }
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [name, setName] = useState(localStorage.getItem(LAST_NAME_KEY) || "");
  const [squads, setSquads] = useState<Squad[]>([]);
  const [newSquadName, setNewSquadName] = useState("");
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [activeSquadId, setActiveSquadId] = useState(getLastSquadId());
  const [roomInput, setRoomInput] = useState("");
  const [creatingSquad, setCreatingSquad] = useState(false);
  const [joiningInvite, setJoiningInvite] = useState(false);
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
    const params = new URLSearchParams({
      mod: "1",
      name: name.trim(),
    });
    if (squad) {
      params.set("squadId", squad.id);
      params.set("squadName", squad.name);
      bindSquadRoom(squad.id, roomId);
    }
    navigate(`/sala/${roomId}?${params.toString()}`);
  };

  const fetchSquads = async () => {
    try {
      setLoadingSquads(true);
      const result = await apiListSquadsForSession(sessionId);
      setSquads(result.squads);
    } catch (error) {
      console.error(error);
      toast.error("Falha ao carregar squads. Tente novamente.");
    } finally {
      setLoadingSquads(false);
    }
  };

  useEffect(() => {
    void fetchSquads();
  }, [sessionId]);

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
      toast.success(`Squad criada! Convite: ${squad.invite_code}`);
      setNewSquadName("");
      setActiveSquadId(squad.id);
      localStorage.setItem(LAST_NAME_KEY, name.trim());
      setLastSquadId(squad.id);
      await fetchSquads();
      goToRoom({ id: squad.id, name: squad.name });
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível criar a squad.");
    } finally {
      setCreatingSquad(false);
    }
  };

  const joinSquadByInvite = async () => {
    if (!canStart) {
      toast.error("Digite seu nome primeiro");
      return;
    }
    if (!inviteCodeInput.trim()) {
      toast.error("Digite o código de convite");
      return;
    }

    setJoiningInvite(true);
    try {
      const result = await apiJoinSquad({
        inviteCode: inviteCodeInput.trim().toUpperCase(),
        userName: name.trim(),
      });
      const squad = result.squad;
      setInviteCodeInput("");
      setActiveSquadId(squad.id);
      localStorage.setItem(LAST_NAME_KEY, name.trim());
      setLastSquadId(squad.id);
      await fetchSquads();
      const roomId = resolveSquadRoomId(squad.id);
      toast.success(`Você entrou na squad ${squad.name}. Abrindo sala...`);
      goToRoom({ id: squad.id, name: squad.name }, roomId);
    } catch (error: any) {
      console.error(error);
      const message = String(error?.message || "");
      toast.error(message.includes("convite inválido") ? "Convite inválido" : "Não foi possível entrar na squad.");
    } finally {
      setJoiningInvite(false);
    }
  };

  const deleteSquad = async (squad: Squad) => {
    setDeletingSquadId(squad.id);
    try {
      await apiDeleteSquad(squad.id, sessionId);
      if (activeSquadId === squad.id) {
        setActiveSquadId("");
      }
      await fetchSquads();
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
    const roomId = extractRoomId(roomInput);
    if (!roomId) {
      toast.error("Código ou link de sala inválido");
      return;
    }
    persistIdentity();
    const params = new URLSearchParams({ name: name.trim() });
    if (activeSquad) {
      params.set("squadId", activeSquad.id);
      params.set("squadName", activeSquad.name);
    }
    navigate(`/sala/${roomId}?${params.toString()}`);
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
            <ThemeToggle />
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
                {activeSquad && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2 gap-1.5"
                    onClick={() => {
                      navigator.clipboard.writeText(activeSquad.invite_code);
                      toast.success("Convite copiado");
                    }}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copiar convite
                  </Button>
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
            <Button variant="outline" onClick={joinRoom} className="w-full sm:w-auto gap-1.5">
              <Link2 className="w-4 h-4" />
              Entrar por link/código
            </Button>
          </div>
        </section>

        <section className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-4">
          <h2 className="text-sm font-medium">Gerenciar squads</h2>
          <p className="text-xs text-muted-foreground">
            Crie uma squad nova ou entre por convite. Ao concluir, você entra direto na sala da squad.
          </p>

          <div className="grid gap-3 md:grid-cols-2">
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

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Entrar por convite</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={inviteCodeInput}
                  onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                  placeholder="Código da squad (ex: AB12CD)"
                  className="bg-secondary border-border"
                />
                <Button variant="outline" onClick={joinSquadByInvite} disabled={joiningInvite} className="w-full sm:w-auto">
                  {joiningInvite ? "Entrando..." : "Entrar"}
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-3">
          <h2 className="text-sm font-medium">Acesso direto por link/código</h2>
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
              Entrar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <ArrowRight className="w-3.5 h-3.5" />
            Seu nome e sua squad ativa ficam salvos neste navegador.
          </p>
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
