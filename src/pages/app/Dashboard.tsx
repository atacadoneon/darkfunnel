import { useEffect, useMemo, useState } from "react";
import {
  Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/EmptyState";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { usePipelines } from "@/features/pipeline/leadEditHooks";
import {
  AlertTriangle, BarChart3, CalendarDays, Check, CheckCircle2, Clock, DollarSign,
  GitBranch, LayoutGrid, MessageSquare, Megaphone, PieChart as PieIcon, ShieldCheck,
  ShoppingCart, Target, Timer, TrendingDown, TrendingUp, Trophy, Users,
} from "lucide-react";
import type { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  useDashboardConversations, useDashboardDeals, useDashboardContacts,
  useDashboardStages, useDashboardLossReasons, useDashboardMessages, useDashboardProfiles,
  buildAtendimentoMetrics, buildRankingAtendentes, buildPerformanceMetrics,
  buildSellerRanking, buildConversoesMetrics, buildAdsMetrics, filterDealsByPipeline,
} from "@/features/dashboard/hooks";

type AccentTone = "danger" | "warning" | "success" | "info" | "purple";

const ACCENTS: Record<AccentTone, string> = {
  danger: "bg-rose-500", warning: "bg-amber-500", success: "bg-emerald-500", info: "bg-sky-500", purple: "bg-violet-500",
};
const VALUE_TONE: Record<AccentTone, string> = {
  danger: "text-rose-500", warning: "text-amber-500", success: "text-emerald-500", info: "text-sky-500", purple: "text-violet-400",
};

const ORIGIN_LABEL: Record<string, string> = {
  meta_ctwa: "Meta Ads (CTWA)",
  meta_link: "Meta Ads (Link)",
  google_ads: "Google Ads",
  darkfunnel_ref: "DarkFunnel",
  "Sem Origem": "Sem Origem",
};
const ORIGIN_COLOR = (name: string) => {
  if (name.startsWith("meta")) return "hsl(217 91% 60%)";
  if (name.startsWith("google")) return "hsl(45 95% 55%)";
  if (name.startsWith("dark")) return "hsl(280 75% 60%)";
  return "hsl(215 15% 55%)";
};

type Scope = "atendimento" | "performance" | "conversoes" | "ads";
type PeriodPreset = "today" | "yesterday" | "all" | "this-week" | "last-week" | "this-month" | "last-month" | "this-quarter" | "custom";

const PERIOD_OPTIONS: { v: PeriodPreset; l: string }[] = [
  { v: "today", l: "Hoje" }, { v: "yesterday", l: "Ontem" }, { v: "all", l: "Atual (todos)" },
  { v: "this-week", l: "Esta Semana" }, { v: "last-week", l: "Semana Passada" },
  { v: "this-month", l: "Este Mês" }, { v: "last-month", l: "Mês Passado" },
  { v: "this-quarter", l: "Este Trimestre" }, { v: "custom", l: "Personalizado" },
];
const SCOPE_OPTIONS: { v: Scope; l: string; icon: React.ReactNode }[] = [
  { v: "atendimento", l: "Atendimento", icon: <MessageSquare className="h-3.5 w-3.5" /> },
  { v: "performance", l: "Performance", icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { v: "conversoes", l: "Conversões", icon: <Target className="h-3.5 w-3.5" /> },
  { v: "ads", l: "Ads", icon: <Megaphone className="h-3.5 w-3.5" /> },
];

function computeRange(preset: PeriodPreset, custom?: DateRange): { from: Date; to: Date } {
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  switch (preset) {
    case "today": return { from: start, to: end };
    case "yesterday": { const y = new Date(start); y.setDate(y.getDate() - 1); const ye = new Date(end); ye.setDate(ye.getDate() - 1); return { from: y, to: ye }; }
    case "this-week": { const d = new Date(start); d.setDate(d.getDate() - d.getDay()); return { from: d, to: end }; }
    case "last-week": { const d = new Date(start); d.setDate(d.getDate() - d.getDay() - 7); const e = new Date(d); e.setDate(d.getDate() + 6); e.setHours(23, 59, 59, 999); return { from: d, to: e }; }
    case "this-month": return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: end };
    case "last-month": return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999) };
    case "this-quarter": { const q = Math.floor(now.getMonth() / 3); return { from: new Date(now.getFullYear(), q * 3, 1), to: end }; }
    case "all": return { from: new Date(2000, 0, 1), to: end };
    case "custom": return custom?.from && custom?.to ? { from: custom.from, to: custom.to } : { from: start, to: end };
  }
}

