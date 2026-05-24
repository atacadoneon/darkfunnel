import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { TrendingUp, TrendingDown, Trophy, Target, DollarSign, Users, Clock, Activity } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import type { Deal, Stage } from "./hooks";
import { formatMoney } from "./hooks";
import type { WorkspaceMember } from "@/features/workspace/permissions";
import type { LeadOrigin } from "./configHooks";

type Props = {
  deals: Deal[];
  stages: Stage[];
  members: WorkspaceMember[];
  origins: LeadOrigin[];
};

function daysBetween(a: Date, b: Date) {
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 86400000));
}

export function PipelineDashboard({ deals, stages, members, origins }: Props) {
  const m = useMemo(() => {
    const open = deals.filter((d) => d.status === "open");
    const won = deals.filter((d) => d.status === "won");
    const lost = deals.filter((d) => d.status === "lost");
    const totalOpenValue = open.reduce((s, d) => s + (d.value_cents || 0), 0);
    const totalWonValue = won.reduce((s, d) => s + (d.value_cents || 0), 0);
    const closedTotal = won.length + lost.length;
    const conversionRate = closedTotal > 0 ? (won.length / closedTotal) * 100 : 0;
    const avgTicket = won.length > 0 ? totalWonValue / won.length : 0;

    // tempo médio de fechamento (won)
    const cycleDays = won
      .map((d) => daysBetween(new Date(d.created_at), new Date(d.updated_at)))
      .filter((n) => n >= 0);
    const avgCycle = cycleDays.length ? cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length : 0;

    return { open, won, lost, totalOpenValue, totalWonValue, conversionRate, avgTicket, avgCycle };
  }, [deals]);

  // por etapa
  const byStage = useMemo(() => stages.map((s) => {
    const list = deals.filter((d) => d.stage_id === s.id);
    return {
      name: s.name,
      color: s.color,
      qty: list.length,
      value: list.reduce((sum, d) => sum + (d.value_cents || 0), 0) / 100,
    };
  }), [deals, stages]);

  // por origem
  const byOrigin = useMemo(() => {
    const map = new Map<string, { name: string; color: string; qty: number; value: number }>();
    for (const o of origins) map.set(o.id, { name: o.name, color: o.color, qty: 0, value: 0 });
    map.set("__none", { name: "Sem origem", color: "#94a3b8", qty: 0, value: 0 });
    for (const d of deals) {
      const key = (d as any).origin_id || "__none";
      const entry = map.get(key) ?? map.get("__none")!;
      entry.qty += 1;
      entry.value += (d.value_cents || 0) / 100;
    }
    return Array.from(map.values()).filter((e) => e.qty > 0);
  }, [deals, origins]);

  // ranking por responsável
  const ranking = useMemo(() => {
    const map = new Map<string, { name: string; won: number; value: number; total: number }>();
    for (const mem of members) map.set(mem.user_id, { name: mem.display_name || mem.email || "Sem nome", won: 0, value: 0, total: 0 });
    map.set("__none", { name: "Não atribuído", won: 0, value: 0, total: 0 });
    for (const d of deals) {
      const key = d.assigned_to || "__none";
      const e = map.get(key) ?? map.get("__none")!;
      e.total += 1;
      if (d.status === "won") {
        e.won += 1;
        e.value += (d.value_cents || 0) / 100;
      }
    }
    return Array.from(map.values()).filter((e) => e.total > 0).sort((a, b) => b.value - a.value);
  }, [deals, members]);

  // criados nos últimos 30 dias
  const last30 = useMemo(() => {
    const arr: { date: string; criados: number; ganhos: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 29; i >= 0; i--) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);
      const next = new Date(day); next.setDate(day.getDate() + 1);
      const label = `${String(day.getDate()).padStart(2, "0")}/${String(day.getMonth() + 1).padStart(2, "0")}`;
      let criados = 0, ganhos = 0;
      for (const d of deals) {
        const c = new Date(d.created_at);
        if (c >= day && c < next) criados++;
        if (d.status === "won") {
          const u = new Date(d.updated_at);
          if (u >= day && u < next) ganhos++;
        }
      }
      arr.push({ date: label, criados, ganhos });
    }
    return arr;
  }, [deals]);

  const Kpi = ({ icon: Icon, label, value, hint, tone = "default" }: any) => (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        <Icon className={`h-4 w-4 ${tone === "win" ? "text-emerald-500" : tone === "loss" ? "text-red-500" : "text-muted-foreground"}`} />
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </Card>
  );

  if (deals.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-10">
        <EmptyState
          icon={Activity}
          title="Sem dados ainda"
          description="Crie leads no funil para ver métricas, gráficos e o ranking de vendedores aqui."
        />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={Users} label="Leads em aberto" value={m.open.length}
             hint={formatMoney(m.totalOpenValue)} />
        <Kpi icon={Trophy} label="Ganhos" value={m.won.length}
             hint={formatMoney(m.totalWonValue)} tone="win" />
        <Kpi icon={TrendingDown} label="Perdidos" value={m.lost.length} tone="loss" />
        <Kpi icon={Target} label="Taxa de conversão"
             value={`${m.conversionRate.toFixed(1)}%`}
             hint={`${m.won.length}/${m.won.length + m.lost.length} fechados`} />
        <Kpi icon={DollarSign} label="Ticket médio" value={formatMoney(m.avgTicket)} />
        <Kpi icon={Clock} label="Ciclo médio (ganho)"
             value={`${m.avgCycle.toFixed(0)}d`} hint="da criação ao fechamento" />
        <Kpi icon={TrendingUp} label="Pipeline total" value={deals.length}
             hint="todos os status" />
        <Kpi icon={Activity} label="Origens ativas" value={byOrigin.length} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Por etapa - quantidade */}
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-1">Leads por etapa</h3>
          <p className="text-xs text-muted-foreground mb-3">Distribuição atual no funil</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byStage}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="qty" radius={[6, 6, 0, 0]}>
                  {byStage.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Valor por etapa */}
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-1">Valor por etapa</h3>
          <p className="text-xs text-muted-foreground mb-3">Em R$ acumulado por estágio</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byStage}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                  formatter={(v: number) => formatMoney(v * 100)}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {byStage.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Por origem */}
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-1">Leads por origem</h3>
          <p className="text-xs text-muted-foreground mb-3">De onde vêm seus leads</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byOrigin} dataKey="qty" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => `${e.name} (${e.qty})`}>
                  {byOrigin.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Tendência 30 dias */}
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-1">Últimos 30 dias</h3>
          <p className="text-xs text-muted-foreground mb-3">Leads criados vs ganhos por dia</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={last30}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="criados" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="ganhos" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Ranking */}
      <Card className="p-4">
        <h3 className="font-semibold text-sm mb-1">Ranking de vendedores</h3>
        <p className="text-xs text-muted-foreground mb-3">Classificação por valor ganho</p>
        <div className="space-y-2">
          {ranking.map((r, i) => {
            const conv = r.total > 0 ? (r.won / r.total) * 100 : 0;
            return (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  i === 0 ? "bg-yellow-500/15 text-yellow-600" :
                  i === 1 ? "bg-slate-400/20 text-slate-600" :
                  i === 2 ? "bg-amber-700/15 text-amber-700" : "bg-muted text-muted-foreground"
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{r.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.won} ganhos · {r.total} leads · {conv.toFixed(0)}% conversão
                  </div>
                </div>
                <Badge variant="secondary" className="font-semibold">{formatMoney(r.value * 100)}</Badge>
              </div>
            );
          })}
          {ranking.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum dado disponível</p>
          )}
        </div>
      </Card>
    </div>
  );
}
