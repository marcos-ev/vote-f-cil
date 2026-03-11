import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="outline"
      size="sm"
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="gap-1.5 text-xs"
      aria-label="Alternar tema"
    >
      {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
      <span className="hidden sm:inline">{isDark ? "Claro" : "Escuro"}</span>
    </Button>
  );
}
