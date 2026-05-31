import { useState } from "react";
import { Clock, Layers, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardFilters } from "@/contexts/DashboardFiltersContext";
import { useFunnelByStage, useStuckDeals } from "@/hooks/useDashboard";
import { LeadEditDialog } from "@/features/pipeline/LeadEditDialog";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const brl = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format((cents ?? 0) / 100);
const num = (n: number) => new Intl.NumberFormat("pt-BR").format(n ?? 0);

export function FunilView() {
  const { filters } = useDashboardFilters();
  const { data: stages, isLoading } = useFunnelByStage(filters);
  const { data: stuck, isLoading: ls } = useStuckDeals();
  const [openDeal, setOpenDeal] = useState<string | null>(null);

  const maxCount = Math.max(1, ...(stages ?? []).map((s) => s.count ?? 0));

  return (
    <div className="p-6 space-y-6">
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Layers className="h-4 w-4 text-primary" /> Funil de Conversão</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-64" /> : (stages ?? []).length === 0 ? (
            <div className="text-sm text-muted-foreground py-10 text-center">Sem dados.</div>
          ) : (
            <div className="space-y-2">
              {stages!.map((s) => {
                const w = ((s.count ?? 0) / maxCount) * 100;
                const color = s.color || "hsl(var(--primary))";
                return (
                  <div key={s.stage_id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{s.stage_name}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {num(s.count)} · <span className="text-foreground font-medium">{brl(s.total_value_cents)}</span>
                      </span>
                    </div>
                    <div className="h-9 rounded-md bg-muted/30 overflow-hidden">
                      <div
                        className="h-full rounded-md transition-all flex items-center justify-end px-3 text-xs font-medium text-white"
                        style={{ width: `${Math.max(w, 4)}%`, background: color }}
                      >
                        {num(s.count)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4 text-primary" /> Velocidade do Funil</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-40" /> : (stages ?? []).every((s) => s.avg_days_in_stage == null) ? (
              <div className="text-sm text-muted-foreground py-10 text-center">Sem dados de histórico.</div>
            ) : (
              <div className="space-y-2">
                {stages!.map((s) => (
                  <div key={s.stage_id} className="flex items-center justify-between text-sm border-b last:border-0 py-2">
                    <span>{s.stage_name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {s.avg_days_in_stage != null ? `${Math.round(s.avg_days_in_stage)} dias` : "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><AlertCircle className="h-4 w-4 text-amber-500" /> Deals parados (&gt; 14 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            {ls ? <Skeleton className="h-40" /> : (stuck ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground py-10 text-center">Nenhum deal parado.</div>
            ) : (
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {stuck!.map((d: any) => (
                  <button
                    key={d.id}
                    onClick={() => setOpenDeal(d.id)}
                    className="w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-md hover:bg-accent text-sm border-b last:border-0"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{d.title ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        parado há {formatDistanceToNow(new Date(d.updated_at), { locale: ptBR })}
                      </div>
                    </div>
                    <div className="tabular-nums text-sm font-medium">{brl(d.value_cents ?? 0)}</div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {openDeal && (
        <LeadEditDialog open={!!openDeal} onOpenChange={(o) => !o && setOpenDeal(null)} dealId={openDeal} />
      )}
    </div>
  );
}
