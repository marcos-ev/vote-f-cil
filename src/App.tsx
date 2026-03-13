import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrandingHead } from "@/components/branding-head";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import Room from "./pages/Room";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function debugLog(hypothesisId: string, message: string, data: Record<string, unknown>) {
  const payload = {
    sessionId: "df5e7d",
    runId: "pre-fix-review",
    hypothesisId,
    location: "src/App.tsx",
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
  }).catch(() => {});
  // #endregion
}

const App = () => {
  useEffect(() => {
    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      const text = args.map((arg) => String(arg)).join(" ");
      if (text.includes("change in the order of Hooks called by Room")) {
        debugLog("H5", "react_hook_order_warning_room", {
          excerpt: text.slice(0, 300),
        });
      }
      if (text.includes("Rendered more hooks than during the previous render")) {
        debugLog("H5", "react_rendered_more_hooks_warning", {
          excerpt: text.slice(0, 300),
        });
      }
      originalConsoleError(...args);
    };

    const onError = (event: ErrorEvent) => {
      const message = String(event.message || "");
      if (message) {
        debugLog("H5", "window_error_event", { message: message.slice(0, 300) });
      }
    };

    window.addEventListener("error", onError);
    return () => {
      console.error = originalConsoleError;
      window.removeEventListener("error", onError);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrandingHead />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Auth />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<Dashboard />} />
            <Route path="/sala/:roomId" element={<Room />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
