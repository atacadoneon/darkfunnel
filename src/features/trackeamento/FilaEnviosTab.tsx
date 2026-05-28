import { useMemo } from "react";
import { useTrackingQueue, useReprocessFailed } from "@/hooks/useTrackingQueue";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { RotateCw } from "lucide-react";
import { useIsManagerOrAdmin } from "@/features/workspace/permissions";

const fmtBRL = (cents: number | null) =>
  cents == null ? "—" : (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function statusBadge(s: string) {
  if (s === "sent") return <Badge className="bg-emerald-600 hover:bg-emerald-700">Enviado</Badge>;
  if (s === "failed") return <Badge variant="destructive">Falhou</Badge>;
  return <Badge variant="secondary">Pendente</Badge>;
}

function providerBadge(p: string) {
  const v = p?.toLowerCase();
  if (v === "meta") return <Badge className="bg-blue-600 hover:bg-blue-700">Meta</Badge>;
  if (v === "google") return <Badge className="bg-emerald-600 hover:bg-emerald-700">Google</Badge>;
  return <Badge variant="secondary">{p}</Badge>;
}

export function FilaEnviosTab({ periodStart }: { periodStart: Date }) {
  const { data = [], isLoading } = useTrackingQueue(periodStart);
  const reprocess = useReprocessFailed();
  const canManage = useIsManagerOrAdmin();

  const kpis = useMemo(() => {
    const pending = data.filter((d) => d.status === "pending").length;
    const sent = data.filter((d) => d.status === "sent" && d.sent_at && new Date(d.sent_at) >= periodStart).length;
    const failed = data.filter((d) => d.status === "failed" && new Date(d.created_at) >= periodStart).length;
    const taxa = sent + failed > 0 ? (sent / (sent + failed)) * 100 : 0;
    return { pending, sent, failed, taxa };
  }, [data, periodStart]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total na fila</p>
          <p className="text-2xl font-bold">{kpis.pending}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Enviados no período</p>
          <p className="text-2xl font-bold text-emerald-600">{kpis.sent}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Falhas no período</p>
          <p className="text-2xl font-bold text-destructive">{kpis.failed}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Taxa de sucesso</p>
          <p className="text-2xl font-bold">{kpis.taxa.toFixed(1)}%</p>
        </Card>
      </div>

      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => reprocess.mutate()} disabled={reprocess.isPending}>
            <RotateCw className="h-4 w-4 mr-1" /> Reprocessar falhas
          </Button>
        </div>
      )}

      <Card className="overflow-hidden">
        <TooltipProvider>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Tentativas</TableHead>
                <TableHead>Erro</TableHead>
                <TableHead>Agendado</TableHead>
                <TableHead>Enviado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : data.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Fila vazia.</TableCell></TableRow>
              ) : data.map((q) => (
                <TableRow key={q.id}>
                  <TableCell>{providerBadge(q.provider)}</TableCell>
                  <TableCell className="font-medium">{q.event_name ?? "—"}</TableCell>
                  <TableCell className="text-right">{fmtBRL(q.value_cents)}</TableCell>
                  <TableCell>{statusBadge(q.status)}</TableCell>
                  <TableCell className="text-right">{q.attempts}</TableCell>
                  <TableCell className="max-w-[200px]">
                    {q.last_error ? (
                      <Tooltip>
                        <TooltipTrigger className="text-xs text-destructive truncate block max-w-[200px] text-left">
                          {q.last_error}
                        </TooltipTrigger>
                        <TooltipContent className="max-w-md"><p className="text-xs">{q.last_error}</p></TooltipContent>
                      </Tooltip>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{q.scheduled_for ? new Date(q.scheduled_for).toLocaleString("pt-BR") : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{q.sent_at ? new Date(q.sent_at).toLocaleString("pt-BR") : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TooltipProvider>
      </Card>
    </div>
  );
}
