import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Copy, Send, ExternalLink, X, Loader2, Search, Filter, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useCancelPaymentLink, useGateways, usePaymentLinks } from "@/features/payments/hooks";
import type { PaymentLink } from "@/features/payments/types";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "border-amber-500/30 text-amber-600 bg-amber-500/10" },
  paid: { label: "Pago", cls: "border-emerald-500/30 text-emerald-600 bg-emerald-500/10" },
  expired: { label: "Expirado", cls: "border-muted text-muted-foreground" },
  cancelled: { label: "Cancelado", cls: "border-muted text-muted-foreground" },
  failed: { label: "Falha", cls: "border-destructive/30 text-destructive bg-destructive/10" },
};

const STATUS_TABS: { key: string; label: string }[] = [
  { key: "all", label: "todos" },
  { key: "pending", label: "em aberto" },
  { key: "paid", label: "aprovado" },
  { key: "expired", label: "expirado" },
  { key: "cancelled", label: "cancelado" },
  { key: "failed", label: "falha" },
];

const PERIOD_OPTIONS: { key: string; label: string; days: number | null }[] = [
  { key: "7", label: "Últimos 7 dias", days: 7 },
  { key: "30", label: "Últimos 30 dias", days: 30 },
  { key: "90", label: "Últimos 90 dias", days: 90 },
  { key: "all", label: "Todo período", days: null },
];

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function Payments() {
  const [statusTab, setStatusTab] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [periodKey, setPeriodKey] = useState<string>("30");
  const [gatewayId, setGatewayId] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const period = PERIOD_OPTIONS.find((p) => p.key === periodKey) ?? PERIOD_OPTIONS[1];
  const from = period.days ? isoDaysAgo(period.days) : "";

  const { data: gateways = [] } = useGateways();
  // Busca SEM filtro de status para alimentar os counts dos tabs
  const { data: allLinks = [], isLoading } = usePaymentLinks({
    status: "all",
    gateway_id: gatewayId,
    from: from || undefined,
    to: undefined,
  });
  const [selected, setSelected] = useState<PaymentLink | null>(null);
  const cancel = useCancelPaymentLink();

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: allLinks.length };
    for (const l of allLinks) c[l.status] = (c[l.status] ?? 0) + 1;
    return c;
  }, [allLinks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allLinks.filter((l) => {
      if (statusTab !== "all" && l.status !== statusTab) return false;
      if (q) {
        const hay = `${l.customer_name ?? ""} ${l.customer_phone ?? ""} ${l.customer_email ?? ""} ${l.id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allLinks, statusTab, search]);

  const clearFilters = () => {
    setSearch("");
    setPeriodKey("30");
    setGatewayId("all");
    setStatusTab("all");
  };

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pedidos de venda</h1>
          <p className="text-sm text-muted-foreground">Gerencie cobranças, status e envios.</p>
        </div>
      </div>

      {/* Top bar: busca + período + filtros + limpar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[260px] max-w-xl">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquise por cliente ou número"
            className="pl-9"
          />
        </div>

        <Select value={periodKey} onValueChange={setPeriodKey}>
          <SelectTrigger className="w-auto gap-1">
            <CalendarIcon className="w-4 h-4 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((p) => (
              <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              <Filter className="w-4 h-4" /> filtros
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 space-y-3" align="end">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Gateway</label>
              <Select value={gatewayId} onValueChange={setGatewayId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {gateways.map((g) => <SelectItem key={g.id} value={g.id}>{g.display_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </PopoverContent>
        </Popover>

        <Button variant="ghost" size="sm" onClick={clearFilters}>limpar filtros</Button>
      </div>

      {/* Tabs por status */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {STATUS_TABS.map((t) => {
          const active = statusTab === t.key;
          const count = counts[t.key] ?? 0;
          return (
            <button
              key={t.key}
              onClick={() => setStatusTab(t.key)}
              className={cn(
                "px-3 py-2 text-sm border-b-2 -mb-px transition-colors whitespace-nowrap flex items-center gap-1.5",
                active
                  ? "border-primary text-primary font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="capitalize">{t.label}</span>
              <Badge variant="outline" className="text-[10px] h-4 px-1 tabular-nums">{count}</Badge>
            </button>
          );
        })}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Gateway</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expira</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Carregando...</TableCell></TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Nenhum pedido encontrado</TableCell></TableRow>
            )}
            {filtered.map((l) => {
              const s = STATUS_LABEL[l.status] ?? { label: l.status, cls: "" };
              const gw = gateways.find((g) => g.id === l.gateway_id);
              return (
                <TableRow key={l.id} className="cursor-pointer" onClick={() => setSelected(l)}>
                  <TableCell className="text-xs">{format(new Date(l.created_at), "dd/MM HH:mm")}</TableCell>
                  <TableCell className="text-sm">
                    <div className="font-medium">{l.customer_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{l.customer_phone ?? l.customer_email ?? ""}</div>
                  </TableCell>
                  <TableCell className="font-medium">{brl(l.amount_cents)}</TableCell>
                  <TableCell className="text-sm">{gw?.display_name ?? l.provider ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline" className={s.cls}>{s.label}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {l.expires_at ? format(new Date(l.expires_at), "dd/MM HH:mm") : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {l.url && (
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); window.open(l.url!, "_blank"); }}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <DetailsSheet
        link={selected}
        onClose={() => setSelected(null)}
        onCancel={async (id) => { await cancel.mutateAsync(id); toast.success("Link cancelado"); setSelected(null); }}
      />
    </div>
  );
}

function DetailsSheet({ link, onClose, onCancel }: { link: PaymentLink | null; onClose: () => void; onCancel: (id: string) => Promise<void> }) {
  const [sending, setSending] = useState(false);
  if (!link) return null;
  const s = STATUS_LABEL[link.status] ?? { label: link.status, cls: "" };

  const resend = async () => {
    if (!link.url || !link.customer_phone) { toast.error("Sem telefone"); return; }
    setSending(true);
    try {
      const text = `Segue novamente o link de pagamento de ${brl(link.amount_cents)}: ${link.url}`;
      const { error } = await supabase.functions.invoke("uazapi-send", {
        body: { contact_id: link.contact_id, phone: link.customer_phone, type: "text", text },
      });
      if (error) throw error;
      toast.success("Enviado");
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={!!link} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Detalhes do Link</SheetTitle>
          <SheetDescription>Criado em {format(new Date(link.created_at), "dd/MM/yyyy HH:mm")}</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className={s.cls}>{s.label}</Badge>
            <span className="text-2xl font-bold">{brl(link.amount_cents)}</span>
          </div>
          <Card className="p-3 space-y-1 text-sm">
            <div><span className="text-muted-foreground">Cliente:</span> {link.customer_name ?? "—"}</div>
            <div><span className="text-muted-foreground">Telefone:</span> {link.customer_phone ?? "—"}</div>
            <div><span className="text-muted-foreground">Email:</span> {link.customer_email ?? "—"}</div>
            <div><span className="text-muted-foreground">Doc:</span> {link.customer_document ?? "—"}</div>
            <div><span className="text-muted-foreground">Descrição:</span> {link.description ?? "—"}</div>
          </Card>
          {link.url && (
            <Card className="p-3 break-all font-mono text-xs">{link.url}</Card>
          )}
          {link.provider_response && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">Resposta do provider</summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded bg-muted p-2">{JSON.stringify(link.provider_response, null, 2)}</pre>
            </details>
          )}
          <div className="flex gap-2 flex-wrap">
            {link.url && (
              <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(link.url!); toast.success("Copiado"); }}>
                <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
              </Button>
            )}
            <Button size="sm" onClick={resend} disabled={sending || !link.customer_phone}>
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
              Reenviar no WhatsApp
            </Button>
            {link.status === "pending" && (
              <Button variant="ghost" size="sm" className="text-destructive ml-auto" onClick={() => onCancel(link.id)}>
                <X className="h-3.5 w-3.5 mr-1" /> Cancelar
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
