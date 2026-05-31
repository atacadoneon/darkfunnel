import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { Users, Filter, TrendingUp, DollarSign, Target, FileText, BadgeCheck, MessageSquare, ArrowDownToLine, ArrowUpFromLine, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useDashboardFilters } from "@/contexts/DashboardFiltersContext";
import { useCommercialSummary, useAdsRoi } from "@/hooks/useDashboard";
import { usePaymentsCommissions } from "@/hooks/usePayments";

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format((cents ?? 0) / 100);
const num = (n: number) => new Intl.NumberFormat("pt-BR").format(n ?? 0);

function KpiCard({
  icon: Icon, label, value, accent = "text-foreground",
}: { icon: any; label: string; value: string; accent?: string }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
            <div className={`mt-2 text-3xl font-semibold tracking-tight ${accent}`}>{value}</div>
          </div>
          <div className="h-10 w-10 rounded-lg bg-accent/40 flex items-center justify-center">
            <Icon className="h-5 w-5 text-foreground/70" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card/40 p-3">
      <div className="h-8 w-8 rounded-md bg-accent/40 flex items-center justify-center">
        <Icon className="h-4 w-4 text-foreground/70" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-lg font-semibold tabular-nums">{value}</div>
      </div>
    </div>
  );
}

export function CommercialView() {
  const { filters } = useDashboardFilters();
  const { data: summary, isLoading: ls } = useCommercialSummary(filters);
  const { data: ads, isLoading: la } = useAdsRoi(filters);
  const { data: commissions, isLoading: lc } = usePaymentsCommissions();

  const loading = ls || la;

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  const investedCents = ads?.invested_cents_30d ?? 0;
  const attributedRevenue = ads?.attributed_revenue_cents_30d ?? 0;
  const chartData = [
    { name: "Investido", value: investedCents / 100, fill: "hsl(var(--muted-foreground))" },
    { name: "Receita atribuída", value: attributedRevenue / 100, fill: "hsl(var(--primary))" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Linha 1 — KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Users} label="Leads de Entrada (30d)" value={num(summary?.leads_entrada_30d ?? 0)} />
        <KpiCard icon={Filter} label="Meio de Funil" value={num(summary?.leads_meio_funil_30d ?? 0)} />
        <KpiCard icon={TrendingUp} label="Vendas (Fundo)" value={num(summary?.vendas_30d ?? 0)} />
        <KpiCard icon={DollarSign} label="Receita 30d" value={brl(summary?.valor_vendas_cents_30d ?? 0)} accent="text-primary" />
      </div>

      {/* Linha 2 — Tráfego */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-primary" />
            Investimento em Tráfego vs Resultado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <MiniStat icon={DollarSign} label="Investido (Meta + Google)" value={brl(investedCents)} />
            <MiniStat icon={FileText} label="Propostas geradas" value={num(ads?.propostas_30d ?? 0)} />
            <MiniStat icon={BadgeCheck} label="Vendas atribuídas" value={num(ads?.attributed_deals_30d ?? 0)} />
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12}
                  tickFormatter={(v) => `R$${Math.round(Number(v) / 1000)}k`} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  formatter={(v: any) => brl(Number(v) * 100)}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Linha 3 — Atendimento + Top vendedores */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4 text-primary" />
            Atendimento (30d)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniStat icon={MessageSquare} label="Conversas" value={num(summary?.conversas_30d ?? 0)} />
            <MiniStat icon={ArrowDownToLine} label="Mensagens recebidas" value={num(summary?.mensagens_in_30d ?? 0)} />
            <MiniStat icon={ArrowUpFromLine} label="Mensagens enviadas" value={num(summary?.mensagens_out_30d ?? 0)} />
            <MiniStat icon={Activity} label="Razão out/in"
              value={(summary?.mensagens_in_30d
                ? ((summary?.mensagens_out_30d ?? 0) / summary.mensagens_in_30d).toFixed(2)
                : "0.00")} />
          </div>

          <div>
            <div className="text-sm font-medium mb-3">Top 5 vendedores por vendas</div>
            {lc ? (
              <Skeleton className="h-32" />
            ) : (commissions ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center border rounded-lg">
                Sem vendas no período.
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Vendedor</th>
                      <th className="text-right px-3 py-2 font-medium">Vendas</th>
                      <th className="text-right px-3 py-2 font-medium">Receita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(commissions ?? []).slice(0, 5).map((c: any, i: number) => (
                      <tr key={c.user_id ?? i} className="border-t">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={c.avatar_url ?? undefined} />
                              <AvatarFallback className="text-[10px]">
                                {(c.display_name ?? c.name ?? "?").slice(0, 1).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span>{c.display_name ?? c.name ?? "—"}</span>
                          </div>
                        </td>
                        <td className="text-right tabular-nums px-3 py-2">{num(c.paid_count ?? c.deals_count ?? 0)}</td>
                        <td className="text-right tabular-nums px-3 py-2 font-medium">{brl(c.total_paid_cents ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