const fmtMoney = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const fmtMin = (m: number) => m < 60 ? `${m.toFixed(1)}min` : `${(m / 60).toFixed(1)}h`;
const fmtDate = (d?: Date) => (d ? format(d, "dd/MM/yy", { locale: ptBR }) : "—");
const initialsOf = (name: string) => name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();

export default function Dashboard() {
  const { current } = useWorkspace();
  const { data: pipelines = [] } = usePipelines();
  const [scope, setScope] = useState<Scope>("atendimento");
  const [pipelineId, setPipelineId] = useState<string>("all");
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("this-month");
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);
  const range = useMemo(() => computeRange(periodPreset, customRange), [periodPreset, customRange]);

  const convQ = useDashboardConversations();
  const dealsQ = useDashboardDeals();
  const contactsQ = useDashboardContacts();
  const stagesQ = useDashboardStages();
  const lossQ = useDashboardLossReasons();
  const msgsQ = useDashboardMessages(range);

  const anyError = convQ.error || dealsQ.error || contactsQ.error || msgsQ.error;
  useEffect(() => { if (anyError) toast.error("Erro ao carregar métricas do dashboard"); }, [anyError]);

  const conversations = convQ.data ?? [];
  const allDeals = dealsQ.data ?? [];
  const deals = useMemo(() => filterDealsByPipeline(allDeals, pipelineId), [allDeals, pipelineId]);
  const contacts = contactsQ.data ?? [];
  const stages = stagesQ.data ?? [];
  const lossReasons = lossQ.data ?? [];
  const messages = msgsQ.data ?? [];

  const periodLabel = PERIOD_OPTIONS.find((p) => p.v === periodPreset)?.l ?? "Personalizado";
  const pipelineLabel = pipelineId === "all" ? "Todos os funis" : pipelines.find((p) => p.id === pipelineId)?.name ?? "Funil";

  const initials = useMemo(() => initialsOf(current?.name ?? "W"), [current?.name]);
  const scopeTitle = scope === "atendimento" ? `Atendimento — ${periodLabel}`
    : scope === "performance" ? `Performance — ${periodLabel}`
    : scope === "ads" ? "Performance de Anúncios"
    : `Conversões — ${periodLabel}`;

  const loading = convQ.isLoading || dealsQ.isLoading || contactsQ.isLoading || msgsQ.isLoading;

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3 text-[13px] md:p-4">
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-base font-bold text-primary-foreground shadow">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                <LayoutGrid className="h-3 w-3" /> Dashboard Comercial
              </div>
              <h1 className="truncate text-lg font-bold leading-tight">{current?.name ?? "Conta"}</h1>
              <p className="text-[11px] text-muted-foreground">{fmtDate(range.from)} - {fmtDate(range.to)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
                <SelectTrigger className="h-8 w-auto rounded-full border-border/60 bg-background/40 px-3 text-xs">
                  <div className="flex items-center gap-1.5">{SCOPE_OPTIONS.find((o) => o.v === scope)?.icon}<SelectValue /></div>
                </SelectTrigger>
                <SelectContent>{SCOPE_OPTIONS.map((o) => (
                  <SelectItem key={o.v} value={o.v} className="text-xs"><div className="flex items-center gap-2">{o.icon}{o.l}</div></SelectItem>
                ))}</SelectContent>
              </Select>
              <Select value={pipelineId} onValueChange={setPipelineId}>
                <SelectTrigger className="h-8 w-auto rounded-full border-border/60 bg-background/40 px-3 text-xs">
                  <div className="flex items-center gap-1.5"><GitBranch className="h-3.5 w-3.5" /><span className="truncate max-w-[140px]">{pipelineLabel}</span></div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Todos os funis</SelectItem>
                  {pipelines.map((p) => <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={periodPreset} onValueChange={(v) => setPeriodPreset(v as PeriodPreset)}>
                <SelectTrigger className="h-8 w-auto rounded-full border-border/60 bg-background/40 px-3 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{PERIOD_OPTIONS.map((o) => (
                  <SelectItem key={o.v} value={o.v} className="text-xs">
                    <div className="flex items-center gap-2">{periodPreset === o.v && <Check className="h-3 w-3" />}<span className={periodPreset === o.v ? "" : "ml-5"}>{o.l}</span></div>
                  </SelectItem>
                ))}</SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-8 rounded-full border-border/60 bg-background/40 px-3 text-xs font-normal">
                    <CalendarDays className="mr-1.5 h-3.5 w-3.5" />{fmtDate(range.from)} - {fmtDate(range.to)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-auto p-0">
                  <Calendar mode="range" numberOfMonths={2} selected={range as DateRange}
                    onSelect={(r) => { setCustomRange(r); setPeriodPreset("custom"); }} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      <h2 className="text-base font-bold tracking-tight">{scopeTitle}</h2>

      {loading ? <DashboardSkeleton />
        : scope === "atendimento" ? <AtendimentoView conversations={conversations} deals={deals} messages={messages} contacts={contacts} range={range} periodLabel={periodLabel} />
        : scope === "performance" ? <PerformanceView deals={deals} stages={stages} pipelineId={pipelineId} range={range} />
        : scope === "ads" ? <AdsView contacts={contacts} deals={deals} conversations={conversations} range={range} />
        : <ConversoesView contacts={contacts} deals={deals} conversations={conversations} range={range} />
      }
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" />
      </div>
    </>
  );
}

