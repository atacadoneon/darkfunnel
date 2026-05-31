import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MessageSquare, CheckCircle2, Timer, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useDashboardFilters } from "@/contexts/DashboardFiltersContext";
import { useSlaBySeller, useConvVolume14d } from "@/hooks/useDashboard";

const num = (n: number) => new Intl.NumberFormat("pt-BR").format(n ?? 0);

function KpiCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: string }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-5 flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
          <div className={`mt-2 text-3xl font-semibold tracking-tight ${accent ?? ""}`}>{value}</div>
        </div>
        <div className="h-10 w-10 rounded-lg bg-accent/40 flex items-center justify-center">
          <Icon className="h-5 w-5 text-foreground/70" />
        </div>
      </CardContent>
    </Card>
  );
}

export function AtendimentoView() {
  const { filters } = useDashboardFilters();
  const { data: rows, isLoading } = useSlaBySeller(filters);
  const { data: volume, isLoading: lv } = useConvVolume14d();

  const totals = (rows ?? []).reduce(
    (acc, r) => {
      acc.conv += r.conversas ?? 0;
      acc.res += r.resolvidas ?? 0;
      acc.resp += (r.avg_response_minutes ?? 0) * (r.conversas ?? 0);
      acc.respN += (r.avg_response_minutes != null ? r.conversas ?? 0 : 0);
      acc.pend += r.pendentes_24h ?? 0;
      return acc;
    },
    { conv: 0, res: 0, resp: 0, respN: 0, pend: 0 }
  );
  const abertas = totals.conv - totals.res;
  const avgResp = totals.respN ? Math.round(totals.resp / totals.respN) : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={MessageSquare} label="Conversas abertas" value={num(abertas)} />
        <KpiCard icon={CheckCircle2} label="Resolvidas (30d)" value={num(totals.res)} />
        <KpiCard icon={Timer} label="SLA 1ª resposta (min)" value={num(avgResp)} />
        <KpiCard icon={AlertTriangle} label="Abertas > 24h" value={num(totals.pend)} accent="text-destructive" />
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-base">SLA por vendedor</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-48" /> : (rows ?? []).length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center border rounded-lg">Sem dados.</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Vendedor</th>
                    <th className="text-right px-3 py-2 font-medium">Conversas</th>
                    <th className="text-right px-3 py-2 font-medium">Resolvidas</th>
                    <th className="text-right px-3 py-2 font-medium">Resp média</th>
                    <th className="text-right px-3 py-2 font-medium">Pendentes &gt; 24h</th>
                  </tr>
                </thead>
                <tbody>
                  {rows!.map((r) => (
                    <tr key={r.user_id} className="border-t">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={r.avatar_url ?? undefined} />
                            <AvatarFallback className="text-[10px]">{(r.display_name ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span>{r.display_name ?? "—"}</span>
                        </div>
                      </td>
                      <td className="text-right tabular-nums px-3 py-2">{num(r.conversas)}</td>
                      <td className="text-right tabular-nums px-3 py-2">{num(r.resolvidas)}</td>
                      <td className="text-right tabular-nums px-3 py-2">{r.avg_response_minutes != null ? `${Math.round(r.avg_response_minutes)} min` : "—"}</td>
                      <td className={`text-right tabular-nums px-3 py-2 ${r.pendentes_24h > 0 ? "text-destructive font-medium" : ""}`}>{num(r.pendentes_24h)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-base">Volume de conversas por dia (14d)</CardTitle></CardHeader>
        <CardContent>
          {lv ? <Skeleton className="h-56" /> : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volume ?? []} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
