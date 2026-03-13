import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { brandAssets } from "@/lib/branding";
import { loginWithFirebase, registerWithFirebase } from "@/lib/firebase-auth";
import { getOrCreateSessionId } from "@/lib/session";

function getErrorMessage(error: unknown, fallback: string) {
  const raw = error instanceof Error ? String(error.message || "").trim() : "";
  return raw || fallback;
}

export default function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => {
    if (loading) return false;
    if (username.trim().length < 3 || password.length < 4) return false;
    if (mode === "register" && displayName.trim().length < 2) return false;
    return true;
  }, [displayName, loading, mode, password, username]);

  const submit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const normalizedUsername = username.trim().toLowerCase();
      const result =
        mode === "register"
          ? await registerWithFirebase({ username: normalizedUsername, displayName: displayName.trim(), password })
          : await loginWithFirebase({ username: normalizedUsername, password });
      localStorage.setItem("poker-display-name", result.user.displayName);
      getOrCreateSessionId();
      toast.success(mode === "register" ? "Cadastro realizado!" : "Login efetuado!");
      navigate("/");
    } catch (error) {
      toast.error(getErrorMessage(error, mode === "register" ? "Falha no cadastro" : "Falha no login"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 relative flex items-center justify-center">
          <button
            type="button"
            onClick={() => navigate("/")}
            aria-label="Ir para o app"
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
      <main className="px-4 py-8">
        <div className="max-w-md mx-auto bg-card rounded-xl border border-border p-6 space-y-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold">{mode === "register" ? "Cadastro" : "Login"}</h1>
            <p className="text-sm text-muted-foreground">
              {mode === "register"
                ? "Crie seu usuário para salvar seu retorno no banco."
                : "Entre com seu usuário para continuar no planning poker."}
            </p>
          </div>

          {mode === "register" && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">Nome para exibição</label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ex: Marco"
                className="bg-secondary border-border"
              />
            </div>
          )}

          <div>
            <label className="text-sm font-medium mb-1.5 block">Usuário</label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ex: marco"
              className="bg-secondary border-border"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Senha</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sua senha"
              className="bg-secondary border-border"
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>

          <Button onClick={submit} disabled={!canSubmit} className="w-full font-semibold">
            {loading ? "Processando..." : mode === "register" ? "Criar conta" : "Entrar"}
          </Button>

          <Button
            variant="ghost"
            className="w-full"
            onClick={() => {
              setMode((v) => (v === "login" ? "register" : "login"));
              setPassword("");
            }}
          >
            {mode === "login" ? "Não tem conta? Cadastre-se" : "Já tem conta? Fazer login"}
          </Button>
        </div>
      </main>
    </div>
  );
}