/* ============================================================ ATENDIMENTO ============================================================ */
function AtendimentoView({ conversations, deals, messages, contacts, range, periodLabel }: any) {
  const m = useMemo(() => buildAtendimentoMetrics(conversations, deals, messages, contacts, range), [conversations, deals, messages, contacts, range]);
  const ranking = useMemo(() => buildRankingAtendentes(conversations, messages, range), [conversations, messages, range]);
  const userIds = useMemo(() => ranking.map((r) => r.user_id), [ranking]);
  const { data: profiles = {} } = useDashboardProfiles(userIds);

  const sortedRanking = useMemo(() => [...ranking].filter((r) => r.avgTime > 0).sort((a, b) => a.avgTime - b.avgTime), [ranking]);
  const volumeRanking = useMemo(() => [...ranking].sort((a, b) => b.convs - a.convs), [ranking]);
  const maxVol = volumeRanking[0]?.convs ?? 1;

  const peakIdx = m.hours.indexOf(Math.max(...m.hours));
  const hoursData = m.hours.map((v: number, i: number) => ({ h: `${i}h`, v, peak: i === peakIdx }));

  const slaTotal = (Object.values(m.buckets) as number[]).reduce((a, b) => a + b, 0);
  const slaItems: { label: string; value: number; tone: AccentTone }[] = [
    { label: "< 5min", value: m.buckets["<5min"], tone: "success" },
    { label: "5-15min", value: m.buckets["5-15min"], tone: "info" },
    { label: "15-60min", value: m.buckets["15-60min"], tone: "warning" },
    { label: "> 1h", value: m.buckets[">1h"], tone: "danger" },
  ];

  const respTone: AccentTone = m.avgResp < 5 ? "success" : m.avgResp < 30 ? "warning" : "danger";
  const respLabel = m.avgResp < 5 ? "Rápido" : m.avgResp < 30 ? "Normal" : "Lento";

  return (
    <>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MetricCard tone={respTone} label="Tempo resp. médio" value={m.convPeriodCount === 0 ? "—" : fmtMin(m.avgResp)}
          footer={<div className="flex items-center gap-1.5">
            <Badge variant="outline" className={`h-4 px-1.5 text-[10px] ${respTone === "success" ? "bg-emerald-500/10 text-emerald-400" : respTone === "warning" ? "bg-amber-500/10 text-amber-400" : "bg-rose-500/10 text-rose-400"}`}>{respLabel}</Badge>
            <span className="text-[10px] text-muted-foreground">{m.under5}/{m.convPeriodCount} em &lt;5min</span>
          </div>}
          icon={<Clock className="h-3.5 w-3.5" />} />
        <MetricCard tone="purple" label="Aguardando resposta" value={String(m.awaitingCount)}
          footer={<span className="text-[10px] text-rose-400">{m.buckets[">1h"]} há +1h</span>} icon={<MessageSquare className="h-3.5 w-3.5 text-violet-400" />} />
        <MetricCard tone="info" label="Conversão média" value={m.wonCount === 0 ? "—" : `${m.avgCycle.toFixed(1)}d`}
          footer={<span className="text-[10px] text-muted-foreground"><span className="font-semibold text-foreground">{m.wonCount}</span> vendas no período</span>} icon={<ShoppingCart className="h-3.5 w-3.5 text-sky-400" />} />
        <MetricCard tone="danger" label="Leads perdidos" value={String(m.lostCount)} icon={<TrendingDown className="h-3.5 w-3.5 text-rose-400" />} />
        <MetricCard tone="warning" label="Sem resposta" value={`${m.semRespPct.toFixed(0)}%`}
          footer={<span className="text-[10px] text-muted-foreground">{m.semResposta} de {conversations.length} conversas</span>} icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-400" />} />
        <MetricCard tone="warning" label="SLA histórico" value={<span>{m.slaUnder5Hist.toFixed(1)}% <span className="text-amber-400 text-base">&lt;5min</span></span>}
          footer={<span className="text-[10px] text-muted-foreground">{m.slaHist.toFixed(0)}% em &lt;15min ({m.medianPairs} pares)</span>} icon={<ShieldCheck className="h-3.5 w-3.5 text-amber-400" />} />
        <MetricCard tone="danger" label="Tempo resp. geral" value={m.medianPairs === 0 ? "—" : fmtMin(m.median)}
          footer={<span className="text-[10px] text-muted-foreground">Mediana global ({m.medianPairs} pares)</span>} icon={<Timer className="h-3.5 w-3.5 text-teal-400" />} />
        <MetricCard tone="success" label="Taxa resolução" value={`${m.resolPct.toFixed(0)}%`}
          footer={<span className="text-[10px] text-muted-foreground">{m.resolved} resolvidas de {m.convPeriodCount}</span>} icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader className="p-3 pb-1.5">
            <CardTitle className="flex items-center gap-1.5 text-sm"><Trophy className="h-3.5 w-3.5 text-amber-400" />Ranking de Atendentes</CardTitle>
            <p className="text-[10px] text-muted-foreground">Tempo médio de primeira resposta</p>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {sortedRanking.length === 0 ? (
              <EmptyState icon={Trophy} title="Sem atendimentos no período" description="Nenhum atendente registrou primeira resposta neste período." />
            ) : (
              <ul className="divide-y divide-border/40">
                {sortedRanking.map((r, i) => {
                  const tone: AccentTone = r.avgTime < 5 ? "success" : r.avgTime < 30 ? "warning" : "danger";
                  const p = profiles[r.user_id];
                  const name = p?.display_name || p?.email || "Sem nome";
                  return (
                    <li key={r.user_id} className="grid grid-cols-[24px_28px_1fr_auto_56px] items-center gap-2 py-1.5">
                      <span className="text-xs text-muted-foreground">{i + 1}</span>
                      <Avatar className="h-6 w-6"><AvatarImage src={p?.avatar_url ?? undefined} /><AvatarFallback className="text-[9px]">{initialsOf(name)}</AvatarFallback></Avatar>
                      <span className="truncate text-xs font-medium">{name}</span>
                      <Badge variant="outline" className={`h-5 justify-self-end border-transparent px-1.5 text-[10px] ${tone === "success" ? "bg-emerald-500/15 text-emerald-400" : tone === "warning" ? "bg-amber-500/15 text-amber-400" : "bg-rose-500/15 text-rose-400"}`}>{fmtMin(r.avgTime)}</Badge>
                      <span className="text-right text-xs text-muted-foreground">{r.convs}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 pb-1.5">
            <CardTitle className="flex items-center gap-1.5 text-sm"><Users className="h-3.5 w-3.5 text-sky-400" />Volume por Agente</CardTitle>
            <p className="text-[10px] text-muted-foreground">Conversas e mensagens por atendente</p>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {volumeRanking.length === 0 ? (
              <EmptyState icon={Users} title="Sem volume no período" description="Nenhum atendente recebeu conversas." />
            ) : (
              <ul className="space-y-1.5 pt-1.5">
                {volumeRanking.map((v) => {
                  const p = profiles[v.user_id];
                  const name = p?.display_name || p?.email || "Sem nome";
                  return (
                    <li key={v.user_id} className="space-y-0.5">
                      <div className="grid grid-cols-[24px_1fr_auto_auto] items-center gap-2">
                        <Avatar className="h-5 w-5"><AvatarImage src={p?.avatar_url ?? undefined} /><AvatarFallback className="text-[8px]">{initialsOf(name)}</AvatarFallback></Avatar>
                        <span className="truncate text-xs font-medium">{name}</span>
                        <span className="w-12 text-right text-xs">{v.convs}</span>
                        <span className="w-12 text-right text-xs text-muted-foreground">{v.msgs}</span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-sky-500" style={{ width: `${(v.convs / maxVol) * 100}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader className="p-3 pb-1.5">
            <CardTitle className="flex items-center gap-1.5 text-sm"><Clock className="h-3.5 w-3.5 text-sky-400" />Horários de Pico</CardTitle>
            <p className="text-[10px] text-muted-foreground">Volume por hora — mensagens recebidas</p>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="h-44 w-full">
              {messages.length === 0 ? <EmptyState icon={Clock} title="Sem mensagens no período" /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hoursData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <XAxis dataKey="h" tickLine={false} axisLine={false} interval={2} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} />
                    <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.4)" }} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 11 }} />
                    <Bar dataKey="v" radius={[2, 2, 0, 0]}>
                      {hoursData.map((d: any, i: number) => <Cell key={i} fill={d.peak ? "hsl(217 91% 60%)" : "hsl(215 20% 55% / 0.55)"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 pb-1.5">
            <CardTitle className="flex items-center gap-1.5 text-sm"><AlertTriangle className="h-3.5 w-3.5 text-amber-400" />SLA — Conversas Aguardando</CardTitle>
            <p className="text-[10px] text-muted-foreground">{m.awaitingCount} conversas aguardando agora</p>
          </CardHeader>
          <CardContent className="space-y-2.5 p-3 pt-0">
            {slaTotal === 0 ? <EmptyState icon={ShieldCheck} title="Nenhuma conversa aguardando" description="Todas as conversas estão respondidas." />
              : slaItems.map((s) => {
                const pct = slaTotal ? (s.value / slaTotal) * 100 : 0;
                return (
                  <div key={s.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs"><span>{s.label}</span><span className="text-muted-foreground">{s.value} ({pct.toFixed(0)}%)</span></div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${ACCENTS[s.tone]}`} style={{ width: `${Math.max(pct, s.value > 0 ? 2 : 0)}%` }} /></div>
                  </div>
                );
              })}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

/* ============================================================ PERFORMANCE ============================================================ */
function PerformanceView({ deals, stages, pipelineId, range }: any) {
  const m = useMemo(() => buildPerformanceMetrics(deals, range), [deals, range]);
  const ranking = useMemo(() => buildSellerRanking(deals, range), [deals, range]);
  const userIds = useMemo(() => ranking.map((r) => r.user_id), [ranking]);
  const { data: profiles = {} } = useDashboardProfiles(userIds);

  const stagesFiltered = useMemo(() => pipelineId === "all" ? stages : stages.filter((s: any) => s.pipeline_id === pipelineId), [stages, pipelineId]);
  const funnel = useMemo(() => stagesFiltered.map((s: any) => ({
    name: s.name, color: s.color || "hsl(217 91% 60%)",
    qty: deals.filter((d: any) => d.stage_id === s.id).length,
  })), [stagesFiltered, deals]);

  if (deals.length === 0) {
    return <EmptyState icon={TrendingUp} title="Sem deals no funil" description="Crie deals no funil para ver métricas de performance." action={<Link to="/funil"><Button size="sm">Ir para o funil</Button></Link>} />;
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MetricCard tone="success" label="Deals fechados" value={String(m.won.length)} icon={<Trophy className="h-3.5 w-3.5 text-emerald-400" />} />
        <MetricCard tone="danger" label="Deals perdidos" value={String(m.lost.length)} icon={<TrendingDown className="h-3.5 w-3.5 text-rose-400" />} />
        <MetricCard tone="info" label="Taxa de conversão" value={`${m.conv.toFixed(1)}%`}
          footer={<span className="text-[10px] text-muted-foreground">{m.won.length}/{m.won.length + m.lost.length} fechados</span>} icon={<Target className="h-3.5 w-3.5 text-sky-400" />} />
        <MetricCard tone="purple" label="Ticket médio" value={fmtMoney(m.ticketCents)} icon={<ShoppingCart className="h-3.5 w-3.5 text-violet-400" />} />
        <MetricCard tone="success" label="Receita total" value={fmtMoney(m.revenueCents)} icon={<DollarSign className="h-3.5 w-3.5 text-emerald-400" />} />
        <MetricCard tone="warning" label="Tempo de ciclo" value={m.won.length === 0 ? "—" : `${m.avgCycle.toFixed(1)}d`}
          footer={<span className="text-[10px] text-muted-foreground">Da criação ao ganho</span>} icon={<Timer className="h-3.5 w-3.5 text-amber-400" />} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader className="p-3 pb-1.5">
            <CardTitle className="flex items-center gap-1.5 text-sm"><Trophy className="h-3.5 w-3.5 text-amber-400" />Ranking de Vendedores</CardTitle>
            <p className="text-[10px] text-muted-foreground">Por receita no período</p>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {ranking.length === 0 ? <EmptyState icon={Trophy} title="Sem vendedores com deals fechados no período" />
              : <ul className="divide-y divide-border/40">
                {[...ranking].sort((a, b) => b.revenueCents - a.revenueCents).map((r, i) => {
                  const p = profiles[r.user_id];
                  const name = p?.display_name || p?.email || "Sem nome";
                  return (
                    <li key={r.user_id} className="grid grid-cols-[24px_28px_1fr_auto_auto] items-center gap-2 py-1.5">
                      <span className="text-xs text-muted-foreground">{i + 1}</span>
                      <Avatar className="h-6 w-6"><AvatarImage src={p?.avatar_url ?? undefined} /><AvatarFallback className="text-[9px]">{initialsOf(name)}</AvatarFallback></Avatar>
                      <span className="truncate text-xs font-medium">{name}</span>
                      <span className="text-xs text-muted-foreground">{r.won}W/{r.lost}L · {r.taxa.toFixed(0)}%</span>
                      <Badge variant="secondary" className="text-[10px] font-semibold">{fmtMoney(r.revenueCents)}</Badge>
                    </li>
                  );
                })}
              </ul>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 pb-1.5">
            <CardTitle className="text-sm">Funil de Conversão</CardTitle>
            <p className="text-[10px] text-muted-foreground">Deals por etapa</p>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnel} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 11 }} />
                  <Bar dataKey="qty" radius={[3, 3, 0, 0]}>
                    {funnel.map((e: any, i: number) => <Cell key={i} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

/* ============================================================ CONVERSÕES ============================================================ */
function ConversoesView({ contacts, deals, conversations, range }: any) {
  const m = useMemo(() => buildConversoesMetrics(contacts, deals, conversations, range), [contacts, deals, conversations, range]);
  const total = m.origins.reduce((s: number, o: any) => s + o.contacts, 0);
  const pieData = m.origins.map((o: any) => ({ name: ORIGIN_LABEL[o.name] ?? o.name, v: o.contacts, color: ORIGIN_COLOR(o.name) }));

  return (
    <>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MetricCard tone="info" label="Conversão geral" value={`${m.taxa.toFixed(1)}%`}
          footer={<span className="text-[10px] text-muted-foreground">{m.convertedCount} de {m.contactsCount} leads</span>} icon={<TrendingUp className="h-3.5 w-3.5 text-sky-400" />} />
        <MetricCard tone="purple" label="Total de leads" value={String(m.contactsCount)}
          footer={<span className="text-[10px] text-muted-foreground">{m.origins.length} origens</span>} icon={<Users className="h-3.5 w-3.5 text-violet-400" />} />
        <MetricCard tone="success" label="Leads convertidos" value={String(m.convertedCount)}
          footer={<span className="text-[10px] text-muted-foreground">vendas fechadas</span>} icon={<Target className="h-3.5 w-3.5 text-emerald-400" />} />
        <MetricCard tone="success" label="Receita atribuída" value={fmtMoney(m.revenueCents)} icon={<DollarSign className="h-3.5 w-3.5 text-emerald-400" />} />
      </div>

      {m.contactsCount === 0 ? <EmptyState icon={Users} title="Sem leads no período" description="Nenhum contato foi criado no período selecionado." /> : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <CardHeader className="p-3 pb-1.5">
                <CardTitle className="flex items-center gap-1.5 text-sm"><PieIcon className="h-3.5 w-3.5 text-sky-400" />Distribuição por Origem</CardTitle>
                <p className="text-[10px] text-muted-foreground">De onde vêm seus leads</p>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="v" nameKey="name" innerRadius={50} outerRadius={80}
                        label={(e: any) => `${e.name}: ${e.v} (${Math.round((e.v / (total || 1)) * 100)}%)`} labelLine={false} style={{ fontSize: 10 }}>
                        {pieData.map((o: any, i: number) => <Cell key={i} fill={o.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3 pb-1.5">
                <CardTitle className="flex items-center gap-1.5 text-sm"><Target className="h-3.5 w-3.5 text-emerald-400" />Taxa de Conversão por Origem</CardTitle>
                <p className="text-[10px] text-muted-foreground">Compare a eficiência de cada canal</p>
              </CardHeader>
              <CardContent className="space-y-2.5 p-3 pt-0">
                {m.origins.map((o: any) => {
                  const taxa = o.contacts ? (o.won / o.contacts) * 100 : 0;
                  const color = ORIGIN_COLOR(o.name);
                  return (
                    <div key={o.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: color }} />{ORIGIN_LABEL[o.name] ?? o.name}</span>
                        <span className="flex items-center gap-2 text-muted-foreground"><span>{o.won}/{o.contacts}</span><Badge variant="outline" className="h-5 px-1.5 text-[10px]">{taxa.toFixed(1)}%</Badge></span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${taxa}%`, background: color }} /></div>
                    </div>
                  );
                })}
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
                  <BarChart data={m.origins.map((o: any) => ({ name: ORIGIN_LABEL[o.name] ?? o.name, leads: o.contacts, conv: o.won }))} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 11 }} />
                    <Bar dataKey="leads" fill="hsl(217 91% 60%)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="conv" fill="hsl(142 71% 45%)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}

/* ============================================================ ADS ============================================================ */
function AdsView({ contacts, deals, conversations, range }: any) {
  const m = useMemo(() => buildAdsMetrics(contacts, deals, conversations, range), [contacts, deals, conversations, range]);

  if (m.leadsCount === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-10">
          <EmptyState icon={BarChart3} title="Nenhum lead de anúncios ainda"
            description="Conecte seus anúncios Meta/Google para rastrear leads vindos de campanhas pagas."
            action={<Link to="/settings/trackeamento"><Button size="sm">Configurar rastreamento</Button></Link>} />
        </CardContent>
      </Card>
    );
  }

  const taxa = m.leadsCount ? (m.convCount / m.leadsCount) * 100 : 0;
  const top = [...m.platforms].sort((a, b) => b.contacts - a.contacts)[0];

  return (
    <>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MetricCard tone="info" label="Leads de Ads" value={String(m.leadsCount)} icon={<Users className="h-3.5 w-3.5 text-sky-400" />} />
        <MetricCard tone="success" label="Conversões" value={String(m.convCount)}
          footer={<span className="text-[10px] text-muted-foreground">{taxa.toFixed(1)}% de conversão</span>} icon={<Target className="h-3.5 w-3.5 text-emerald-400" />} />
        <MetricCard tone="success" label="Receita de Ads" value={fmtMoney(m.revenueCents)} icon={<DollarSign className="h-3.5 w-3.5 text-emerald-400" />} />
        <MetricCard tone="purple" label="Ticket médio Ads" value={fmtMoney(m.ticketCents)} icon={<ShoppingCart className="h-3.5 w-3.5 text-violet-400" />} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="border-amber-500/40">
          <CardHeader className="p-3 pb-1.5">
            <CardTitle className="flex items-center gap-1.5 text-sm"><Trophy className="h-3.5 w-3.5 text-amber-400" />Top Performer</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {top ? <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400"><Megaphone className="h-5 w-5" /></div>
              <div className="flex-1">
                <div className="text-sm font-semibold">{ORIGIN_LABEL[top.name] ?? top.name}</div>
                <div className="mt-2 flex gap-2">
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px]">{top.contacts} leads</Badge>
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px]">{top.won} conversões</Badge>
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px]">{fmtMoney(top.revenueCents)}</Badge>
                </div>
              </div>
            </div> : <EmptyState icon={Trophy} title="Sem dados" />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 pb-1.5">
            <CardTitle className="flex items-center gap-1.5 text-sm"><BarChart3 className="h-3.5 w-3.5 text-sky-400" />Leads por Plataforma</CardTitle>
            <p className="text-[10px] text-muted-foreground">Distribuição por origem</p>
          </CardHeader>
          <CardContent className="space-y-2 p-3 pt-0">
            {m.platforms.map((p: any) => {
              const pct = m.leadsCount ? (p.contacts / m.leadsCount) * 100 : 0;
              const color = ORIGIN_COLOR(p.name);
              return (
                <div key={p.name} className="space-y-0.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{ORIGIN_LABEL[p.name] ?? p.name}</span>
                    <span className="text-muted-foreground">{p.contacts} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} /></div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

/* ============================================================ Shared ============================================================ */
function MetricCard({ tone, label, value, footer, icon, delta }: {
  tone: AccentTone; label: string; value: React.ReactNode; footer?: React.ReactNode; icon?: React.ReactNode; delta?: { text: string; down?: boolean };
}) {
  return (
    <Card className="relative overflow-hidden">
      <span className={`absolute inset-y-0 left-0 w-1 ${ACCENTS[tone]}`} />
      <CardContent className="p-2.5 pl-3">
        <div className="flex items-start justify-between gap-1.5">
          <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
          {icon && <div className="rounded bg-muted/50 p-1">{icon}</div>}
        </div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <div className={`text-xl font-bold leading-tight ${VALUE_TONE[tone]}`}>{value}</div>
          {delta && <span className={`text-[10px] font-medium ${delta.down ? "text-emerald-400" : "text-rose-400"}`}>{delta.down ? "▼" : "▲"}{delta.text}</span>}
        </div>
        {footer && <div className="mt-1">{footer}</div>}
      </CardContent>
    </Card>
  );
}
