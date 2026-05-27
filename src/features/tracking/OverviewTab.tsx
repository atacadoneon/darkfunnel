import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Users, TrendingUp, DollarSign, Tag, RefreshCw, Send, Eye,
} from "lucide-react";
import { useTrackingOverview, useQueueStats, useQueueList, useProcessQueue } from "./hooks";

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function MetricCard({
  icon: Icon, label, value, sub, tone,
}: { icon: any; label: string; value: string; sub?: string; tone: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold mt-1">{value}</div>
          {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
        </div>
        <div className={`h-9 w-9 rounded-lg grid place-items-center ${tone}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}

export function OverviewTab() {
  const [days, setDays] = useState(30);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data: ov, isLoading, refetch } = useTrackingOverview(days);
  const { data: qstats } = useQueueStats();
  const { data: qlist = [] } = useQueueList(50);
  const processQueue = useProcessQueue();

  const series = ov?.series ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Visão geral</h2>
          <p className="text-sm text-muted-foreground">
            Métricas de rastreamento e atribuição.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard icon={Users} label="Leads rastreados" value={String(ov?.leads ?? 0)} tone="bg-blue-500/10 text-blue-600" />
        <MetricCard
          icon={TrendingUp}
          label="Conversões"
          value={String(ov?.conversions ?? 0)}
          sub={`${(ov?.conversionRate ?? 0).toFixed(1)}% taxa`}
          tone="bg-emerald-500/10 text-emerald-600"
        />
        <MetricCard icon={DollarSign} label="Receita rastreada" value={fmtBRL(ov?.revenue ?? 0)} tone="bg-purple-500/10 text-purple-600" />
        <MetricCard icon={Tag} label="Ticket médio" value={fmtBRL(ov?.ticket ?? 0)} tone="bg-orange-500/10 text-orange-600" />
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold">Meta Ads</div>
            <div className="text-xs text-muted-foreground">Leads vindos de campanhas Meta</div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold">{ov?.metaLeads ?? 0}</div>
            <div className="text-xs text-muted-foreground">{ov?.metaConv ?? 0} conversões</div>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="text-sm font-semibold mb-3">Evolução de leads por fonte</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="day" fontSize={11} />
              <YAxis fontSize={11} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="google" stackId="a" fill="#10b981" name="Google" />
              <Bar dataKey="meta" stackId="a" fill="#3b82f6" name="Meta" />
              <Bar dataKey="organico" stackId="a" fill="#94a3b8" name="Orgânico" />
              <Bar dataKey="outros" stackId="a" fill="#f59e0b" name="Outros" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b">
          <div className="text-sm font-semibold">Performance por campanha</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="text-left p-3 font-medium">Campanha</th>
                <th className="text-left p-3 font-medium">Fonte</th>
                <th className="text-right p-3 font-medium">Leads</th>
                <th className="text-right p-3 font-medium">Conversões</th>
                <th className="text-right p-3 font-medium">Taxa</th>
                <th className="text-right p-3 font-medium">Receita</th>
                <th className="text-right p-3 font-medium">Ticket</th>
              </tr>
            </thead>
            <tbody>
              {(ov?.campaigns ?? []).length === 0 ? (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhum dado no período</td></tr>
              ) : ov!.campaigns.map((c, i) => {
                const rate = c.leads ? (c.conv / c.leads) * 100 : 0;
                const ticket = c.conv ? c.rev / 100 / c.conv : 0;
                return (
                  <tr key={i} className="border-t">
                    <td className="p-3">{c.campaign}</td>
                    <td className="p-3">{c.source}</td>
                    <td className="p-3 text-right">{c.leads}</td>
                    <td className="p-3 text-right">{c.conv}</td>
                    <td className="p-3 text-right">{rate.toFixed(1)}%</td>
                    <td className="p-3 text-right">{fmtBRL(c.rev / 100)}</td>
                    <td className="p-3 text-right">{fmtBRL(ticket)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm font-semibold">Fila de envios</div>
            <div className="text-xs text-muted-foreground">
              Status das conversões enviadas para Meta e Google
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setDrawerOpen(true)}>
              <Eye className="h-4 w-4" /> Ver detalhes
            </Button>
            <Button size="sm" onClick={() => processQueue.mutate()} disabled={processQueue.isPending}>
              <Send className="h-4 w-4" /> Processar fila
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">Pendentes</div>
            <div className="text-xl font-bold text-amber-600">{qstats?.pending ?? 0}</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">Enviados (7d)</div>
            <div className="text-xl font-bold text-emerald-600">{qstats?.sent ?? 0}</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">Falhas (7d)</div>
            <div className="text-xl font-bold text-red-600">{qstats?.failed ?? 0}</div>
          </div>
        </div>
      </Card>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader><SheetTitle>Fila de envios</SheetTitle></SheetHeader>
          <div className="mt-4 space-y-2">
            {qlist.length === 0 && <div className="text-sm text-muted-foreground">Fila vazia</div>}
            {qlist.map((q) => (
              <div key={q.id} className="border rounded-md p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{q.event_name ?? "—"}</div>
                  <Badge variant={q.status === "sent" ? "default" : q.status === "failed" ? "destructive" : "secondary"}>
                    {q.status}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {q.provider.toUpperCase()} · {new Date(q.created_at).toLocaleString("pt-BR")}
                </div>
                {q.last_error && <div className="text-xs text-red-600 mt-1">{q.last_error}</div>}
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
