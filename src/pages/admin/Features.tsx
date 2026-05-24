import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Loader2, Shield } from "lucide-react";
import { toast } from "sonner";
import { isFeatureEnabled } from "@/lib/workspace-features";

type WS = { id: string; name: string; features: Record<string, any> | null };

export default function AdminFeatures() {
  const { data: isAdmin, isLoading: checkingAdmin } = usePlatformAdmin();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const { data: workspaces = [], isLoading } = useQuery({
    queryKey: ["admin-workspaces"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("id, name, features")
        .order("name");
      if (error) throw error;
      return (data ?? []) as WS[];
    },
  });

  const filtered = useMemo(
    () => workspaces.filter((w) => w.name.toLowerCase().includes(filter.toLowerCase())),
    [workspaces, filter],
  );

  const toggle = async (ws: WS, feature: string, enabled: boolean) => {
    setPending((p) => ({ ...p, [ws.id + feature]: true }));
    try {
      const { data, error } = await supabase.functions.invoke("admin-toggle-feature", {
        body: { workspace_id: ws.id, feature, enabled },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Feature ${enabled ? "ativada" : "desativada"} para ${ws.name}`);
      qc.invalidateQueries({ queryKey: ["admin-workspaces"] });
      qc.invalidateQueries({ queryKey: ["workspaces"] });
      qc.invalidateQueries({ queryKey: ["is_platform_admin"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending((p) => ({ ...p, [ws.id + feature]: false }));
    }
  };

  if (checkingAdmin) {
    return <div className="p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 inline mr-2 animate-spin" /> Verificando permissões…</div>;
  }
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-semibold">Admin · Features por Workspace</h1>
          <p className="text-sm text-muted-foreground">Ative ou desative recursos para cada cliente do DarkFunnel.</p>
        </div>
      </div>

      <Input
        placeholder="Filtrar por nome do workspace…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="max-w-sm"
      />

      <Card className="overflow-hidden">
        <div className="grid grid-cols-[1fr_auto] gap-4 px-4 py-3 border-b bg-muted/40 text-xs font-medium uppercase text-muted-foreground">
          <div>Workspace</div>
          <div>Import Histórico</div>
        </div>
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 inline mr-2 animate-spin" /> Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">Nenhum workspace encontrado.</div>
        ) : (
          filtered.map((ws) => {
            const on = isFeatureEnabled(ws.features, "import_history");
            const key = ws.id + "import_history";
            return (
              <div key={ws.id} className="grid grid-cols-[1fr_auto] gap-4 px-4 py-3 border-b last:border-0 items-center">
                <div>
                  <div className="font-medium">{ws.name}</div>
                  <div className="text-xs text-muted-foreground">{ws.id}</div>
                </div>
                <Switch checked={on} disabled={!!pending[key]} onCheckedChange={(v) => toggle(ws, "import_history", v)} />
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
