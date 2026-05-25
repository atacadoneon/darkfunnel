import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";

function useWorkspacesAll() {
  return useQuery({
    queryKey: ["admin-workspaces"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces" as never)
        .select("id,name,plan,created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as { id: string; name: string; plan: string | null; created_at: string }[];
    },
  });
}

function useUsage() {
  return useQuery({
    queryKey: ["admin-usage"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_usage_daily" as never)
        .select("*")
        .order("day", { ascending: false })
        .limit(100);
      if (error) return [];
      return data as Record<string, unknown>[];
    },
  });
}

function useAuditLogs() {
  return useQuery({
    queryKey: ["admin-audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) return [];
      return data as Record<string, unknown>[];
    },
  });
}

function useFlagOverrides() {
  return useQuery({
    queryKey: ["admin-flags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feature_flag_overrides" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) return [];
      return data as Record<string, unknown>[];
    },
  });
}

export default function Admin() {
  const { data: isAdmin, isLoading } = usePlatformAdmin();
  const workspaces = useWorkspacesAll();
  const usage = useUsage();
  const audit = useAuditLogs();
  const flags = useFlagOverrides();

  if (isLoading)
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="p-6 space-y-4 h-full overflow-y-auto">
      <div>
        <h1 className="text-xl font-semibold">Admin Plataforma</h1>
        <p className="text-sm text-muted-foreground">Visão cross-workspace.</p>
      </div>
      <Tabs defaultValue="workspaces">
        <TabsList>
          <TabsTrigger value="workspaces">Workspaces</TabsTrigger>
          <TabsTrigger value="usage">Uso</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
          <TabsTrigger value="flags">Feature Flags</TabsTrigger>
        </TabsList>

        <TabsContent value="workspaces">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Criado</TableHead>
                  <TableHead>ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(workspaces.data ?? []).map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">{w.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{w.plan ?? "free"}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(w.created_at), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="text-xs font-mono opacity-60">{w.id.slice(0, 8)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="usage">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dia</TableHead>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Mensagens</TableHead>
                  <TableHead>Deals</TableHead>
                  <TableHead>Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(usage.data ?? []).map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{String(r.day ?? "")}</TableCell>
                    <TableCell className="text-xs font-mono opacity-60">
                      {String(r.workspace_id ?? "").slice(0, 8)}
                    </TableCell>
                    <TableCell>{String(r.messages_count ?? r.messages ?? 0)}</TableCell>
                    <TableCell>{String(r.deals_count ?? r.deals ?? 0)}</TableCell>
                    <TableCell>{String(r.revenue_cents ?? r.revenue ?? 0)}</TableCell>
                  </TableRow>
                ))}
                {(usage.data ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                      Sem dados de uso.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Recurso</TableHead>
                  <TableHead>Usuário</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(audit.data ?? []).map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs">
                      {r.created_at
                        ? format(new Date(String(r.created_at)), "dd/MM HH:mm")
                        : "—"}
                    </TableCell>
                    <TableCell className="font-medium text-sm">{String(r.action ?? "")}</TableCell>
                    <TableCell className="text-xs">{String(r.resource_type ?? "")}</TableCell>
                    <TableCell className="text-xs font-mono opacity-60">
                      {String(r.user_id ?? "").slice(0, 8)}
                    </TableCell>
                  </TableRow>
                ))}
                {(audit.data ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">
                      Sem registros.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="flags">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Flag</TableHead>
                  <TableHead>Habilitada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(flags.data ?? []).map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs font-mono opacity-60">
                      {String(r.workspace_id ?? "").slice(0, 8)}
                    </TableCell>
                    <TableCell className="font-medium text-sm">{String(r.feature_key ?? "")}</TableCell>
                    <TableCell>
                      <Badge variant={r.enabled ? "default" : "secondary"}>
                        {r.enabled ? "ON" : "OFF"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {(flags.data ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">
                      Sem overrides.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
