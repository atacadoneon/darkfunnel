import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronDown, ChevronRight } from "lucide-react";

type Props = { open: boolean; onClose: () => void; flowId: string };

export function ExecutionHistoryDrawer({ open, onClose, flowId }: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Record<string, any[]>>({});

  useEffect(() => {
    if (!open || !flowId) return;
    (async () => {
      const { data } = await supabase
        .from("flow_executions")
        .select("*")
        .eq("flow_id", flowId)
        .order("started_at", { ascending: false })
        .limit(50);
      setItems(data ?? []);
    })();
  }, [open, flowId]);

  const toggle = async (id: string) => {
    if (expanded[id]) {
      const { [id]: _, ...rest } = expanded;
      setExpanded(rest);
      return;
    }
    const { data } = await supabase
      .from("flow_node_runs")
      .select("*")
      .eq("execution_id", id)
      .order("started_at", { ascending: true });
    setExpanded({ ...expanded, [id]: data ?? [] });
  };

  const statusColor = (s: string) => {
    if (s === "success") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    if (s === "error") return "bg-red-500/15 text-red-700 dark:text-red-300";
    if (s === "warning") return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    return "bg-muted text-muted-foreground";
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[520px] sm:max-w-[520px] flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle>Histórico de execuções</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {!items.length && (
            <div className="text-center text-sm text-muted-foreground py-12">
              Nenhuma execução registrada
            </div>
          )}
          {items.map((it) => {
            const isOpen = !!expanded[it.id];
            return (
              <div key={it.id} className="border rounded-md">
                <button
                  onClick={() => toggle(it.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 text-left"
                >
                  {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  <Badge className={statusColor(it.status)} variant="outline">{it.status}</Badge>
                  <span className="font-mono text-xs text-muted-foreground">{it.id.slice(0, 8)}</span>
                  <span className="flex-1 truncate text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(it.started_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </button>
                {isOpen && (
                  <div className="border-t bg-muted/20 p-3 space-y-2">
                    {(expanded[it.id] ?? []).map((r) => (
                      <div key={r.id} className="text-xs flex items-start gap-2">
                        <Badge className={statusColor(r.status)} variant="outline">{r.status}</Badge>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{r.node_type ?? r.node_id}</div>
                          {r.error_message && (
                            <div className="text-red-600 dark:text-red-400 truncate">{r.error_message}</div>
                          )}
                          {r.duration_ms != null && (
                            <div className="text-muted-foreground">{r.duration_ms}ms</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
