import { useMemo } from "react";
import { useAdsAttribution } from "@/hooks/useAdsAttribution";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const fmtBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
};

export function AtribuicaoTab({
  periodStart,
  periodEnd,
  channel,
}: {
  periodStart: Date;
  periodEnd: Date;
  channel: "all" | "meta" | "google";
}) {
  const { data = [], isLoading } = useAdsAttribution(periodStart, periodEnd, channel);

  const totals = useMemo(() => {
    let revenue = 0;
    let wins = 0;
    for (const r of data) {
      if (r.deals?.status === "won") {
        wins += 1;
        revenue += r.deals.value_cents ?? 0;
      }
    }
    return { revenue, wins, total: data.length };
  }, [data]);

  if (isLoading) {
    return <Card className="p-8 text-center text-sm text-muted-foreground">Carregando...</Card>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Atribuições</div>
          <div className="text-2xl font-semibold">{totals.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Fechados (won)</div>
          <div className="text-2xl font-semibold">{totals.wins}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Receita atribuída</div>
          <div className="text-2xl font-semibold">{fmtBRL(totals.revenue)}</div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campanha</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Meio</TableHead>
              <TableHead>Landing page</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  Nenhum dado ainda
                </TableCell>
              </TableRow>
            ) : (
              data.map((r, i) => (
                <TableRow key={`${r.deal_id}-${i}`}>
                  <TableCell className="font-medium">{r.campaign ?? "—"}</TableCell>
                  <TableCell>{r.source ?? "—"}</TableCell>
                  <TableCell>{r.medium ?? "—"}</TableCell>
                  <TableCell className="max-w-[260px] truncate" title={r.landing_page ?? ""}>
                    {r.landing_page ?? "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {fmtDate(r.attributed_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.deals?.value_cents != null ? (
                      <span className="inline-flex items-center gap-2">
                        {fmtBRL(r.deals.value_cents)}
                        {r.deals.status === "won" && (
                          <Badge variant="secondary" className="text-[10px]">won</Badge>
                        )}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
