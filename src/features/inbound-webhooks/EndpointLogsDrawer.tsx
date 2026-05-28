import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useInboundLogs } from "@/hooks/useInboundEndpoints";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function EndpointLogsDrawer({ endpointId, onClose }: { endpointId: string | null; onClose: () => void }) {
  const { data = [], isLoading } = useInboundLogs(endpointId);
  const [selected, setSelected] = useState<any | null>(null);

  return (
    <Sheet open={!!endpointId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[800px] sm:max-w-[800px]">
        <SheetHeader><SheetTitle>Logs do endpoint</SheetTitle></SheetHeader>
        <div className="grid grid-cols-2 gap-4 h-[calc(100vh-100px)] mt-3">
          <div className="overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recebido</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dur.</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                ) : data.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Sem logs.</TableCell></TableRow>
                ) : data.map((l: any) => (
                  <TableRow key={l.id} onClick={() => setSelected(l)} className="cursor-pointer hover:bg-muted/30">
                    <TableCell className="text-xs">{new Date(l.received_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell>
                      {l.status === "success" ? <Badge className="bg-emerald-600">OK</Badge> : <Badge variant="destructive">Erro</Badge>}
                    </TableCell>
                    <TableCell className="text-xs">{l.duration_ms ?? "—"}ms</TableCell>
                    <TableCell className="text-xs">{l.ip_address ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="overflow-auto space-y-3">
            {selected ? (
              <>
                <div>
                  <p className="text-xs font-semibold mb-1">Raw payload</p>
                  <pre className="text-[10px] bg-muted/40 rounded p-2 font-mono overflow-auto max-h-[40%]">
                    {JSON.stringify(selected.raw_payload, null, 2)}
                  </pre>
                </div>
                <div>
                  <p className="text-xs font-semibold mb-1">Mapeado</p>
                  <pre className="text-[10px] bg-muted/40 rounded p-2 font-mono overflow-auto max-h-[40%]">
                    {JSON.stringify(selected.mapped_data, null, 2)}
                  </pre>
                </div>
                {selected.error_message && (
                  <div>
                    <p className="text-xs font-semibold mb-1 text-destructive">Erro</p>
                    <p className="text-xs text-destructive">{selected.error_message}</p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground text-center pt-8">Selecione um log para ver detalhes.</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
