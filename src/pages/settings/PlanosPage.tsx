import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Check } from "lucide-react";
import { usePlans, useCurrentSubscription, useUsageDaily } from "@/features/settings/settingsHooks";
import { useIsManagerOrAdmin } from "@/features/workspace/permissions";
import { toast } from "sonner";

function brl(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export default function PlanosPage() {
  const { data: plans = [], isLoading } = usePlans();
  const { data: sub } = useCurrentSubscription();
  const { data: usage = [] } = useUsageDaily();
  const canEdit = useIsManagerOrAdmin();

  const totals = useMemo(() => {
    return usage.reduce(
      (acc, r) => ({
        messages_sent: acc.messages_sent + (r.messages_sent ?? 0),
        calls_made: acc.calls_made + (r.calls_made ?? 0),
        automations_run: acc.automations_run + (r.automations_run ?? 0),
        mcp_invocations: acc.mcp_invocations + (r.mcp_invocations ?? 0),
        storage_bytes: Math.max(acc.storage_bytes, r.storage_bytes ?? 0),
      }),
      { messages_sent: 0, calls_made: 0, automations_run: 0, mcp_invocations: 0, storage_bytes: 0 },
    );
  }, [usage]);

  const currentSlug = (sub as { plan_slug?: string } | null)?.plan_slug ?? null;
  const status = (sub as { status?: string } | null)?.status ?? "trial";

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Planos e uso</h1>
        <p className="text-sm text-muted-foreground">Gerencie seu plano e acompanhe o consumo dos recursos.</p>
      </header>

      <Card className="p-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Plano atual</p>
          <div className="flex items-center gap-3 mt-1">
            <h2 className="text-xl font-bold capitalize">{currentSlug ?? "Trial"}</h2>
            <Badge variant={status === "active" ? "default" : "secondary"} className="capitalize">{status}</Badge>
          </div>
        </div>
        {canEdit && <Button variant="outline">Mudar plano</Button>}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {isLoading ? <Card className="p-6 md:col-span-3 text-sm text-muted-foreground">Carregando…</Card> : plans.map((p) => {
          const isCurrent = p.slug === currentSlug;
          return (
            <Card key={p.id} className={`p-6 space-y-4 ${p.is_recommended ? "border-violet-500 border-2" : ""} ${isCurrent ? "ring-2 ring-violet-500" : ""}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg">{p.name}</h3>
                {p.is_recommended && <Badge className="bg-violet-600 hover:bg-violet-600">Recomendado</Badge>}
              </div>
              <p className="text-sm text-muted-foreground min-h-[40px]">{p.description}</p>
              <div className="space-y-1 border-t pt-3">
                <div className="flex items-end gap-1"><span className="text-3xl font-bold">{brl(p.price_monthly_cents)}</span><span className="text-sm text-muted-foreground">/mês</span></div>
                {p.price_semestral_cents != null && <div className="text-xs text-muted-foreground">{brl(p.price_semestral_cents)}/mês no semestral</div>}
                {p.price_annual_cents != null && <div className="text-xs text-muted-foreground">{brl(p.price_annual_cents)}/mês no anual</div>}
              </div>
              <ul className="space-y-2 text-sm">
                {(p.features ?? []).map((f, i) => <li key={i} className="flex gap-2"><Check className="h-4 w-4 text-violet-600 shrink-0 mt-0.5" /><span>{f}</span></li>)}
              </ul>
              <Button
                className="w-full bg-violet-600 hover:bg-violet-700 text-white"
                disabled={isCurrent || !canEdit}
                onClick={() => toast.info("Checkout em breve")}
              >
                {isCurrent ? "Plano atual" : "Selecionar"}
              </Button>
            </Card>
          );
        })}
      </div>

      <Card className="p-6 space-y-4">
        <h3 className="font-semibold">Uso nos últimos 30 dias</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
          <Kpi label="Mensagens" value={totals.messages_sent} />
          <Kpi label="Chamadas" value={totals.calls_made} />
          <Kpi label="Automações" value={totals.automations_run} />
          <Kpi label="MCP invocations" value={totals.mcp_invocations} />
          <Kpi label="Storage (MB)" value={Math.round((totals.storage_bytes ?? 0) / (1024 * 1024))} />
        </div>
        <div className="h-56">
          {usage.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sem dados de uso no período.</div>
          ) : (
            <ResponsiveContainer>
              <BarChart data={usage}>
                <XAxis dataKey="day" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="messages_sent" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dia</TableHead>
              <TableHead className="text-right">Msgs</TableHead>
              <TableHead className="text-right">Calls</TableHead>
              <TableHead className="text-right">Autom.</TableHead>
              <TableHead className="text-right">MCP</TableHead>
              <TableHead className="text-right">Storage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usage.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Sem dados.</TableCell></TableRow>
            ) : usage.map((r) => (
              <TableRow key={r.day}>
                <TableCell>{new Date(r.day).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell className="text-right">{r.messages_sent ?? 0}</TableCell>
                <TableCell className="text-right">{r.calls_made ?? 0}</TableCell>
                <TableCell className="text-right">{r.automations_run ?? 0}</TableCell>
                <TableCell className="text-right">{r.mcp_invocations ?? 0}</TableCell>
                <TableCell className="text-right">{Math.round((r.storage_bytes ?? 0) / (1024 * 1024))} MB</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold">{value.toLocaleString("pt-BR")}</p>
    </div>
  );
}
