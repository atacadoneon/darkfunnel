import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppTopbar } from "@/components/layout/AppTopbar";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { usePresenceHeartbeat } from "@/hooks/usePresenceHeartbeat";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";

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

const HOVER_OPEN_DELAY_MS = 2000;
const RAIL_HOVER_ZONE_PX = 56;
const EXPANDED_ZONE_PX = 260;

export default function AppLayout() {
  const { current, workspaces, loading } = useWorkspace();
  const { data: isPlatformAdmin } = usePlatformAdmin();
  const location = useLocation();
  usePresenceHeartbeat();

  // INICIA EM FALSE = rail colapsado. Só abre via hover delay controlado abaixo.
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const openTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const clearTimer = useCallback(() => {
    if (openTimer.current) {
      clearTimeout(openTimer.current);
      openTimer.current = null;
    }
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const x = e.clientX;
      const zone = openRef.current ? EXPANDED_ZONE_PX : RAIL_HOVER_ZONE_PX;
      const inside = x <= zone;

      if (inside) {
        if (!openRef.current && !openTimer.current) {
          openTimer.current = setTimeout(() => {
            openTimer.current = null;
            setOpen(true);
          }, HOVER_OPEN_DELAY_MS);
        }
      } else {
        clearTimer();
        if (openRef.current) setOpen(false);
      }
    };
    const onLeave = () => {
      clearTimer();
      if (openRef.current) setOpen(false);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      clearTimer();
    };
  }, [clearTimer]);

  if (loading) {
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

  if (!isPlatformAdmin) {
    const onCompanyRoute = location.pathname.startsWith("/company-register");
    if (!current.onboarding_completed_at && !onCompanyRoute) {
      return <Navigate to="/company-register" replace />;
    }
    if (current.onboarding_completed_at && !current.setup_completed_at && !onCompanyRoute) {
      return <Navigate to="/company-register/setup" replace />;
    }
  }

  return (
    <SidebarProvider open={open} onOpenChange={setOpen} defaultOpen={false}>
      <div className="flex h-svh w-full overflow-hidden rail-mode">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <AppTopbar />
          <main className="flex-1 min-h-0 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
