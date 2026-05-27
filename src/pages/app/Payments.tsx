import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Copy, Send, ExternalLink, X, Loader2, DollarSign, Receipt, CreditCard, QrCode } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useCancelPaymentLink, useGateways, usePaymentLinks } from "@/features/payments/hooks";
import type { PaymentLink } from "@/features/payments/types";
import { supabase } from "@/integrations/supabase/client";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "border-amber-500/30 text-amber-600 bg-amber-500/10" },
  paid: { label: "Pago", cls: "border-emerald-500/30 text-emerald-600 bg-emerald-500/10" },
  expired: { label: "Expirado", cls: "border-muted text-muted-foreground" },
  cancelled: { label: "Cancelado", cls: "border-muted text-muted-foreground" },
  failed: { label: "Falha", cls: "border-destructive/30 text-destructive bg-destructive/10" },
};

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function Payments() {
  const [status, setStatus] = useState("all");
  const [gatewayId, setGatewayId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data: gateways = [] } = useGateways();
  const { data: links = [], isLoading } = usePaymentLinks({
    status,
    gateway_id: gatewayId,
    from: from || undefined,
    to: to ? `${to}T23:59:59` : undefined,
  });
  const [selected, setSelected] = useState<PaymentLink | null>(null);
  const cancel = useCancelPaymentLink();

  const stats = useMemo(() => {
    const total = links.reduce((s, l) => s + (l.amount_cents ?? 0), 0);
    const paid = links.filter((l) => l.status === "paid");
    const paidVal = paid.reduce((s, l) => s + (l.amount_cents ?? 0), 0);
    const pending = links.filter((l) => l.status === "pending").length;
    const conv = links.length ? (paid.length / links.length) * 100 : 0;
    return { total, paidVal, pending, conv };
  }, [links]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Links de Pagamento</h1>
          <p className="text-sm text-muted-foreground">Gere, envie e acompanhe cobranças.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<DollarSign className="h-4 w-4" />} label="Total Gerado" value={brl(stats.total)} />
        <StatCard icon={<Receipt className="h-4 w-4" />} label="Total Pago" value={brl(stats.paidVal)} accent="emerald" />
        <StatCard icon={<QrCode className="h-4 w-4" />} label="Conversão" value={`${stats.conv.toFixed(1)}%`} />
        <StatCard icon={<CreditCard className="h-4 w-4" />} label="Pendentes" value={String(stats.pending)} />
      </div>

      <Card className="p-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Status</label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="paid">Pago</SelectItem>
              <SelectItem value="expired">Expirado</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
              <SelectItem value="failed">Falha</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Gateway</label>
          <Select value={gatewayId} onValueChange={setGatewayId}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {gateways.map((g) => <SelectItem key={g.id} value={g.id}>{g.display_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">De</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Até</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
      </Card>

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
            {!isLoading && links.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Nenhum link encontrado</TableCell></TableRow>
            )}
            {links.map((l) => {
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

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: "emerald" }) {
  return (
    <Card className="p-4">
      <div className={`flex items-center gap-2 text-xs ${accent === "emerald" ? "text-emerald-600" : "text-muted-foreground"}`}>
        {icon} {label}
      </div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </Card>
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
