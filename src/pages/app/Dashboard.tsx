import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { usePipelines } from "@/features/pipeline/leadEditHooks";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  DollarSign,
  GitBranch,
  LayoutGrid,
  LineChart as LineIcon,
  MessageSquare,
  MousePointerClick,
  Megaphone,
  PieChart as PieIcon,
  ShieldCheck,
  ShoppingCart,
  Target,
  Timer,
  TrendingDown,
  TrendingUp,
  Trophy,
  User,
  Users,
} from "lucide-react";
import type { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

// ---------- Mock data ----------
const RANKING = [
  { name: "Mauricio", time: 2.5, convs: 3 },
  { name: "Maurício Oliveira", time: 43.8, convs: 11 },
  { name: "Eduarda Moreira", time: 61.1, convs: 13 },
  { name: "Eduardo Henn", time: 84.3, convs: 8 },
  { name: "Micael Natchgal", time: 91.4, convs: 19 },
  { name: "Nathalia Reuter", time: 108.9, convs: 12 },
];

const VOLUME = [
  { name: "Micael Natchgal", convs: 47, msgs: 370 },
  { name: "Nathalia Reuter", convs: 36, msgs: 160 },
  { name: "Maurício Oliveira", convs: 35, msgs: 290 },
  { name: "Eduardo Henn", convs: 34, msgs: 254 },
  { name: "Mauricio", convs: 25, msgs: 48 },
  { name: "Eduarda Moreira", convs: 24, msgs: 215 },
  { name: "Gabrielly", convs: 3, msgs: 12 },
  { name: "Felipe Nunes", convs: 1, msgs: 11 },
  { name: "Everton Lauxen", convs: 1, msgs: 1 },
  { name: "Eduarda Oliveira", convs: 1, msgs: 27 },
];

const HOURS = [
  5, 2, 1, 1, 0, 1, 8, 30, 100, 145, 60, 50, 180, 195, 175, 175, 150, 130, 80, 15, 5, 3, 2, 1,
];

const SLA_WAIT = [
  { label: "< 5min", value: 0, pct: 0, tone: "success" as AccentTone },
  { label: "5-15min", value: 0, pct: 0, tone: "info" as AccentTone },
  { label: "15-60min", value: 2, pct: 0, tone: "warning" as AccentTone },
  { label: "> 1h", value: 664, pct: 100, tone: "danger" as AccentTone },
];

const STAGE_TIME = [
  { name: "Novo Lead", days: 1.5, leads: 12, tone: "danger" as AccentTone },
  { name: "Entender Projeto", days: 0, leads: 0, tone: "success" as AccentTone },
  { name: "Previsto", days: 0, leads: 0, tone: "success" as AccentTone },
  { name: "Proposta enviada", days: 9.4, leads: 8, tone: "danger" as AccentTone },
  { name: "VEND.", days: 0, leads: 0, tone: "success" as AccentTone },
];

const LOSS_REASONS = [{ reason: "2 unidades", stage: "Perdido", qty: 1 }];

// Ads
const ADS_KPIS = {
  leads: 70,
  leadsHint: "67 com URL rastreada",
  conv: 0,
  convHint: "0.0% taxa de conversão",
  receita: "R$ 0,00",
  receitaHint: "de leads convertidos",
  ticket: "R$ 0,00",
  ticketHint: "por conversão",
};
const ADS_PLATFORMS = [
  { name: "Google Ads", v: 39, pct: 56, color: "hsl(45 95% 55%)" },
  { name: "Instagram", v: 16, pct: 23, color: "hsl(340 80% 60%)" },
  { name: "Site / Landing Page", v: 12, pct: 17, color: "hsl(190 75% 50%)" },
  { name: "Outros", v: 3, pct: 4, color: "hsl(215 15% 55%)" },
];
const ADS_PERF = [
  { plat: "Google", title: "Campanha: pesquisa", sub: "LP: LP Engagge Placas", leads: 24, conv: 0 },
  { plat: "Google", title: "Campanha: Landing Page - Placas de Pre…", sub: "LP: LP Engagge Placas", leads: 15, conv: 0 },
  { plat: "Site", title: "LP Engagge Placas", sub: "LP Engagge Placas", leads: 12, conv: 0 },
  { plat: "Insta", title: "Solicite seu Orçamento", sub: "instagram.com/p/DXo8v72DFWS/", leads: 9, conv: 0 },
  { plat: "Insta", title: "Solicite seu Orçamento", sub: "instagram.com/p/DXo8vHUjMQx/", leads: 3, conv: 0 },
  { plat: "Insta", title: "Converse conosco", sub: "instagram.com/p/DXo8pGAOLkz/", leads: 2, conv: 0 },
  { plat: "Insta", title: "Engagge Placas de Premiação", sub: "instagram.com/p/DOLqPMBAMfx/", leads: 1, conv: 0 },
  { plat: "Insta", title: "Solicite seu Orçamento", sub: "instagram.com/p/DXo8v6wDAT6/", leads: 1, conv: 0 },
];

// Conversões
const CONV_KPIS = {
  taxa: "0.0%",
  taxaHint: "0 de 76 leads",
  leads: 76,
  leadsHint: "3 origens diferentes",
  convertidos: 0,
  convHint: "vendas fechadas",
  receita: "R$ 0,00",
  receitaHint: "de leads convertidos",
};
const CONV_ORIGINS = [
  { name: "Meta Ads", v: 19, pct: 25, color: "hsl(217 91% 60%)" },
  { name: "Sem Origem", v: 18, pct: 24, color: "hsl(215 15% 55%)" },
  { name: "Google Ads Site", v: 39, pct: 51, color: "hsl(45 95% 55%)" },
];

type Scope = "atendimento" | "performance" | "conversoes" | "ads";
type PeriodPreset =
  | "today"
  | "yesterday"
  | "all"
  | "this-week"
  | "last-week"
  | "this-month"
  | "last-month"
  | "this-quarter"
  | "custom";

const PERIOD_OPTIONS: { v: PeriodPreset; l: string }[] = [
  { v: "today", l: "Hoje" },
  { v: "yesterday", l: "Ontem" },
  { v: "all", l: "Atual (todos)" },
  { v: "this-week", l: "Esta Semana" },
  { v: "last-week", l: "Semana Passada" },
  { v: "this-month", l: "Este Mês" },
  { v: "last-month", l: "Mês Passado" },
  { v: "this-quarter", l: "Este Trimestre" },
  { v: "custom", l: "Personalizado" },
];

const SCOPE_OPTIONS: { v: Scope; l: string; icon: React.ReactNode }[] = [
  { v: "atendimento", l: "Atendimento", icon: <MessageSquare className="h-3.5 w-3.5" /> },
  { v: "performance", l: "Performance", icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { v: "conversoes", l: "Conversões", icon: <Target className="h-3.5 w-3.5" /> },
  { v: "ads", l: "Ads", icon: <Megaphone className="h-3.5 w-3.5" /> },
];

function computeRange(preset: PeriodPreset, custom?: DateRange): DateRange {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  switch (preset) {
    case "today":
      return { from: start, to: end };
    case "yesterday": {
      const y = new Date(start); y.setDate(y.getDate() - 1);
      const ye = new Date(end); ye.setDate(ye.getDate() - 1);
      return { from: y, to: ye };
    }
    case "this-week": {
      const d = new Date(start); d.setDate(d.getDate() - d.getDay());
      return { from: d, to: end };
    }
    case "last-week": {
      const d = new Date(start); d.setDate(d.getDate() - d.getDay() - 7);
      const e = new Date(d); e.setDate(d.getDate() + 6); e.setHours(23, 59, 59, 999);
      return { from: d, to: e };
    }
    case "this-month": {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: d, to: end };
    }
    case "last-month": {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { from: d, to: e };
    }
    case "this-quarter": {
      const q = Math.floor(now.getMonth() / 3);
      const d = new Date(now.getFullYear(), q * 3, 1);
      return { from: d, to: end };
    }
    case "all":
      return { from: new Date(2000, 0, 1), to: end };
    case "custom":
      return custom ?? { from: start, to: end };
  }
}

export default function Dashboard() {
  const { current } = useWorkspace();
  const { data: pipelines = [] } = usePipelines();
  const [scope, setScope] = useState<Scope>("atendimento");
  const [pipelineId, setPipelineId] = useState<string>("all");
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("this-month");
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);

  const range = useMemo(() => computeRange(periodPreset, customRange), [periodPreset, customRange]);

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

  const periodLabel = PERIOD_OPTIONS.find((p) => p.v === periodPreset)?.l ?? "Personalizado";
  const peakIdx = HOURS.indexOf(Math.max(...HOURS));
  const hoursData = HOURS.map((v, i) => ({ h: `${i}h`, v, peak: i === peakIdx }));
  const maxVol = Math.max(...VOLUME.map((v) => v.convs));

  const scopeTitle =
    scope === "atendimento"
      ? `Atendimento — ${periodLabel}`
      : scope === "performance"
      ? `Performance — ${periodLabel}`
      : scope === "ads"
      ? "Performance de Anúncios por Criativo"
      : "Análise de Conversões por Origem";

  const pipelineLabel =
    pipelineId === "all"
      ? "Todos os funis"
      : pipelines.find((p) => p.id === pipelineId)?.name ?? "Funil";

  const fmt = (d?: Date) => (d ? format(d, "dd/MM/yy", { locale: ptBR }) : "—");

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3 text-[13px] md:p-4">
      {/* Header / filters */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-base font-bold text-primary-foreground shadow">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                <LayoutGrid className="h-3 w-3" />
                Dashboard Comercial
              </div>
              <h1 className="truncate text-lg font-bold leading-tight">
                {current?.name ?? "Conta"}
              </h1>
              <p className="text-[11px] text-muted-foreground">
                {fmt(range.from)} - {fmt(range.to)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* 0 - Dashboard selection */}
              <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
                <SelectTrigger className="h-8 w-auto rounded-full border-border/60 bg-background/40 px-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    {SCOPE_OPTIONS.find((o) => o.v === scope)?.icon}
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {SCOPE_OPTIONS.map((o) => (
                    <SelectItem key={o.v} value={o.v} className="text-xs">
                      <div className="flex items-center gap-2">
                        {o.icon}
                        {o.l}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* 1 - Funil */}
              <Select value={pipelineId} onValueChange={setPipelineId}>
                <SelectTrigger className="h-8 w-auto rounded-full border-border/60 bg-background/40 px-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <GitBranch className="h-3.5 w-3.5" />
                    <span className="truncate max-w-[140px]">{pipelineLabel}</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Todos os funis</SelectItem>
                  {pipelines.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* 2 - Período preset */}
              <Select value={periodPreset} onValueChange={(v) => setPeriodPreset(v as PeriodPreset)}>
                <SelectTrigger className="h-8 w-auto rounded-full border-border/60 bg-background/40 px-3 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((o) => (
                    <SelectItem key={o.v} value={o.v} className="text-xs">
                      <div className="flex items-center gap-2">
                        {periodPreset === o.v && <Check className="h-3 w-3" />}
                        <span className={periodPreset === o.v ? "" : "ml-5"}>{o.l}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* 3 - Date range picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-8 rounded-full border-border/60 bg-background/40 px-3 text-xs font-normal"
                  >
                    <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                    {fmt(range.from)} - {fmt(range.to)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-auto p-0">
                  <Calendar
                    mode="range"
                    numberOfMonths={2}
                    selected={range}
                    onSelect={(r) => {
                      setCustomRange(r);
                      setPeriodPreset("custom");
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      <h2 className="text-base font-bold tracking-tight">{scopeTitle}</h2>

      {(scope === "atendimento" || scope === "performance") && (
        <AtendimentoView
          hoursData={hoursData}
          maxVol={maxVol}
          periodLabel={periodLabel}
        />
      )}
      {scope === "ads" && <AdsView />}
      {scope === "conversoes" && <ConversoesView />}

      <p className="pb-2 text-center text-[10px] text-muted-foreground">
        Dados de demonstração — conecte uma fonte para popular em tempo real.
      </p>
    </div>
  );
}

/* ============================================================
   ATENDIMENTO
============================================================ */
function AtendimentoView({
  hoursData,
  maxVol,
  periodLabel,
}: {
  hoursData: { h: string; v: number; peak: boolean }[];
  maxVol: number;
  periodLabel: string;
}) {
  return (
    <>
      {/* KPIs - 4 columns, compact */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MetricCard
          tone="danger"
          label="Tempo resp. médio"
          value="85.4min"
          delta={{ text: "43%", down: true }}
          footer={
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="h-4 border-rose-500/40 bg-rose-500/10 px-1.5 text-[10px] text-rose-400">
                Lento
              </Badge>
              <span className="text-[10px] text-muted-foreground">21/74 em &lt;5min</span>
            </div>
          }
          icon={<Clock className="h-3.5 w-3.5 text-rose-400" />}
        />
        <MetricCard
          tone="purple"
          label="Aguardando resposta"
          value="666"
          footer={<span className="text-[10px] text-rose-400">664 há +1h</span>}
          icon={<MessageSquare className="h-3.5 w-3.5 text-violet-400" />}
        />
        <MetricCard
          tone="info"
          label="Conversão média"
          value="19.7d"
          delta={{ text: "60%", down: true }}
          footer={
            <span className="text-[10px] text-muted-foreground">
              <span className="font-semibold text-foreground">4</span> vendas no período
            </span>
          }
          icon={<ShoppingCart className="h-3.5 w-3.5 text-sky-400" />}
        />
        <MetricCard
          tone="danger"
          label="Leads perdidos"
          value="1"
          footer={
            <span className="text-[10px] text-muted-foreground">Principal: 2 unidades</span>
          }
          icon={<TrendingDown className="h-3.5 w-3.5 text-rose-400" />}
        />
        <MetricCard
          tone="warning"
          label="Sem resposta"
          value="14%"
          footer={<span className="text-[10px] text-muted-foreground">12 de 88 conversas</span>}
          icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-400" />}
        />
        <MetricCard
          tone="warning"
          label="SLA histórico"
          value={<span>28.4% <span className="text-amber-400 text-base">&lt;5min</span></span>}
          footer={
            <span className="text-[10px] text-muted-foreground">50% em &lt;15min (74 conversas)</span>
          }
          icon={<ShieldCheck className="h-3.5 w-3.5 text-amber-400" />}
        />
        <MetricCard
          tone="danger"
          label="Tempo resp. geral"
          value="23.7min"
          footer={<span className="text-[10px] text-muted-foreground">Mediana: 2.9min (1182 pares)</span>}
          icon={<Timer className="h-3.5 w-3.5 text-teal-400" />}
        />
        <MetricCard
          tone="success"
          label="Taxa resolução"
          value="0%"
          footer={<span className="text-[10px] text-muted-foreground">0 resolvidas de 115</span>}
          icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
        />
      </div>

      {/* Two columns row 1: Ranking + Volume */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader className="p-3 pb-1.5">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <Trophy className="h-3.5 w-3.5 text-amber-400" />
              Ranking de Atendentes
            </CardTitle>
            <p className="text-[10px] text-muted-foreground">Tempo médio de primeira resposta</p>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="grid grid-cols-[24px_1fr_auto_56px] gap-2 border-b border-border/40 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
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
                    className="grid grid-cols-[24px_1fr_auto_56px] items-center gap-2 py-1.5"
                  >
                    <span className="text-xs text-muted-foreground">{i + 1}</span>
                    <span className="truncate text-xs font-medium">{r.name}</span>
                    <Badge
                      variant="outline"
                      className={`h-5 justify-self-end border-transparent px-1.5 text-[10px] ${
                        tone === "success"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : tone === "warning"
                          ? "bg-amber-500/15 text-amber-400"
                          : "bg-rose-500/15 text-rose-400"
                      }`}
                    >
                      {r.time.toFixed(1)}min
                    </Badge>
                    <span className="text-right text-xs text-muted-foreground">{r.convs}</span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 pb-1.5">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <Users className="h-3.5 w-3.5 text-sky-400" />
              Volume por Agente
            </CardTitle>
            <p className="text-[10px] text-muted-foreground">Conversas e mensagens por atendente</p>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-border/40 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              <span>Nome</span>
              <span className="w-12 text-right">Conv.</span>
              <span className="w-12 text-right">Msgs</span>
            </div>
            <ul className="space-y-1.5 pt-1.5">
              {VOLUME.map((v) => (
                <li key={v.name} className="space-y-0.5">
                  <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
                    <span className="truncate text-xs font-medium">{v.name}</span>
                    <span className="w-12 text-right text-xs">{v.convs}</span>
                    <span className="w-12 text-right text-xs text-muted-foreground">{v.msgs}</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-muted">
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
      </div>

      {/* Two columns row 2: Horários + SLA */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader className="p-3 pb-1.5">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <Clock className="h-3.5 w-3.5 text-sky-400" />
              Horários de Pico
            </CardTitle>
            <p className="text-[10px] text-muted-foreground">Volume por hora (BRT)</p>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hoursData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <XAxis
                    dataKey="h"
                    tickLine={false}
                    axisLine={false}
                    interval={2}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 6,
                      fontSize: 11,
                    }}
                  />
                  <Bar dataKey="v" radius={[2, 2, 0, 0]}>
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

        <Card>
          <CardHeader className="p-3 pb-1.5">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              SLA — Conversas Aguardando
            </CardTitle>
            <p className="text-[10px] text-muted-foreground">666 conversas aguardando agora</p>
          </CardHeader>
          <CardContent className="space-y-2.5 p-3 pt-0">
            {SLA_WAIT.map((s) => (
              <div key={s.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span>{s.label}</span>
                  <span className="text-muted-foreground">
                    {s.value} ({s.pct}%)
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${ACCENTS[s.tone]}`}
                    style={{ width: `${Math.max(s.pct, s.value > 0 ? 1 : 0)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Two columns row 3: Tempo etapa + Motivos perda */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader className="p-3 pb-1.5">
            <CardTitle className="text-sm">Tempo Médio por Etapa</CardTitle>
            <p className="text-[10px] text-muted-foreground">Dias médios em cada etapa</p>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="space-y-1.5">
              {STAGE_TIME.map((s) => {
                const max = Math.max(...STAGE_TIME.map((x) => x.days), 1);
                return (
                  <div
                    key={s.name}
                    className="grid grid-cols-[100px_1fr_auto] items-center gap-2"
                  >
                    <span className="truncate text-right text-[10px] text-muted-foreground">
                      {s.name}
                    </span>
                    <div className="h-4 overflow-hidden rounded bg-muted">
                      <div
                        className={`h-full ${ACCENTS[s.tone]}`}
                        style={{ width: `${(s.days / max) * 100}%` }}
                        title={`${s.name} · ${s.days}d — ${s.leads} leads`}
                      />
                    </div>
                    <span className="w-10 text-right text-[10px] text-muted-foreground">
                      {s.days}d
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 pb-1.5">
            <CardTitle className="text-sm">Motivos de Perda por Etapa</CardTitle>
            <p className="text-[10px] text-muted-foreground">
              Top motivos por etapa — {periodLabel}
            </p>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="grid grid-cols-[1fr_auto_40px] gap-2 border-b border-border/40 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              <span>Motivo</span>
              <span>Etapa</span>
              <span className="text-right">Qtd</span>
            </div>
            <ul className="divide-y divide-border/40">
              {LOSS_REASONS.map((r) => (
                <li
                  key={r.reason}
                  className="grid grid-cols-[1fr_auto_40px] items-center gap-2 py-1.5"
                >
                  <span className="truncate text-xs">{r.reason}</span>
                  <Badge variant="outline" className="h-5 bg-muted/40 px-1.5 text-[10px] font-normal">
                    {r.stage}
                  </Badge>
                  <span className="text-right text-xs text-muted-foreground">{r.qty}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

/* ============================================================
   ADS
============================================================ */
function AdsView() {
  return (
    <>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MetricCard
          tone="info"
          label="Leads de Ads"
          value={String(ADS_KPIS.leads)}
          footer={<span className="text-[10px] text-muted-foreground">{ADS_KPIS.leadsHint}</span>}
          icon={<Users className="h-3.5 w-3.5 text-sky-400" />}
        />
        <MetricCard
          tone="success"
          label="Conversões"
          value={String(ADS_KPIS.conv)}
          footer={<span className="text-[10px] text-muted-foreground">{ADS_KPIS.convHint}</span>}
          icon={<Target className="h-3.5 w-3.5 text-emerald-400" />}
        />
        <MetricCard
          tone="success"
          label="Receita de Ads"
          value={ADS_KPIS.receita}
          footer={<span className="text-[10px] text-muted-foreground">{ADS_KPIS.receitaHint}</span>}
          icon={<DollarSign className="h-3.5 w-3.5 text-emerald-400" />}
        />
        <MetricCard
          tone="purple"
          label="Ticket médio Ads"
          value={ADS_KPIS.ticket}
          footer={<span className="text-[10px] text-muted-foreground">{ADS_KPIS.ticketHint}</span>}
          icon={<ShoppingCart className="h-3.5 w-3.5 text-violet-400" />}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Top performer */}
        <Card className="border-amber-500/40">
          <CardHeader className="p-3 pb-1.5">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <Trophy className="h-3.5 w-3.5 text-amber-400" />
              Top Performer
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
                <MousePointerClick className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold">Campanha: pesquisa</div>
                <div className="text-[11px] text-muted-foreground">LP: LP Engagge Placas</div>
                <Badge variant="outline" className="mt-1.5 h-5 border-amber-500/40 bg-amber-500/10 px-1.5 text-[10px] text-amber-400">
                  Google Ads
                </Badge>
                <div className="mt-2 flex gap-2">
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px]">24 leads</Badge>
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px]">0 conversões</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Plataformas */}
        <Card>
          <CardHeader className="p-3 pb-1.5">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <BarChart3 className="h-3.5 w-3.5 text-sky-400" />
              Leads por Plataforma
            </CardTitle>
            <p className="text-[10px] text-muted-foreground">Distribuição por plataforma de origem</p>
          </CardHeader>
          <CardContent className="space-y-2 p-3 pt-0">
            {ADS_PLATFORMS.map((p) => (
              <div key={p.name} className="space-y-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-muted-foreground">
                    {p.v} ({p.pct}%)
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${p.pct}%`, background: p.color }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="p-3 pb-1.5">
          <CardTitle className="flex items-center gap-1.5 text-sm">
            <BarChart3 className="h-3.5 w-3.5 text-sky-400" />
            Performance por Anúncio
          </CardTitle>
          <p className="text-[10px] text-muted-foreground">Top {ADS_PERF.length} anúncios por volume</p>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="grid grid-cols-[40px_1fr_60px_60px_70px] gap-2 border-b border-border/40 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            <span>Plat.</span>
            <span>Anúncio</span>
            <span className="text-right">Leads</span>
            <span className="text-right">Conv.</span>
            <span className="text-right">Taxa</span>
          </div>
          <ul className="divide-y divide-border/40">
            {ADS_PERF.map((a, i) => (
              <li key={i} className="grid grid-cols-[40px_1fr_60px_60px_70px] items-center gap-2 py-1.5">
                <Badge variant="outline" className="h-5 justify-center px-1 text-[10px]">{a.plat}</Badge>
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium">{a.title}</div>
                  <div className="truncate text-[10px] text-muted-foreground">{a.sub}</div>
                </div>
                <span className="text-right text-xs">{a.leads}</span>
                <span className="text-right text-xs text-muted-foreground">{a.conv}</span>
                <span className="text-right text-[10px] text-muted-foreground">
                  {a.leads ? ((a.conv / a.leads) * 100).toFixed(1) : "0.0"}%
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}

/* ============================================================
   CONVERSÕES
============================================================ */
function ConversoesView() {
  const total = CONV_ORIGINS.reduce((s, o) => s + o.v, 0);
  const max = Math.max(...CONV_ORIGINS.map((o) => o.v));

  return (
    <>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MetricCard
          tone="info"
          label="Conversão geral"
          value={CONV_KPIS.taxa}
          footer={<span className="text-[10px] text-muted-foreground">{CONV_KPIS.taxaHint}</span>}
          icon={<TrendingUp className="h-3.5 w-3.5 text-sky-400" />}
        />
        <MetricCard
          tone="purple"
          label="Total de leads"
          value={String(CONV_KPIS.leads)}
          footer={<span className="text-[10px] text-muted-foreground">{CONV_KPIS.leadsHint}</span>}
          icon={<Users className="h-3.5 w-3.5 text-violet-400" />}
        />
        <MetricCard
          tone="success"
          label="Leads convertidos"
          value={String(CONV_KPIS.convertidos)}
          footer={<span className="text-[10px] text-muted-foreground">{CONV_KPIS.convHint}</span>}
          icon={<Target className="h-3.5 w-3.5 text-emerald-400" />}
        />
        <MetricCard
          tone="success"
          label="Receita atribuída"
          value={CONV_KPIS.receita}
          footer={<span className="text-[10px] text-muted-foreground">{CONV_KPIS.receitaHint}</span>}
          icon={<DollarSign className="h-3.5 w-3.5 text-emerald-400" />}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader className="p-3 pb-1.5">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <PieIcon className="h-3.5 w-3.5 text-sky-400" />
              Distribuição por Origem
            </CardTitle>
            <p className="text-[10px] text-muted-foreground">De onde vêm seus leads</p>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={CONV_ORIGINS}
                    dataKey="v"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                    label={(e: any) => `${e.name}: ${e.v} (${Math.round((e.v / total) * 100)}%)`}
                    labelLine={false}
                    style={{ fontSize: 10 }}
                  >
                    {CONV_ORIGINS.map((o, i) => (
                      <Cell key={i} fill={o.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 pb-1.5">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <Target className="h-3.5 w-3.5 text-emerald-400" />
              Taxa de Conversão por Origem
            </CardTitle>
            <p className="text-[10px] text-muted-foreground">Compare a eficiência de cada canal</p>
          </CardHeader>
          <CardContent className="space-y-2.5 p-3 pt-0">
            {CONV_ORIGINS.map((o) => (
              <div key={o.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: o.color }} />
                    {o.name}
                  </span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span>0/{o.v}</span>
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px]">0.0%</Badge>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: "0%", background: o.color }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="p-3 pb-1.5">
          <CardTitle className="text-sm">Leads vs Conversões por Canal</CardTitle>
          <p className="text-[10px] text-muted-foreground">Comparação visual de volume e resultado</p>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={CONV_ORIGINS.map((o) => ({ name: o.name, leads: o.v, conv: 0, color: o.color }))}
                margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
              >
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} domain={[0, max + 5]} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 11 }} />
                <Bar dataKey="leads" radius={[3, 3, 0, 0]}>
                  {CONV_ORIGINS.map((o, i) => (
                    <Cell key={i} fill={o.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

/* ============================================================
   Shared
============================================================ */
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
      <SelectTrigger className="h-8 w-auto rounded-full border-border/60 bg-background/40 px-3 text-xs">
        <div className="flex items-center gap-1.5 truncate">
          {icon}
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.v} value={o.v} className="text-xs">
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
      <CardContent className="p-2.5 pl-3">
        <div className="flex items-start justify-between gap-1.5">
          <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          {icon && <div className="rounded bg-muted/50 p-1">{icon}</div>}
        </div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <div className={`text-xl font-bold leading-tight ${VALUE_TONE[tone]}`}>{value}</div>
          {delta && (
            <span
              className={`text-[10px] font-medium ${
                delta.down ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {delta.down ? "▼" : "▲"}
              {delta.text}
            </span>
          )}
        </div>
        {footer && <div className="mt-1">{footer}</div>}
      </CardContent>
    </Card>
  );
}
