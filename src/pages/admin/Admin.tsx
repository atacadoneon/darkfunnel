import { Navigate } from "react-router-dom";
import { format } from "date-fns";
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
import { useInfinitePaginated, flattenPages } from "@/components/lists/useInfinitePaginated";
import { LoadMoreSentinel } from "@/components/lists/LoadMoreSentinel";
import { ListFooter } from "@/components/lists/ListFooter";

type WorkspaceRow = { id: string; name: string; plan: string | null; created_at: string };

export default function Admin() {
  const { data: isAdmin, isLoading } = usePlatformAdmin();

  const workspaces = useInfinitePaginated<WorkspaceRow>({
    queryKey: ["admin-workspaces-infinite"],
    table: "workspaces",
    select: "id,name,plan,created_at",
    order: { col: "created_at", asc: false },
    pageSize: 100,
    enabled: !!isAdmin,
  });
  const usage = useInfinitePaginated<Record<string, unknown>>({
    queryKey: ["admin-usage-infinite"],
    table: "workspace_usage_daily",
    select: "*",
    order: { col: "day", asc: false },
    pageSize: 100,
    enabled: !!isAdmin,
  });
  const audit = useInfinitePaginated<Record<string, unknown>>({
    queryKey: ["admin-audit-infinite"],
    table: "audit_logs",
    select: "*",
    order: { col: "created_at", asc: false },
    pageSize: 100,
    enabled: !!isAdmin,
  });
  const flags = useInfinitePaginated<Record<string, unknown>>({
    queryKey: ["admin-flags-infinite"],
    table: "feature_flag_overrides",
    select: "*",
    order: { col: "created_at", asc: false },
    pageSize: 100,
    enabled: !!isAdmin,
  });

  const ws = flattenPages<WorkspaceRow>(workspaces.data as any);
  const us = flattenPages<Record<string, unknown>>(usage.data as any);
  const ad = flattenPages<Record<string, unknown>>(audit.data as any);
  const fl = flattenPages<Record<string, unknown>>(flags.data as any);

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
                {ws.items.map((w) => (
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
            <LoadMoreSentinel
              hasMore={!!workspaces.hasNextPage}
              isFetching={workspaces.isFetchingNextPage}
              onIntersect={() => workspaces.fetchNextPage()}
            />
          </Card>
          <ListFooter loaded={ws.loaded} total={ws.total} hasMore={!!workspaces.hasNextPage} singular="workspace exibido" plural="workspaces exibidos" />
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
                {us.items.map((r, i) => (
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
                {us.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                      Sem dados de uso.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <LoadMoreSentinel
              hasMore={!!usage.hasNextPage}
              isFetching={usage.isFetchingNextPage}
              onIntersect={() => usage.fetchNextPage()}
            />
          </Card>
          <ListFooter loaded={us.loaded} total={us.total} hasMore={!!usage.hasNextPage} singular="registro exibido" plural="registros exibidos" />
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
                {ad.items.map((r, i) => (
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
                {ad.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">
                      Sem registros.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <LoadMoreSentinel
              hasMore={!!audit.hasNextPage}
              isFetching={audit.isFetchingNextPage}
              onIntersect={() => audit.fetchNextPage()}
            />
          </Card>
          <ListFooter loaded={ad.loaded} total={ad.total} hasMore={!!audit.hasNextPage} singular="log exibido" plural="logs exibidos" />
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
                {fl.items.map((r, i) => (
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
                {fl.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">
                      Sem overrides.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <LoadMoreSentinel
              hasMore={!!flags.hasNextPage}
              isFetching={flags.isFetchingNextPage}
              onIntersect={() => flags.fetchNextPage()}
            />
          </Card>
          <ListFooter loaded={fl.loaded} total={fl.total} hasMore={!!flags.hasNextPage} singular="override exibido" plural="overrides exibidos" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
