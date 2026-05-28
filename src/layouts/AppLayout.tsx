import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
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

export default function AppLayout() {
  const { current, workspaces, loading } = useWorkspace();
  const { data: isPlatformAdmin } = usePlatformAdmin();
  const location = useLocation();
  usePresenceHeartbeat();
  const [open, setOpen] = useState(false);
  const openTimer = useRef<NodeJS.Timeout | null>(null);
  const allowOpenRef = useRef(false);
  const isInRailRef = useRef(false);

  const clearOpenTimer = () => {
    if (openTimer.current) {
      clearTimeout(openTimer.current);
      openTimer.current = null;
    }
  };

  const closeNow = () => {
    clearOpenTimer();
    setOpen(false);
  };

  // Bloqueia qualquer abertura que não venha do nosso timer de hover
  const handleOpenChange = (next: boolean) => {
    if (next && !allowOpenRef.current) return;
    setOpen(next);
  };

  // Detecta hover na faixa da rail (≤56px da borda esquerda) via mousemove global
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const inRail = e.clientX <= RAIL_HOVER_ZONE_PX || (open && e.clientX <= 260);
      if (inRail && !isInRailRef.current) {
        isInRailRef.current = true;
        if (!open && !openTimer.current) {
          openTimer.current = setTimeout(() => {
            openTimer.current = null;
            allowOpenRef.current = true;
            setOpen(true);
            allowOpenRef.current = false;
          }, HOVER_OPEN_DELAY_MS);
        }
      } else if (!inRail && isInRailRef.current) {
        isInRailRef.current = false;
        closeNow();
      }
    };
    const onLeaveWindow = () => {
      isInRailRef.current = false;
      closeNow();
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeaveWindow);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeaveWindow);
      clearOpenTimer();
    };
  }, [open]);

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

  // Onboarding gating (admins de plataforma escapam)
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
    <SidebarProvider open={open} onOpenChange={handleOpenChange} defaultOpen={false}>
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


