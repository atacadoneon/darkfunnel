import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Copy, Download, Loader2, RotateCw, Ban, CheckCircle2, Undo2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/EmptyState";
import { usePaymentAttempts, usePaymentWebhooks, useUpdatePayment, type PaymentRow } from "@/hooks/usePayments";
import { STATUS_META } from "./paymentMeta";

type Props = { open: boolean; onOpenChange: (v: boolean) => void; payment: PaymentRow | null };

function brl(c?: number | null) {
  return ((c ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function copy(s?: string | null) {
  if (!s) return;
  navigator.clipboard.writeText(s);
  toast.success("Copiado");
}

export function DetalheCobrancaDrawer({ open, onOpenChange, payment }: Props) {
  const attempts = usePaymentAttempts(payment?.id);
  const webhooks = usePaymentWebhooks(payment?.id);
  const update = useUpdatePayment();
  const [payload, setPayload] = useState<any>(null);

  useEffect(() => { if (!open) setPayload(null); }, [open]);
  if (!payment) return null;

  const meta = STATUS_META[payment.status] ?? STATUS_META.pending;

  const doAction = async (action: "cancel" | "refund" | "markPaid" | "retry") => {
    try {
      await update.mutateAsync({ id: payment.id, action });
      toast.success("Atualizado");
    } catch (e: any) { toast.error(e.message ?? "Erro"); }
  };

  const timeline = [
    { ts: payment.created_at, label: "Cobrança criada" },
    ...(attempts.data ?? []).map((a: any) => ({ ts: a.attempted_at, label: `Tentativa #${a.attempt_number} — ${a.status}` })),
    ...(payment.paid_at ? [{ ts: payment.paid_at, label: "Pagamento confirmado" }] : []),
  ].sort((a, b) => +new Date(b.ts) - +new Date(a.ts));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[560px] w-full overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={meta.cls}>{meta.label}</Badge>
            {payment.external_id && <span className="text-xs text-muted-foreground">#{payment.external_id}</span>}
          </div>
          <SheetTitle className="text-2xl">{brl(payment.amount_cents)}</SheetTitle>
          <p className="text-sm text-muted-foreground">{payment.customer_name ?? "—"}</p>
        </SheetHeader>

        <Tabs defaultValue="resumo" className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="resumo" className="flex-1">Resumo</TabsTrigger>
            <TabsTrigger value="attempts" className="flex-1">Tentativas</TabsTrigger>
            <TabsTrigger value="webhooks" className="flex-1">Webhooks</TabsTrigger>
            <TabsTrigger value="historico" className="flex-1">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="resumo" className="space-y-3">
            <Card className="p-3 space-y-2 text-sm">
              <Row k="Vencimento" v={payment.due_date ? format(new Date(payment.due_date), "dd/MM/yyyy") : "—"} />
              <Row k="Criada em" v={format(new Date(payment.created_at), "dd/MM/yyyy HH:mm")} />
              <Row k="Último webhook" v={payment.last_webhook_at ? format(new Date(payment.last_webhook_at), "dd/MM/yyyy HH:mm") : "—"} />
              <Row k="Método" v={payment.method ?? "—"} />
              <Row k="Gateway" v={payment.gateway ?? "—"} />
              <Row k="Descrição" v={payment.description ?? "—"} />
              <Row k="Valor pago" v={brl(payment.paid_amount_cents)} />
              <Row k="Taxas" v={brl(payment.fee_cents)} />
              <Row k="Líquido" v={brl(payment.net_amount_cents)} />
            </Card>
            {payment.payment_url && (
              <Card className="p-3 space-y-2">
                <div className="text-xs text-muted-foreground">Link de pagamento</div>
                <div className="flex items-center gap-2">
                  <code className="text-xs flex-1 truncate bg-muted px-2 py-1.5 rounded">{payment.payment_url}</code>
                  <Button size="sm" variant="outline" onClick={() => copy(payment.payment_url)}><Copy className="h-3.5 w-3.5" /></Button>
                </div>
              </Card>
            )}
            {payment.method === "pix" && payment.pix_qr_image_url && (
              <Card className="p-3 space-y-2 text-center">
                <img src={payment.pix_qr_image_url} alt="QR PIX" className="mx-auto max-w-[220px]" />
                <Button size="sm" variant="outline" onClick={() => copy(payment.pix_qr_code)} className="gap-1.5">
                  <Copy className="h-3.5 w-3.5" /> Copiar código PIX
                </Button>
              </Card>
            )}
            {payment.method === "boleto" && (
              <Card className="p-3 space-y-2">
                {payment.boleto_url && (
                  <Button size="sm" variant="outline" asChild className="w-full gap-1.5">
                    <a href={payment.boleto_url} target="_blank" rel="noreferrer"><Download className="h-3.5 w-3.5" /> Baixar PDF</a>
                  </Button>
                )}
                {payment.boleto_barcode && (
                  <div className="flex items-center gap-2">
                    <code className="text-xs flex-1 truncate bg-muted px-2 py-1.5 rounded">{payment.boleto_barcode}</code>
                    <Button size="sm" variant="outline" onClick={() => copy(payment.boleto_barcode)}><Copy className="h-3.5 w-3.5" /></Button>
                  </div>
                )}
              </Card>
            )}
          </TabsContent>

          <TabsContent value="attempts">
            {attempts.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> :
              (attempts.data ?? []).length === 0 ? <EmptyState title="Sem tentativas" description="Esta cobrança ainda não teve tentativas de pagamento." /> :
              <div className="space-y-2">
                {(attempts.data ?? []).map((a: any) => (
                  <Card key={a.id} className="p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">#{a.attempt_number} — {a.status}</span>
                      <span className="text-xs text-muted-foreground">{format(new Date(a.attempted_at), "dd/MM/yyyy HH:mm")}</span>
                    </div>
                    {a.error_message && <p className="text-xs text-destructive mt-1">{a.error_message}</p>}
                  </Card>
                ))}
              </div>
            }
          </TabsContent>

          <TabsContent value="webhooks">
            {webhooks.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> :
              (webhooks.data ?? []).length === 0 ? <EmptyState title="Sem webhooks" description="Nenhum evento recebido." /> :
              <div className="space-y-2">
                {(webhooks.data ?? []).map((w: any) => (
                  <Card key={w.id} className="p-3 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="font-medium">{w.event_type}</span>
                      <Badge variant="outline" className={w.processed ? "border-emerald-500/30 text-emerald-600" : "border-amber-500/30 text-amber-600"}>
                        {w.processed ? "processado" : "pendente"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{format(new Date(w.created_at), "dd/MM/yyyy HH:mm")}</p>
                    {w.processing_error && <p className="text-xs text-destructive">{w.processing_error}</p>}
                    <Button size="sm" variant="ghost" onClick={() => setPayload(w.payload)}>Ver payload</Button>
                  </Card>
                ))}
                {payload && (
                  <Card className="p-3">
                    <pre className="text-xs overflow-auto max-h-64">{JSON.stringify(payload, null, 2)}</pre>
                  </Card>
                )}
              </div>
            }
          </TabsContent>

          <TabsContent value="historico">
            <div className="space-y-2">
              {timeline.map((t, i) => (
                <div key={i} className="flex gap-3 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                  <div className="flex-1">
                    <p>{t.label}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(t.ts), "dd/MM/yyyy HH:mm")}</p>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-6 flex flex-wrap gap-2 border-t pt-4">
          <Button size="sm" variant="outline" onClick={() => doAction("retry")} className="gap-1.5"><RotateCw className="h-3.5 w-3.5" /> Reenviar</Button>
          <ConfirmButton label="Cancelar" icon={<Ban className="h-3.5 w-3.5" />} onConfirm={() => doAction("cancel")} title="Cancelar cobrança?" />
          <ConfirmButton label="Estornar" icon={<Undo2 className="h-3.5 w-3.5" />} onConfirm={() => doAction("refund")} title="Estornar cobrança?" />
          <ConfirmButton label="Marcar pago" icon={<CheckCircle2 className="h-3.5 w-3.5" />} onConfirm={() => doAction("markPaid")} title="Marcar como paga?" />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-2"><span className="text-muted-foreground">{k}</span><span className="font-medium text-right">{v}</span></div>;
}

function ConfirmButton({ label, icon, onConfirm, title }: { label: string; icon: React.ReactNode; onConfirm: () => void; title: string }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">{icon}{label}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>Esta ação pode ser irreversível.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Voltar</AlertDialogCancel><AlertDialogAction onClick={onConfirm}>Confirmar</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default DetalheCobrancaDrawer;
