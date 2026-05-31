import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { DollarSign, MessageSquare, Target, Percent } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useDashboardFilters } from "@/contexts/DashboardFiltersContext";
import { useAdsByCampaign, useAdsRoi } from "@/hooks/useDashboard";

const brl = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format((cents ?? 0) / 100);
const num = (n: number) => new Intl.NumberFormat("pt-BR").format(n ?? 0);
const pct = (n: number) => `${(n ?? 0).toFixed(1)}%`;

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

const SOURCE_COLOR: Record<string, string> = {
  meta: "hsl(217 91% 60%)",
  meta_ctwa: "hsl(217 91% 60%)",
  meta_link: "hsl(217 91% 60%)",
  facebook: "hsl(217 91% 60%)",
  google: "hsl(38 92% 50%)",
  google_ads: "hsl(38 92% 50%)",
};
const colorFor = (s?: string | null) => {
  if (!s) return "hsl(var(--muted-foreground))";
  const k = s.toLowerCase();
  for (const key of Object.keys(SOURCE_COLOR)) if (k.includes(key)) return SOURCE_COLOR[key];
  return "hsl(var(--primary))";
};
const labelSource = (s?: string | null) => {
  if (!s) return "—";
  const k = s.toLowerCase();
  if (k.includes("google")) return "Google";
  if (k.includes("meta") || k.includes("facebook") || k.includes("insta")) return "Meta";
  return s;
};

export function TrafegoView() {
  const { filters } = useDashboardFilters();
  const { data: roi, isLoading: lr } = useAdsRoi(filters);
  const { data: campaigns, isLoading: lc } = useAdsByCampaign(filters);

  const totalInvested = roi?.invested_cents_30d ?? 0;
  const totalRevenue = roi?.attributed_revenue_cents_30d ?? 0;
  const totalMessages = (campaigns ?? []).reduce((s, c) => s + (c.messages_count ?? 0), 0);
  const totalAttrib = roi?.attributed_deals_30d ?? 0;
  const cpl = totalAttrib ? totalInvested / totalAttrib : 0;
  const roiPct = totalInvested ? ((totalRevenue - totalInvested) / totalInvested) * 100 : 0;

  const byPlatform = new Map<string, number>();
  for (const c of campaigns ?? []) {
    const key = labelSource(c.source);
    byPlatform.set(key, (byPlatform.get(key) ?? 0) + (c.invested_cents ?? 0));
  }
  const pieData = Array.from(byPlatform.entries()).map(([name, value]) => ({ name, value: value / 100, fill: colorFor(name) }));

  const msgsByCampaign = (campaigns ?? [])
    .filter((c) => (c.messages_count ?? 0) > 0)
    .slice(0, 10)
    .map((c) => ({ name: c.campaign ?? "—", count: c.messages_count ?? 0 }));

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={DollarSign} label="Investido total" value={brl(totalInvested)} />
        <KpiCard icon={MessageSquare} label="Mensagens via Ads" value={num(totalMessages)} />
        <KpiCard icon={Target} label="CPL médio" value={brl(cpl)} />
        <KpiCard icon={Percent} label="ROI" value={pct(roiPct)} accent={roiPct >= 0 ? "text-emerald-500" : "text-destructive"} />
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-base">Top 10 campanhas</CardTitle></CardHeader>
        <CardContent>
          {lc ? <Skeleton className="h-48" /> : (campaigns ?? []).length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center border rounded-lg">Sem campanhas no período.</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Campanha</th>
                    <th className="text-left px-3 py-2 font-medium">Origem</th>
                    <th className="text-left px-3 py-2 font-medium">Médium</th>
                    <th className="text-right px-3 py-2 font-medium">Atribuições</th>
                    <th className="text-right px-3 py-2 font-medium">Vendas</th>
                    <th className="text-right px-3 py-2 font-medium">Receita</th>
                    <th className="text-right px-3 py-2 font-medium">ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns!.map((c, i) => {
                    const roas = c.invested_cents ? (c.total_revenue_cents / c.invested_cents) * 100 : 0;
                    return (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-2 truncate max-w-[260px]">{c.campaign ?? "—"}</td>
                        <td className="px-3 py-2"><Badge variant="secondary" style={{ borderColor: colorFor(c.source), color: colorFor(c.source) }} className="bg-transparent border">{labelSource(c.source)}</Badge></td>
                        <td className="px-3 py-2 text-muted-foreground">{c.medium ?? "—"}</td>
                        <td className="text-right tabular-nums px-3 py-2">{num(c.attributions)}</td>
                        <td className="text-right tabular-nums px-3 py-2">{num(c.deals_count)}</td>
                        <td className="text-right tabular-nums px-3 py-2 font-medium">{brl(c.total_revenue_cents)}</td>
                        <td className={`text-right tabular-nums px-3 py-2 ${roas >= 100 ? "text-emerald-500" : "text-muted-foreground"}`}>{pct(roas)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base">Distribuição Meta vs Google</CardTitle></CardHeader>
          <CardContent>
            {lr || lc ? <Skeleton className="h-60" /> : pieData.length === 0 ? (
              <div className="text-sm text-muted-foreground py-10 text-center">Sem investimento.</div>
            ) : (
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                      {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: any) => brl(Number(v) * 100)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base">Mensagens recebidas por anúncio</CardTitle></CardHeader>
          <CardContent>
            {lc ? <Skeleton className="h-60" /> : msgsByCampaign.length === 0 ? (
              <div className="text-sm text-muted-foreground py-10 text-center">Sem dados.</div>
            ) : (
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={msgsByCampaign} layout="vertical" margin={{ top: 5, right: 10, bottom: 0, left: 10 }}>
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={140} />
                    <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.3)" }} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
