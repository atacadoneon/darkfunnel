import { useMemo } from "react";
import { useAdsAttribution } from "@/hooks/useAdsAttribution";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const fmtBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function AtribuicaoTab({ periodStart, periodEnd, channel }: { periodStart: Date; periodEnd: Date; channel: "all" | "meta" | "google" }) {
  const { data = [], isLoading } = useAdsAttribution(periodStart, periodEnd, channel);

  const rows = useMemo(() => {
    const map = new Map<string, { source: string | null; campaign: string | null; wins: number; revenue: number; daysSum: number; daysCount: number }>();
    for (const r of data) {
      if (r.deals?.status !== "won") continue;
      const key = `${r.source ?? "—"}::${r.campaign ?? "—"}`;
      let agg = map.get(key);
      if (!agg) {
        agg = { source: r.source, campaign: r.campaign, wins: 0, revenue: 0, daysSum: 0, daysCount: 0 };
        map.set(key, agg);
      }
      agg.wins += 1;
      agg.revenue += r.deals.value_cents ?? 0;
      if (r.deals.won_at && r.attributed_at) {
        const days = (new Date(r.deals.won_at).getTime() - new Date(r.attributed_at).getTime()) / (1000 * 60 * 60 * 24);
        if (days >= 0) {
          agg.daysSum += days;
          agg.daysCount += 1;
        }
      }
    }
    return Array.from(map.values())
      .map((r) => ({
        ...r,
        ticket: r.wins > 0 ? r.revenue / r.wins : 0,
        avgDays: r.daysCount > 0 ? r.daysSum / r.daysCount : null,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [data]);

  const chartData = rows.slice(0, 10).map((r) => ({
    name: (r.campaign ?? "—").slice(0, 20),
    receita: r.revenue / 100,
  }));

  if (isLoading) return <Card className="p-8 text-center text-sm text-muted-foreground">Carregando...</Card>;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Receita por campanha (top 10)</h3>
        <div className="h-64">
          {chartData.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center mt-12">Sem dados no período.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => fmtBRL(v * 100)} />
                <Bar dataKey="receita" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead>Campanha</TableHead>
              <TableHead className="text-right">Fechados</TableHead>
              <TableHead className="text-right">Receita</TableHead>
              <TableHead className="text-right">Ticket médio</TableHead>
              <TableHead className="text-right">Tempo médio (d)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem fechamentos atribuídos.</TableCell></TableRow>
            ) : rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell>{r.source ?? "—"}</TableCell>
                <TableCell>{r.campaign ?? "—"}</TableCell>
                <TableCell className="text-right">{r.wins}</TableCell>
                <TableCell className="text-right">{fmtBRL(r.revenue)}</TableCell>
                <TableCell className="text-right">{fmtBRL(r.ticket)}</TableCell>
                <TableCell className="text-right">{r.avgDays != null ? r.avgDays.toFixed(1) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
