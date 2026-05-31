import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MessageSquare, CheckCircle2, Timer, AlertTriangle, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDashboardFilters } from "@/contexts/DashboardFiltersContext";
import {
  useSlaBySeller,
  useChatsAccumulated7d,
  useMessagesDaily7d,
  useServiceTime7d,
} from "@/hooks/useDashboard";

const num = (n: number) => new Intl.NumberFormat("pt-BR").format(n ?? 0);

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
function fmtDay(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return `${WEEKDAYS[d.getDay()]}-${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

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

function fmtMinutes(mins: number | null | undefined) {
  if (mins == null) return "—";
  if (mins < 60) return `${Math.round(mins)}m`;
  const h = mins / 60;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}
function fmtHours(h: number | null | undefined) {
  if (h == null) return "—";
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}
function fmtDays(d: number | null | undefined) {
  if (d == null) return "—";
  if (d < 1) return `${Math.round(d * 24)}h`;
  return `${d.toFixed(1)}d`;
}

function MiniAreaChart({
  data, dataKey, color, format,
}: { data: any[]; dataKey: string; color: string; format: (v: any) => string }) {
  return (
    <div className="h-[140px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`g-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
          <YAxis hide />
          <Tooltip
            contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
            formatter={(v: any) => [format(v), ""]}
            labelFormatter={(l: any) => l}
          />
          <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill={`url(#g-${dataKey})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ServiceTimeCell({
  title, badgeClass, color, data, dataKey, format, avgLabel,
}: { title: string; badgeClass: string; color: string; data: any[]; dataKey: string; format: (v: any) => string; avgLabel: string }) {
  const vals = data.map(d => d[dataKey]).filter((v): v is number => v != null);
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  return (
    <div className="rounded-lg border bg-card/40 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <Badge className={badgeClass}>{title}</Badge>
        <span className="text-sm font-semibold tabular-nums">{format(avg)}</span>
      </div>
      <div className="text-[11px] text-muted-foreground">{avgLabel}</div>
      <MiniAreaChart data={data} dataKey={dataKey} color={color} format={format} />
    </div>
  );
}

export function AtendimentoView() {
  const { filters } = useDashboardFilters();
  const { data: rows, isLoading } = useSlaBySeller(filters);
  const { data: chats, isLoading: lChats } = useChatsAccumulated7d(filters);
  const { data: msgs, isLoading: lMsgs } = useMessagesDaily7d(filters);
  const { data: stime, isLoading: lST } = useServiceTime7d(filters);

  const totals = (rows ?? []).reduce(
    (acc, r) => {
      acc.conv += r.conversas ?? 0;
      acc.res += r.resolvidas ?? 0;
      acc.resp += (r.avg_response_minutes ?? 0) * (r.conversas ?? 0);
      acc.respN += (r.avg_response_minutes != null ? r.conversas ?? 0 : 0);
      acc.pend += r.pendentes_24h ?? 0;
      return acc;
    },
    { conv: 0, res: 0, resp: 0, respN: 0, pend: 0 }
  );
  const abertas = totals.conv - totals.res;
  const avgResp = totals.respN ? Math.round(totals.resp / totals.respN) : 0;

  const chatsData = (chats ?? []).map(c => ({ ...c, label: fmtDay(c.day) }));
  const msgsData = (msgs ?? []).map(m => ({ ...m, label: fmtDay(m.day) }));
  const stimeData = (stime ?? []).map(s => ({ ...s, label: fmtDay(s.day) }));

  const sentSum = msgsData.reduce((a, m) => a + (m.sent_count ?? 0), 0);
  const recvSum = msgsData.reduce((a, m) => a + (m.received_count ?? 0), 0);
  const sentAvg = msgsData.length ? Math.round(sentSum / msgsData.length) : 0;
  const recvAvg = msgsData.length ? Math.round(recvSum / msgsData.length) : 0;

  return (
    <div className="p-6 space-y-6">
      {/* 1) KPIs SLA */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={MessageSquare} label="Conversas abertas" value={num(abertas)} />
        <KpiCard icon={CheckCircle2} label="Resolvidas (30d)" value={num(totals.res)} />
        <KpiCard icon={Timer} label="SLA 1ª resposta (min)" value={num(avgResp)} />
        <KpiCard icon={AlertTriangle} label="Abertas > 24h" value={num(totals.pend)} accent="text-destructive" />
      </div>

      {/* 2) Chats Acumulado 7d */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Chats - Acumulado</CardTitle>
          <Button variant="outline" size="sm">Ver Gráficos</Button>
        </CardHeader>
        <CardContent>
          {lChats ? <Skeleton className="h-[240px]" /> : (
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chatsData} margin={{ top: 20, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  />
                  <Bar dataKey="accumulated_count" fill="hsl(var(--primary))" radius={[4,4,0,0]}>
                    <LabelList dataKey="accumulated_count" position="top" fontSize={10} fill="hsl(var(--muted-foreground))" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3) Mensagens 7d */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Mensagens (últimos 7 dias)</CardTitle>
        </CardHeader>
        <CardContent>
          {lMsgs ? <Skeleton className="h-[280px]" /> : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                    <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" /> Enviadas
                  </div>
                  <div className="text-3xl font-semibold tabular-nums text-emerald-500">{num(sentSum)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Média/Dia: <span className="text-emerald-500 font-medium">{num(sentAvg)}</span></div>
                </div>
                <div className="border-t" />
                <div>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                    <ArrowDownLeft className="h-3.5 w-3.5 text-primary" /> Recebidas
                  </div>
                  <div className="text-3xl font-semibold tabular-nums text-primary">{num(recvSum)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Média/Dia: <span className="text-primary font-medium">{num(recvAvg)}</span></div>
                </div>
              </div>
              <div className="lg:col-span-2 h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={msgsData} margin={{ top: 20, right: 10, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                      contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                    />
                    <Bar dataKey="sent_count" name="Enviadas" fill="hsl(142 71% 45%)" radius={[4,4,0,0]}>
                      <LabelList dataKey="sent_count" position="top" fontSize={10} fill="hsl(var(--muted-foreground))" />
                    </Bar>
                    <Bar dataKey="received_count" name="Recebidas" fill="hsl(var(--primary))" radius={[4,4,0,0]}>
                      <LabelList dataKey="received_count" position="top" fontSize={10} fill="hsl(var(--muted-foreground))" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4) Tempo de Atendimento 7d */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tempo de Atendimento - 7 últimos dias</CardTitle>
        </CardHeader>
        <CardContent>
          {lST ? <Skeleton className="h-[420px]" /> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ServiceTimeCell
                title="ABERTO"
                badgeClass="bg-destructive/15 text-destructive hover:bg-destructive/15 border border-destructive/30"
                color="hsl(var(--destructive))"
                data={stimeData}
                dataKey="open_avg_minutes"
                format={(v) => fmtMinutes(v)}
                avgLabel="Tempo médio que o chat permanece com o status ABERTO"
              />
              <ServiceTimeCell
                title="EM ATENDIMENTO"
                badgeClass="bg-blue-500/15 text-blue-500 hover:bg-blue-500/15 border border-blue-500/30"
                color="hsl(217 91% 60%)"
                data={stimeData}
                dataKey="in_progress_avg_hours"
                format={(v) => fmtHours(v)}
                avgLabel="Tempo médio EM ATENDIMENTO"
              />
              <ServiceTimeCell
                title="AGUARDANDO"
                badgeClass="bg-yellow-500/15 text-yellow-600 hover:bg-yellow-500/15 border border-yellow-500/30"
                color="hsl(45 93% 47%)"
                data={stimeData}
                dataKey="waiting_avg_hours"
                format={(v) => fmtHours(v)}
                avgLabel="Tempo médio AGUARDANDO"
              />
              <ServiceTimeCell
                title="RESOLVIDO/FECHADO"
                badgeClass="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15 border border-emerald-500/30"
                color="hsl(142 71% 45%)"
                data={stimeData}
                dataKey="resolved_avg_days"
                format={(v) => fmtDays(v)}
                avgLabel="Tempo médio até RESOLVIDO"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5) SLA por vendedor */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-base">SLA por vendedor</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-48" /> : (rows ?? []).length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center border rounded-lg">Sem dados.</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Vendedor</th>
                    <th className="text-right px-3 py-2 font-medium">Conversas</th>
                    <th className="text-right px-3 py-2 font-medium">Resolvidas</th>
                    <th className="text-right px-3 py-2 font-medium">Resp média</th>
                    <th className="text-right px-3 py-2 font-medium">Pendentes &gt; 24h</th>
                  </tr>
                </thead>
                <tbody>
                  {rows!.map((r) => (
                    <tr key={r.user_id} className="border-t">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={r.avatar_url ?? undefined} />
                            <AvatarFallback className="text-[10px]">{(r.display_name ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span>{r.display_name ?? "—"}</span>
                        </div>
                      </td>
                      <td className="text-right tabular-nums px-3 py-2">{num(r.conversas)}</td>
                      <td className="text-right tabular-nums px-3 py-2">{num(r.resolvidas)}</td>
                      <td className="text-right tabular-nums px-3 py-2">{r.avg_response_minutes != null ? `${Math.round(r.avg_response_minutes)} min` : "—"}</td>
                      <td className={`text-right tabular-nums px-3 py-2 ${r.pendentes_24h > 0 ? "text-destructive font-medium" : ""}`}>{num(r.pendentes_24h)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
