import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as ChartTooltip, CartesianGrid } from "recharts";
import {
  Search, Filter, Calendar as CalendarIcon, Plus, MoreHorizontal, ArrowUpDown,
  Banknote, TrendingUp, AlertCircle, Receipt, Gauge, RotateCw, Ban, CheckCircle2, Undo2, X, Download,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import {
  usePaymentsKpis, usePaymentsForecast, usePaymentsCommissions, usePaymentsStatusCounts,
  usePayments, useUpdatePayment, type PaymentFilters, type PaymentRow,
} from "@/hooks/usePayments";
import { STATUS_META, METHOD_META, GATEWAYS, METHODS, STATUS_TABS } from "@/features/payments/paymentMeta";
import { NewPaymentDialog } from "@/features/payments/NewPaymentDialog";
import { DetalheCobrancaDrawer } from "@/features/payments/DetalheCobrancaDrawer";
import { SellerSelect } from "@/components/sellers/SellerSelect";

function brl(c?: number | null) {
  return ((c ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function KpiCard({ icon: Icon, label, value, sub, accent, loading, progress }: {
  icon: any; label: string; value: string; sub?: string;
  accent?: "default" | "destructive" | "success" | "primary"; loading?: boolean; progress?: number;
}) {
  const accentCls = accent === "destructive" ? "text-destructive bg-destructive/10"
    : accent === "success" ? "text-emerald-600 bg-emerald-500/10"
    : accent === "primary" ? "text-primary bg-primary/10"
    : "text-foreground bg-muted";
  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className={cn("h-8 w-8 rounded-md flex items-center justify-center", accentCls)}><Icon className="h-4 w-4" /></div>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      {loading ? <Skeleton className="h-7 w-28" /> : <div className="text-2xl font-semibold tabular-nums">{value}</div>}
      {!loading && sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      {typeof progress === "number" && (
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
      )}
    </Card>
  );
}

function initials(s?: string | null) { return (s ?? "?").trim().slice(0, 1).toUpperCase(); }

export default function Payments() {
  const navigate = useNavigate();
  const kpis = usePaymentsKpis();
  const forecast = usePaymentsForecast();
  const commissions = usePaymentsCommissions();
  const statusCounts = usePaymentsStatusCounts();

  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<{ key: string; from?: string; to?: string }>({ key: "all" });
  const [draftRange, setDraftRange] = useState<{ from?: Date; to?: Date }>({});
  const [gateways, setGateways] = useState<string[]>([]);
  const [methods, setMethods] = useState<string[]>([]);
  const [sellers, setSellers] = useState<string[]>([]);
  const [minV, setMinV] = useState("");
  const [maxV, setMaxV] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openNew, setOpenNew] = useState(false);
  const [detail, setDetail] = useState<PaymentRow | null>(null);

  const filters: PaymentFilters = useMemo(() => ({
    status, search: search.trim() || undefined,
    gateways: gateways.length ? gateways : undefined,
    methods: methods.length ? methods : undefined,
    sellers: sellers.length ? sellers : undefined,
    minCents: minV ? Math.round(parseFloat(minV.replace(",", ".")) * 100) : undefined,
    maxCents: maxV ? Math.round(parseFloat(maxV.replace(",", ".")) * 100) : undefined,
    from: period.from, to: period.to, sortBy, sortDir,
  }), [status, search, gateways, methods, sellers, minV, maxV, period, sortBy, sortDir]);

  const list = usePayments(filters);
  const update = useUpdatePayment();
  const k = kpis.data;

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("desc"); }
  };

  const toggleAll = (checked: boolean) => {
    if (!checked) setSelected(new Set());
    else setSelected(new Set((list.data ?? []).map((r) => r.id)));
  };

  const setPeriodPreset = (key: string) => {
    const now = new Date();
    let from: Date | undefined; let to: Date | undefined = new Date();
    if (key === "today") from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    else if (key === "week") { from = new Date(now); from.setDate(now.getDate() - 7); }
    else if (key === "month") from = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (key === "30d") { from = new Date(now); from.setDate(now.getDate() - 30); }
    else { from = undefined; to = undefined; }
    setPeriod({ key, from: from?.toISOString(), to: to?.toISOString() });
  };

  const clearAllFilters = () => {
    setGateways([]); setMethods([]); setSellers([]); setMinV(""); setMaxV("");
  };

  const bulkAction = async (action: "retry" | "cancel" | "refund" | "markPaid") => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    try {
      await update.mutateAsync({ id: ids[0], action, ids });
      toast.success("Atualizado");
      setSelected(new Set());
    } catch (e: any) { toast.error(e.message ?? "Erro"); }
  };

  const exportCsv = (rows: PaymentRow[]) => {
    const header = ["id", "customer", "valor", "status", "metodo", "gateway", "vencimento", "pago_em"];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push([r.id, r.customer_name ?? "", (r.amount_cents / 100).toFixed(2), r.status, r.method ?? "",
        r.gateway ?? "", r.due_date ?? "", r.paid_at ?? ""].map((x) => `"${String(x).replace(/"/g, '""')}"`).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "cobrancas.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const forecastData = (forecast.data ?? []).map((d: any) => ({
    date: format(new Date(d.due_date), "dd/MM"),
    valor: Number(d.expected_cents ?? 0) / 100,
    qtd: d.expected_count,
  }));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Pagamentos</h1>
        <p className="text-sm text-muted-foreground">Dashboard financeiro completo</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard icon={Banknote} label="Recebido este mês" value={brl(k?.paid_cents_month)}
          sub={`${k?.paid_count_month ?? 0} cobranças`} accent="success" loading={kpis.isLoading} />
        <KpiCard icon={TrendingUp} label="A receber" value={brl(k?.pending_cents)}
          sub={`${k?.pending_count ?? 0} em aberto`} accent="primary" loading={kpis.isLoading} />
        <KpiCard icon={AlertCircle} label="Vencidas" value={brl(k?.overdue_cents)}
          sub={`${k?.overdue_count ?? 0} em atraso`} accent="destructive" loading={kpis.isLoading} />
        <KpiCard icon={Receipt} label="Ticket médio (30d)" value={brl(k?.avg_ticket_cents_30d)} loading={kpis.isLoading} />
        <KpiCard icon={Gauge} label="Taxa aprovação (30d)" value={`${Number(k?.approval_rate_30d ?? 0).toFixed(1)}%`}
          accent="primary" progress={Number(k?.approval_rate_30d ?? 0)} loading={kpis.isLoading} />
      </div>

      {/* Forecast + Top sellers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold mb-3">Previsão de Recebimento (próximos 30 dias)</h3>
          <div className="h-64">
            {forecast.isLoading ? <Skeleton className="h-full w-full" /> :
              forecastData.length === 0 ? <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sem previsão</div> :
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={forecastData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11}
                    tickFormatter={(v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })} />
                  <ChartTooltip
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                    formatter={(v: any, n: string) => n === "valor" ? brl(Math.round(Number(v) * 100)) : v}
                    labelFormatter={(l) => `Dia ${l}`}
                  />
                  <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            }
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Top vendedores (30d)</h3>
          {commissions.isLoading ? <Skeleton className="h-40 w-full" /> :
            (commissions.data ?? []).length === 0 ? <p className="text-xs text-muted-foreground">Sem dados</p> :
            <ul className="space-y-2">
              {(commissions.data ?? []).map((c: any) => (
                <li key={c.assigned_user_id}>
                  <button className="w-full flex items-center gap-3 hover:bg-muted/50 rounded-md p-2 text-left transition-colors"
                    onClick={() => navigate(`/metas?vendedor=${c.assigned_user_id}`)}>
                    <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">{initials(c.seller_name)}</AvatarFallback></Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.seller_name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{c.paid_count} pagas</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">{brl(c.total_paid_cents)}</span>
                  </button>
                </li>
              ))}
            </ul>
          }
        </Card>
      </div>

      {/* Toolbar + Table */}
      <Card className="overflow-hidden">
        <div className="p-3 border-b flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Pesquise por cliente, número ou descrição" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5"><CalendarIcon className="h-3.5 w-3.5" /> por período</Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] space-y-2">
              {[
                ["all", "Sem filtro"], ["today", "Hoje"], ["week", "Esta semana"],
                ["month", "Este mês"], ["30d", "Últimos 30 dias"],
              ].map(([k, l]) => (
                <Button key={k} variant={period.key === k ? "secondary" : "ghost"} size="sm"
                  className="w-full justify-start" onClick={() => setPeriodPreset(k)}>{l}</Button>
              ))}
              <div className="border-t pt-2 space-y-2">
                <p className="text-xs text-muted-foreground">Intervalo customizado</p>
                <div className="grid grid-cols-2 gap-2">
                  <Popover><PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="justify-start">{draftRange.from ? format(draftRange.from, "dd/MM") : "De"}</Button>
                  </PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={draftRange.from} onSelect={(d) => setDraftRange((r) => ({ ...r, from: d }))} className="p-3 pointer-events-auto" /></PopoverContent></Popover>
                  <Popover><PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="justify-start">{draftRange.to ? format(draftRange.to, "dd/MM") : "Até"}</Button>
                  </PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={draftRange.to} onSelect={(d) => setDraftRange((r) => ({ ...r, to: d }))} className="p-3 pointer-events-auto" /></PopoverContent></Popover>
                </div>
                <Button size="sm" className="w-full" disabled={!draftRange.from || !draftRange.to}
                  onClick={() => setPeriod({ key: "custom", from: draftRange.from?.toISOString(), to: draftRange.to?.toISOString() })}>
                  Aplicar intervalo
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5"><Filter className="h-3.5 w-3.5" /> filtros
                {(gateways.length + methods.length + sellers.length + (minV ? 1 : 0) + (maxV ? 1 : 0)) > 0 &&
                  <Badge variant="secondary" className="ml-1 h-5">{gateways.length + methods.length + sellers.length + (minV ? 1 : 0) + (maxV ? 1 : 0)}</Badge>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[480px] space-y-3">
              <div>
                <p className="text-xs font-medium mb-1.5">Gateway</p>
                <div className="flex flex-wrap gap-1.5">
                  {GATEWAYS.map((g) => (
                    <Badge key={g} variant={gateways.includes(g) ? "default" : "outline"} className="cursor-pointer"
                      onClick={() => setGateways((s) => s.includes(g) ? s.filter((x) => x !== g) : [...s, g])}>{g}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium mb-1.5">Método</p>
                <div className="flex flex-wrap gap-1.5">
                  {METHODS.map((m) => (
                    <Badge key={m} variant={methods.includes(m) ? "default" : "outline"} className="cursor-pointer"
                      onClick={() => setMethods((s) => s.includes(m) ? s.filter((x) => x !== m) : [...s, m])}>{METHOD_META[m]?.label ?? m}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium mb-1.5">Vendedor</p>
                <SellerSelect value={sellers[0] ?? ""} onValueChange={(v) => setSellers(v ? [v] : [])} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><p className="text-xs font-medium mb-1.5">Valor mínimo (R$)</p><Input value={minV} onChange={(e) => setMinV(e.target.value)} /></div>
                <div><p className="text-xs font-medium mb-1.5">Valor máximo (R$)</p><Input value={maxV} onChange={(e) => setMaxV(e.target.value)} /></div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={clearAllFilters}>Limpar</Button>
              </div>
            </PopoverContent>
          </Popover>

          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" className="gap-1.5" onClick={() => setOpenNew(true)}><Plus className="h-3.5 w-3.5" /> Nova cobrança</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportCsv(list.data ?? [])}><Download className="h-3.5 w-3.5 mr-2" /> Exportar CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast("Em breve")}>Exportar Excel</DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.print()}>Imprimir</DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast("Em breve")}>Conciliar bancário</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <Tabs value={status} onValueChange={setStatus}>
          <div className="px-3 pt-2 border-b">
            <TabsList className="bg-transparent p-0 h-auto gap-1 flex-wrap">
              {STATUS_TABS.map((t) => (
                <TabsTrigger key={t.key} value={t.key}
                  className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md px-3 py-1.5 text-xs gap-1.5">
                  {t.label}
                  <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{statusCounts.data?.[t.key] ?? 0}</Badge>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={selected.size > 0 && selected.size === (list.data?.length ?? 0)} onCheckedChange={(c) => toggleAll(!!c)} />
                </TableHead>
                {[
                  ["status", "Status"], ["customer_name", "Cliente"], ["amount_cents", "Valor"],
                  ["method", "Método"], ["gateway", "Gateway"], ["assigned_user_id", "Vendedor"],
                  ["due_date", "Vencimento"], ["paid_at", "Pago em"], ["next_retry_at", "Próx. tentativa"],
                ].map(([k, l]) => (
                  <TableHead key={k}>
                    <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort(k)}>
                      {l}<ArrowUpDown className="h-3 w-3 opacity-50" />
                    </button>
                  </TableHead>
                ))}
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 11 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                ))
              ) : (list.data ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center text-sm text-muted-foreground py-12">Nenhuma cobrança encontrada</TableCell></TableRow>
              ) : (list.data ?? []).map((r) => {
                const meta = STATUS_META[r.status] ?? STATUS_META.pending;
                const M = r.method ? METHOD_META[r.method] : null;
                return (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => setDetail(r)}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selected.has(r.id)} onCheckedChange={(c) => {
                        const s = new Set(selected); c ? s.add(r.id) : s.delete(r.id); setSelected(s);
                      }} />
                    </TableCell>
                    <TableCell><Badge variant="outline" className={meta.cls}>{meta.label}</Badge></TableCell>
                    <TableCell className="font-medium">{r.customer_name ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{brl(r.amount_cents)}</TableCell>
                    <TableCell>{M && <Badge variant="outline" className="gap-1"><M.icon className="h-3 w-3" />{M.label}</Badge>}</TableCell>
                    <TableCell><span className="text-xs">{r.gateway ?? "—"}</span></TableCell>
                    <TableCell>
                      {r.seller_name && <div className="flex items-center gap-1.5">
                        <Avatar className="h-5 w-5"><AvatarFallback className="text-[10px]">{initials(r.seller_name)}</AvatarFallback></Avatar>
                        <span className="text-xs">{r.seller_name}</span>
                      </div>}
                    </TableCell>
                    <TableCell className="text-xs">{r.due_date ? format(new Date(r.due_date), "dd/MM/yyyy") : "—"}</TableCell>
                    <TableCell className="text-xs">{r.paid_at ? format(new Date(r.paid_at), "dd/MM/yyyy HH:mm") : "—"}</TableCell>
                    <TableCell className="text-xs">{r.next_retry_at ? format(new Date(r.next_retry_at), "dd/MM HH:mm") : "—"}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setDetail(r)}>Ver detalhes</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => update.mutate({ id: r.id, action: "retry" })}>Reenviar link</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => update.mutate({ id: r.id, action: "cancel" })}>Cancelar</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => update.mutate({ id: r.id, action: "refund" })}>Estornar</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => update.mutate({ id: r.id, action: "markPaid" })}>Marcar pago</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="sticky bottom-0 z-30 -mx-6 -mb-6 mt-4">
          <div className="mx-auto max-w-3xl bg-card border-t shadow-lg rounded-t-lg px-4 py-3 flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium mr-2">↑ {selected.size} selecionada{selected.size > 1 ? "s" : ""}</span>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => bulkAction("retry")}><RotateCw className="h-3.5 w-3.5" /> Reenviar</Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => bulkAction("cancel")}><Ban className="h-3.5 w-3.5" /> Cancelar</Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => bulkAction("refund")}><Undo2 className="h-3.5 w-3.5" /> Estornar</Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => bulkAction("markPaid")}><CheckCircle2 className="h-3.5 w-3.5" /> Marcar pago</Button>
            <Button size="sm" variant="outline" className="gap-1.5"
              onClick={() => exportCsv((list.data ?? []).filter((r) => selected.has(r.id)))}>
              <Download className="h-3.5 w-3.5" /> Exportar
            </Button>
            <Button size="sm" variant="ghost" className="ml-auto gap-1.5" onClick={() => setSelected(new Set())}><X className="h-3.5 w-3.5" /> Limpar</Button>
          </div>
        </div>
      )}

      <NewPaymentDialog open={openNew} onOpenChange={setOpenNew} />
      <DetalheCobrancaDrawer open={!!detail} onOpenChange={(v) => !v && setDetail(null)} payment={detail} />
    </div>
  );
}
