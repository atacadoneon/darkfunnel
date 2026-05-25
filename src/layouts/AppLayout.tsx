import { Outlet, Navigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppTopbar } from "@/components/layout/AppTopbar";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

function CreateWorkspacePrompt() {
  const { createWorkspace } = useWorkspace();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await createWorkspace(name.trim());
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-sm p-6 space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Criar conta</h1>
          <p className="text-sm text-muted-foreground">Você ainda não pertence a nenhuma conta.</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Minha Empresa" />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Criando..." : "Criar"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

const PIN_KEY = "sidebar:pinned";

export default function AppLayout() {
  const { current, workspaces, loading } = useWorkspace();
  const [pinned, setPinned] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(PIN_KEY) === "1";
  });
  const [open, setOpen] = useState<boolean>(pinned);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    window.localStorage.setItem(PIN_KEY, pinned ? "1" : "0");
    if (pinned) setOpen(true);
  }, [pinned]);

  const handleEnter = () => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(true);
  };
  const handleLeave = () => {
    if (pinned) return;
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 200);
  };

  if (loading) {
    // App shell instantâneo: render skeleton instead of blocking
    return (
      <div className="flex h-svh w-full">
        <div className="w-14 border-r bg-sidebar" />
        <div className="flex-1 flex flex-col">
          <div className="h-12 border-b" />
          <div className="flex-1 animate-pulse bg-muted/20" />
        </div>
      </div>
    );
  }
  if (workspaces.length === 0) return <CreateWorkspacePrompt />;
  if (!current) return <Navigate to="/dashboard" replace />;

  return (
    <SidebarProvider open={open} onOpenChange={setOpen} defaultOpen={pinned}>
      <div className={`flex h-svh w-full overflow-hidden ${pinned ? "" : "rail-mode"}`}>
        <div onMouseEnter={handleEnter} onMouseLeave={handleLeave} className="contents">
          <AppSidebar pinned={pinned} onTogglePin={() => setPinned((p) => !p)} />
        </div>
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <AppTopbar />
          <main className="flex-1 min-h-0 overflow-hidden">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
