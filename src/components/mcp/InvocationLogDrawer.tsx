import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useMcpInvocations } from "@/hooks/useMcpCatalog";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function InvocationLogDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data = [], isLoading } = useMcpInvocations(100);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[520px] sm:max-w-none overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Log de invocações MCP</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-2">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : data.length === 0 ? (
            <div className="text-sm text-muted-foreground">Sem invocações ainda.</div>
          ) : (
            data.map((inv) => (
              <div key={inv.id} className="border rounded-md p-2 text-xs space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <code className="font-mono">{inv.tool_slug}</code>
                  <Badge variant={inv.status === "success" ? "default" : "destructive"} className="text-[10px]">
                    {inv.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>{inv.duration_ms ?? "-"}ms</span>
                  <span>{formatDistanceToNow(new Date(inv.invoked_at), { addSuffix: true, locale: ptBR })}</span>
                </div>
                {inv.error_message && <div className="text-red-600 dark:text-red-400">{inv.error_message}</div>}
                {inv.params && (
                  <pre className="bg-muted/40 p-1.5 rounded overflow-x-auto max-h-24">
                    {JSON.stringify(inv.params, null, 2).slice(0, 400)}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
