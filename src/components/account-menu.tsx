import { useMemo, useState } from "react";
import { LogOut, Save, UserCircle2 } from "lucide-react";
import { toast } from "sonner";
import { getAuthSession } from "@/lib/auth-session";
import { updateFirebaseDisplayName } from "@/lib/firebase-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

type AccountSquad = {
  id: string;
  name: string;
};

type AccountMenuProps = {
  squads: AccountSquad[];
  onLogout: () => Promise<void> | void;
  onDisplayNameUpdated?: (displayName: string) => void;
};

function getErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message.trim() : "";
  return message || fallback;
}

export function AccountMenu({ squads, onLogout, onDisplayNameUpdated }: AccountMenuProps) {
  const session = useMemo(() => getAuthSession(), []);
  const [savingName, setSavingName] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState(session?.user.displayName || "");
  const [loggingOut, setLoggingOut] = useState(false);

  const initials = useMemo(() => {
    const base = (displayNameInput || session?.user.displayName || session?.user.username || "U").trim();
    const parts = base.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "U";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }, [displayNameInput, session?.user.displayName, session?.user.username]);

  const saveDisplayName = async () => {
    if (savingName) return;
    const nextName = displayNameInput.trim();
    if (nextName.length < 2) {
      toast.error("Informe um nome com pelo menos 2 caracteres.");
      return;
    }
    setSavingName(true);
    try {
      const nextSession = await updateFirebaseDisplayName(nextName);
      localStorage.setItem("poker-display-name", nextName);
      setDisplayNameInput(nextSession.user.displayName);
      onDisplayNameUpdated?.(nextSession.user.displayName);
      toast.success("Nome atualizado com sucesso.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Falha ao atualizar nome."));
    } finally {
      setSavingName(false);
    }
  };

  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await onLogout();
    } catch (error) {
      toast.error(getErrorMessage(error, "Falha ao sair da conta."));
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Abrir menu da conta"
          className="rounded-full border border-border/70 p-0.5 transition-colors hover:bg-accent/40"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={session?.user.photoURL || ""} alt={session?.user.displayName || "Conta"} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 space-y-1 p-2">
        <DropdownMenuLabel className="font-medium">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <UserCircle2 className="h-4 w-4" />
              Conta
            </div>
            {session?.user.email && <p className="text-xs font-normal text-muted-foreground">{session.user.email}</p>}
          </div>
        </DropdownMenuLabel>
        <div className="rounded-md border border-border p-2 space-y-2">
          <p className="text-xs text-muted-foreground">Nome padrão para entrar nas salas</p>
          <div className="flex items-center gap-2">
            <Input
              value={displayNameInput}
              onChange={(event) => setDisplayNameInput(event.target.value)}
              className="h-9 bg-secondary border-border"
              placeholder="Seu nome"
            />
            <Button size="sm" onClick={saveDisplayName} disabled={savingName} className="gap-1.5">
              <Save className="h-3.5 w-3.5" />
              {savingName ? "Salvando" : "Salvar"}
            </Button>
          </div>
        </div>
        <div className="rounded-md border border-border p-2">
          <p className="text-xs text-muted-foreground mb-1">Squads que você já participou</p>
          {squads.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem squads registradas.</p>
          ) : (
            <div className="max-h-36 overflow-auto space-y-1 pr-1">
              {squads.map((squad) => (
                <p key={squad.id} className="text-sm">
                  {squad.name}
                </p>
              ))}
            </div>
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="gap-2 text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4" />
          {loggingOut ? "Saindo..." : "Sair"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
