import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  LayoutGrid,
  MessageSquare,
  ShieldCheck,
  ShoppingCart,
  Timer,
  TrendingDown,
  Trophy,
  Users,
} from "lucide-react";

type AccentTone = "danger" | "warning" | "success" | "info" | "purple";

const ACCENTS: Record<AccentTone, string> = {
  danger: "bg-rose-500",
  warning: "bg-amber-500",
  success: "bg-emerald-500",
  info: "bg-sky-500",
  purple: "bg-violet-500",
};

const VALUE_TONE: Record<AccentTone, string> = {
  danger: "text-rose-500",
  warning: "text-amber-500",
  success: "text-emerald-500",
  info: "text-sky-500",
  purple: "text-violet-400",
};

// ---------- Mock data (placeholder until Attention/inbox feed) ----------
const RANKING = [
  { name: "Jonathan Ritter", time: 1.9, convs: 1 },
  { name: "Mauricio", time: 2.1, convs: 4 },
  { name: "Everton Lauxen", time: 15.7, convs: 4 },
  { name: "Micael Natchgal", time: 183.1, convs: 93 },
  { name: "Maurício Oliveira", time: 200.8, convs: 80 },
  { name: "Felipe Pires", time: 241.1, convs: 1 },
  { name: "Eduarda Moreira", time: 269.8, convs: 110 },
  { name: "Nathalia Reuter", time: 283.1, convs: 98 },
  { name: "Eduardo Henn", time: 318.2, convs: 82 },
  { name: "Evandro Couto", time: 332.3, convs: 64 },
];

const VOLUME = [
  { name: "Eduardo Henn", convs: 318, msgs: 2167 },
  { name: "Eduarda Moreira", convs: 197, msgs: 2035 },
  { name: "Nathalia Reuter", convs: 188, msgs: 1274 },
  { name: "Micael Natchgal", convs: 183, msgs: 2500 },
  { name: "Maurício Oliveira", convs: 155, msgs: 1927 },
  { name: "Evandro Couto", convs: 87, msgs: 741 },
  { name: "Mauricio", convs: 30, msgs: 54 },
  { name: "Everton Lauxen", convs: 11, msgs: 62 },
  { name: "Felipe Pires", convs: 3, msgs: 6 },
  { name: "Gabrielly", convs: 3, msgs: 16 },
  { name: "Felipe Nunes", convs: 1, msgs: 11 },
];

const HOURS = [
  60, 30, 15, 10, 12, 50, 180, 600, 2200, 2900, 2900, 2700, 1450, 2400, 3100,
  2900, 3000, 2400, 880, 420, 380, 360, 240, 220,
];

const SLA_WAIT = [
  { label: "< 5min", value: 1, pct: 0, tone: "success" as AccentTone },
  { label: "5-15min", value: 0, pct: 0, tone: "info" as AccentTone },
  { label: "15-60min", value: 5, pct: 1, tone: "warning" as AccentTone },
  { label: "> 1h", value: 636, pct: 99, tone: "danger" as AccentTone },
];

const STAGE_TIME = [
  { name: "Novo Lead", days: 19.1, leads: 1218, tone: "danger" as AccentTone },
  { name: "Entender Projeto", days: 4.2, leads: 320, tone: "warning" as AccentTone },
  { name: "Proposta enviada", days: 2.1, leads: 180, tone: "success" as AccentTone },
  { name: "Cálculo de Preço", days: 1.0, leads: 60, tone: "success" as AccentTone },
  { name: "Previsto", days: 2.4, leads: 45, tone: "success" as AccentTone },
  { name: "Perdido", days: 0.3, leads: 41, tone: "success" as AccentTone },
  { name: "Comprou", days: 16.4, leads: 11, tone: "danger" as AccentTone },
];

