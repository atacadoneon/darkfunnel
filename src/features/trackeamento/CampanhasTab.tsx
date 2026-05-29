import { useMemo } from "react";
import { useAdsAttribution } from "@/hooks/useAdsAttribution";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { ListFooter } from "@/components/lists/ListFooter";

const fmtBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function channelBadge(source: string | null) {
  if (!source) return <Badge variant="secondary">Outros</Badge>;
  const s = source.toLowerCase();
  if (["meta", "facebook", "instagram", "fb"].includes(s))
    return <Badge className="bg-blue-600 hover:bg-blue-700">Meta</Badge>;
  if (["google", "google_ads", "adwords"].includes(s))
    return <Badge className="bg-emerald-600 hover:bg-emerald-700">Google</Badge>;
  return <Badge variant="secondary">{source}</Badge>;
}

export function CampanhasTab({ periodStart, periodEnd, channel }: { periodStart: Date; periodEnd: Date; channel: "all" | "meta" | "google" }) {
  const { data = [], isLoading } = useAdsAttribution(periodStart, periodEnd, channel);

  const rows = useMemo(() => {
    const map = new Map<string, { source: string | null; campaign: string | null; leads: Set<string>; wins: number; revenue: number; lastAt: string }>();
    for (const r of data) {
      const key = `${r.source ?? "—"}::${r.campaign ?? "—"}`;
      let agg = map.get(key);
      if (!agg) {
        agg = { source: r.source, campaign: r.campaign, leads: new Set(), wins: 0, revenue: 0, lastAt: r.attributed_at };
        map.set(key, agg);
      }
      agg.leads.add(r.deal_id);
      if (r.deals?.status === "won") {
        agg.wins += 1;
        agg.revenue += r.deals.value_cents ?? 0;
      }
      if (r.attributed_at > agg.lastAt) agg.lastAt = r.attributed_at;
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [data]);

  if (isLoading) return <Card className="p-8 text-center text-sm text-muted-foreground">Carregando...</Card>;

  if (rows.length === 0) {
    return (
      <Card className="p-12 text-center space-y-3">
        <p className="text-sm text-muted-foreground">Nenhuma campanha atribuída no período.</p>
        <p className="text-xs text-muted-foreground">Configure seu pixel/conversão para começar a receber dados.</p>
      </Card>
    );
  }

  return (
    <div>
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Canal</TableHead>
              <TableHead>Campanha</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="text-right">Ganhos</TableHead>
              <TableHead className="text-right">Receita</TableHead>
              <TableHead>Última atribuição</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell>{channelBadge(r.source)}</TableCell>
                <TableCell className="font-medium">{r.campaign ?? "—"}</TableCell>
                <TableCell className="text-right">{r.leads.size}</TableCell>
                <TableCell className="text-right">{r.wins}</TableCell>
                <TableCell className="text-right">{fmtBRL(r.revenue)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(r.lastAt).toLocaleDateString("pt-BR")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <ListFooter loaded={rows.length} total={rows.length} hasMore={false} singular="campanha exibida" plural="campanhas exibidas" />
    </div>
  );
}
