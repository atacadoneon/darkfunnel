import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useInboundEndpoints, useUpdateInboundEndpoint, useRotateInboundSecret } from "@/hooks/useInboundEndpoints";
import { useIsManagerOrAdmin, useMyRole } from "@/features/workspace/permissions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Copy, FileText, RotateCw, Power } from "lucide-react";
import { toast } from "sonner";
import { EndpointDialog } from "@/features/inbound-webhooks/EndpointDialog";
import { EndpointLogsDrawer } from "@/features/inbound-webhooks/EndpointLogsDrawer";

const BASE_URL = "https://sbyslxhjjfcqlxaehidw.supabase.co/functions/v1/inbound-webhook";

export default function InboundWebhooksPage() {
  const canManage = useIsManagerOrAdmin();
  const role = useMyRole();
  const { data = [], isLoading } = useInboundEndpoints();
  const update = useUpdateInboundEndpoint();
  const rotate = useRotateInboundSecret();
  const [createOpen, setCreateOpen] = useState(false);
  const [logsFor, setLogsFor] = useState<string | null>(null);

  if (role.isLoading || !role.isFetched) {
    return <div className="p-8 text-sm text-muted-foreground">Carregando...</div>;
  }
  if (!canManage) return <Navigate to="/dashboard" replace />;

  const copyUrl = (slug: string) => {
    navigator.clipboard.writeText(`${BASE_URL}/${slug}`);
    toast.success("URL copiada");
  };

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Webhooks de entrada</h1>
          <p className="text-sm text-muted-foreground">Receba leads de fontes externas (formulários, integrações).</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo endpoint
        </Button>
      </header>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Deal?</TableHead>
              <TableHead className="text-right">Recebidos</TableHead>
              <TableHead className="text-right">OK / Erro</TableHead>
              <TableHead>Último</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : data.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum endpoint criado.</TableCell></TableRow>
            ) : data.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-medium">{e.name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="cursor-pointer gap-1" onClick={() => copyUrl(e.slug)}>
                    /{e.slug} <Copy className="h-3 w-3" />
                  </Badge>
                </TableCell>
                <TableCell>{e.create_deal ? <Badge>Sim</Badge> : <Badge variant="secondary">Não</Badge>}</TableCell>
                <TableCell className="text-right">{e.total_received}</TableCell>
                <TableCell className="text-right text-xs">
                  <span className="text-emerald-600">{e.total_success}</span> / <span className="text-destructive">{e.total_failed}</span>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {e.last_received_at ? new Date(e.last_received_at).toLocaleString("pt-BR") : "—"}
                </TableCell>
                <TableCell>
                  {e.active ? <Badge className="bg-emerald-600">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="Logs" onClick={() => setLogsFor(e.id)}>
                    <FileText className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="Rotacionar secret"
                    onClick={async () => {
                      if (!confirm("Rotacionar o secret?")) return;
                      const r: any = await rotate.mutateAsync(e.id);
                      toast.success(`Novo secret: ${r?.secret ?? r}`);
                    }}>
                    <RotateCw className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" title={e.active ? "Desativar" : "Reativar"}
                    onClick={() => update.mutate({ id: e.id, patch: { active: !e.active } })}>
                    <Power className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <EndpointDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <EndpointLogsDrawer endpointId={logsFor} onClose={() => setLogsFor(null)} />
    </div>
  );
}