const LOSS_REASONS = [
  { reason: "Não tem interesse no momento", stage: "Perdido", qty: 17 },
  { reason: "Preço muito alto", stage: "Perdido", qty: 8 },
  { reason: "Prazo não atendido", stage: "Perdido", qty: 5 },
  { reason: "Optou pela concorrência", stage: "Perdido", qty: 3 },
  { reason: "1 unidade", stage: "Perdido", qty: 2 },
  { reason: "Engano", stage: "Perdido", qty: 2 },
  { reason: "Era outro material", stage: "Perdido", qty: 1 },
  { reason: "Mudou de ideia", stage: "Perdido", qty: 1 },
];

export default function Dashboard() {
  const { current } = useWorkspace();
  const [period, setPeriod] = useState("last-month");
  const [team, setTeam] = useState("closer");
  const [scope, setScope] = useState("atendimento");

  const initials = useMemo(
    () =>
      (current?.name ?? "W")
        .split(/\s+/)
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    [current?.name]
  );

  const periodLabel =
    period === "last-month"
      ? "Mês Passado"
      : period === "this-month"
      ? "Este Mês"
      : period === "last-7"
      ? "Últimos 7 dias"
      : "Últimos 30 dias";

  const peakIdx = HOURS.indexOf(Math.max(...HOURS));
  const hoursData = HOURS.map((v, i) => ({ h: `${i}h`, v, peak: i === peakIdx }));
  const maxVol = Math.max(...VOLUME.map((v) => v.convs));

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-4 md:p-6">
      {/* Workspace card / filters */}
      <Card>
        <CardContent className="p-4 md:p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground shadow-lg">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <LayoutGrid className="h-3.5 w-3.5" />
                Dashboard Comercial
              </div>
              <h1 className="truncate text-2xl font-bold tracking-tight md:text-3xl">
                {current?.name ?? "Workspace"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {new Date().toLocaleDateString("pt-BR", {
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            <FilterSelect
              icon={<Users className="h-4 w-4" />}
              value={team}
              onChange={setTeam}
              options={[
                { v: "todos", l: "Todos" },
                { v: "closer", l: "-CLOSER" },
                { v: "sdr", l: "SDR" },
              ]}
            />
            <FilterSelect
              icon={<MessageSquare className="h-4 w-4" />}
              value={scope}
              onChange={setScope}
              options={[
                { v: "atendimento", l: "Atendimento" },
                { v: "vendas", l: "Vendas" },
                { v: "leads", l: "Leads" },
              ]}
            />
            <FilterSelect
              icon={<LayoutGrid className="h-4 w-4" />}
              value={team}
              onChange={setTeam}
              options={[
                { v: "closer", l: "-CLOSER" },
                { v: "todos", l: "Todos" },
              ]}
            />
            <FilterSelect
              value={period}
              onChange={setPeriod}
              options={[
                { v: "last-month", l: "Mês Passado" },
                { v: "this-month", l: "Este Mês" },
                { v: "last-7", l: "Últimos 7 dias" },
                { v: "last-30", l: "Últimos 30 dias" },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-xl font-bold tracking-tight">
          Atendimento — {periodLabel}
        </h2>
      </div>

      {/* KPI cards */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          tone="danger"
          label="Tempo resp. médio"
          value="73.9min"
          delta={{ text: "5%", down: true }}
          footer={
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-rose-500/40 bg-rose-500/10 text-rose-400">
                Lento
              </Badge>
              <span className="text-xs text-muted-foreground">1667/2130 em &lt;5min</span>
            </div>
          }
          icon={<Clock className="h-4 w-4 text-rose-400" />}
        />
        <MetricCard
          tone="purple"
          label="Aguardando resposta"
          value="642"
          footer={<span className="text-xs text-rose-400">636 há +1h</span>}
          icon={<MessageSquare className="h-4 w-4 text-violet-400" />}
        />
        <MetricCard
          tone="info"
          label="Conversão média"
          value="18.7d"
          footer={
            <span className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">11</span> vendas no período
            </span>
          }
          icon={<ShoppingCart className="h-4 w-4 text-sky-400" />}
        />
        <MetricCard
          tone="danger"
          label="Leads perdidos"
          value="41"
          footer={
            <span className="text-xs text-muted-foreground">
              Principal:{" "}
              <span className="text-foreground">Não tem interesse no momento</span>
            </span>
          }
          icon={<TrendingDown className="h-4 w-4 text-rose-400" />}
        />
        <MetricCard
          tone="warning"
          label="Sem resposta"
          value="2.1%"
          footer={
            <span className="text-xs text-muted-foreground">
              48 de 2297 conversas
            </span>
          }
          icon={<AlertTriangle className="h-4 w-4 text-amber-400" />}
        />
        <MetricCard
          tone="warning"
          label="SLA histórico"
          value={
            <span>
              78.3% <span className="text-amber-400">&lt;5min</span>
            </span>
          }
          footer={
            <span className="text-xs text-muted-foreground">
              83.4% em &lt;15min (2130 conversas)
            </span>
          }
          icon={<ShieldCheck className="h-4 w-4 text-amber-400" />}
        />
        <MetricCard
          tone="danger"
          label="Tempo resp. geral"
          value="80.3min"
          footer={
            <span className="text-xs text-muted-foreground">
              Mediana: 3min (25821 pares)
            </span>
          }
          icon={<Timer className="h-4 w-4 text-teal-400" />}
        />
        <MetricCard
          tone="warning"
          label="Taxa resolução"
          value="0.3%"
          footer={
            <span className="text-xs text-muted-foreground">8 resolvidas de 2431</span>
          }
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
        />
      </div>

      {/* Ranking */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-amber-400" />
            Ranking de Atendentes
          </CardTitle>
          <p className="text-xs text-muted-foreground">Tempo médio de primeira resposta</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-[28px_1fr_auto_56px] gap-3 border-b border-border/40 pb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
            <span>#</span>
            <span>Nome</span>
            <span className="text-right">Tempo</span>
            <span className="text-right">Conversas</span>
          </div>
          <ul className="divide-y divide-border/40">
            {RANKING.map((r, i) => {
              const tone: AccentTone =
                r.time < 5 ? "success" : r.time < 30 ? "warning" : "danger";
              return (
                <li
                  key={r.name}
                  className="grid grid-cols-[28px_1fr_auto_56px] items-center gap-3 py-2.5"
                >
                  <span className="text-sm text-muted-foreground">{i + 1}</span>
                  <span className="truncate text-sm font-medium">{r.name}</span>
                  <Badge
                    variant="outline"
                    className={`justify-self-end border-transparent ${
                      tone === "success"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : tone === "warning"
                        ? "bg-amber-500/15 text-amber-400"
                        : "bg-rose-500/15 text-rose-400"
                    }`}
                  >
                    {r.time.toFixed(1)}min
                  </Badge>
                  <span className="text-right text-sm text-muted-foreground">
                    {r.convs}
                  </span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {/* Volume por agente */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-sky-400" />
            Volume por Agente
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Conversas e mensagens por atendente
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-border/40 pb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
            <span>Nome</span>
            <span className="w-16 text-right">Conversas</span>
            <span className="w-16 text-right">Msgs</span>
          </div>
          <ul className="space-y-3 pt-3">
            {VOLUME.map((v) => (
              <li key={v.name} className="space-y-1.5">
                <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
                  <span className="truncate text-sm font-medium">{v.name}</span>
                  <span className="w-16 text-right text-sm">{v.convs}</span>
                  <span className="w-16 text-right text-sm text-muted-foreground">
                    {v.msgs}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-sky-500"
                    style={{ width: `${(v.convs / maxVol) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Horários de pico */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-sky-400" />
            Horários de Pico
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Volume de mensagens recebidas por hora (BRT)
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hoursData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <XAxis
                  dataKey="h"
                  tickLine={false}
                  axisLine={false}
                  interval={1}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="v" radius={[3, 3, 0, 0]}>
                  {hoursData.map((d, i) => (
                    <Cell
                      key={i}
                      fill={d.peak ? "hsl(217 91% 60%)" : "hsl(215 20% 55% / 0.55)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* SLA aguardando */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            SLA — Conversas Aguardando
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            642 conversas aguardando resposta agora
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {SLA_WAIT.map((s) => (
            <div key={s.label} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span>{s.label}</span>
                <span className="text-muted-foreground">
                  {s.value} ({s.pct}%)
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${ACCENTS[s.tone]}`}
                  style={{ width: `${Math.max(s.pct, s.value > 0 ? 1 : 0)}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Tempo médio por etapa */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tempo Médio por Etapa</CardTitle>
          <p className="text-xs text-muted-foreground">
            Dias médios que leads permanecem em cada etapa
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2.5">
            {STAGE_TIME.map((s) => {
              const max = Math.max(...STAGE_TIME.map((x) => x.days));
              return (
                <div
                  key={s.name}
                  className="grid grid-cols-[110px_1fr_auto] items-center gap-3"
                >
                  <span className="truncate text-right text-xs text-muted-foreground">
                    {s.name}
                  </span>
                  <div className="h-5 overflow-hidden rounded bg-muted">
                    <div
                      className={`h-full ${ACCENTS[s.tone]}`}
                      style={{ width: `${(s.days / max) * 100}%` }}
                      title={`${s.name} · ${s.days} dias (média) — ${s.leads} leads`}
                    />
                  </div>
                  <span className="w-14 text-right text-xs text-muted-foreground">
                    {s.days}d
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Motivos de perda */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Motivos de Perda por Etapa</CardTitle>
          <p className="text-xs text-muted-foreground">
            Top motivos de perda agrupados por etapa — {periodLabel}
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-[1fr_auto_48px] gap-3 border-b border-border/40 pb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
            <span>Motivo</span>
            <span>Etapa</span>
            <span className="text-right">Qtd</span>
          </div>
          <ul className="divide-y divide-border/40">
            {LOSS_REASONS.map((r) => (
              <li
                key={r.reason}
                className="grid grid-cols-[1fr_auto_48px] items-center gap-3 py-2.5"
              >
                <span className="truncate text-sm">{r.reason}</span>
                <Badge variant="outline" className="bg-muted/40 text-xs font-normal">
                  {r.stage}
                </Badge>
                <span className="text-right text-sm text-muted-foreground">
                  {r.qty}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <p className="pb-4 text-center text-[11px] text-muted-foreground">
        Dados de demonstração — conecte uma fonte de atendimento para popular em tempo real.
      </p>
    </div>
  );
}

function FilterSelect({
  icon,
  value,
  onChange,
  options,
}: {
  icon?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-10 rounded-full border-border/60 bg-background/40">
        <div className="flex items-center gap-2 truncate">
          {icon}
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.v} value={o.v}>
            {o.l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function MetricCard({
  tone,
  label,
  value,
  footer,
  icon,
  delta,
}: {
  tone: AccentTone;
  label: string;
  value: React.ReactNode;
  footer?: React.ReactNode;
  icon?: React.ReactNode;
  delta?: { text: string; down?: boolean };
}) {
  return (
    <Card className="relative overflow-hidden">
      <span className={`absolute inset-y-0 left-0 w-1 ${ACCENTS[tone]}`} />
      <CardContent className="p-4 pl-5">
        <div className="flex items-start justify-between gap-2">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          {icon && (
            <div className={`rounded-md bg-muted/50 p-1.5`}>{icon}</div>
          )}
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <div className={`text-3xl font-bold ${VALUE_TONE[tone]}`}>{value}</div>
          {delta && (
            <span
              className={`text-xs font-medium ${
                delta.down ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {delta.down ? "▼" : "▲"}
              {delta.text}
            </span>
          )}
        </div>
        {footer && <div className="mt-2">{footer}</div>}
      </CardContent>
    </Card>
  );
}
