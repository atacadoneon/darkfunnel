import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Loader2, Copy, Send, CreditCard, QrCode, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useGateways, useCreatePaymentLink } from "./hooks";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contact?: {
    id?: string | null;
    name?: string;
    phone?: string;
    email?: string;
    document?: string;
    avatar?: string;
  };
  dealId?: string | null;
  defaultDescription?: string;
  conversationId?: string;
};

function brlToCents(s: string): number {
  const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function PaymentLinkDialog({ open, onOpenChange, contact, dealId, defaultDescription, conversationId }: Props) {
  const { data: gateways = [] } = useGateways();
  const create = useCreatePaymentLink();

  const configured = gateways.filter((g) => g.status === "configured");
  const defaultGw = configured.find((g) => g.is_default) ?? configured[0];

  const [gatewayId, setGatewayId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [methods, setMethods] = useState<{ credit_card: boolean; pix: boolean; boleto: boolean }>({
    credit_card: true, pix: true, boleto: false,
  });
  const [installments, setInstallments] = useState(12);
  const [expiresInHours, setExpiresInHours] = useState(72);
  const [result, setResult] = useState<{ url: string; expires_at: string | null } | null>(null);
  const [sending, setSending] = useState(false);

  const [loadedContact, setLoadedContact] = useState<Props["contact"] | null>(null);
  const effectiveContact = contact ?? loadedContact ?? undefined;

  useEffect(() => {
    if (open) {
      setGatewayId(defaultGw?.id ?? "");
      setAmount("");
      setDescription(defaultDescription ?? "");
      setMethods({ credit_card: true, pix: true, boleto: false });
      setInstallments(12);
      setExpiresInHours(72);
      setResult(null);
    }
  }, [open, defaultGw?.id, defaultDescription]);

  useEffect(() => {
    if (!open || contact || !dealId) return;
    (async () => {
      const { data } = await supabase
        .from("deals")
        .select("contact:contacts(id, display_name, phone_e164, email, document)")
        .eq("id", dealId)
        .maybeSingle();
      const c: any = (data as any)?.contact;
      if (c) setLoadedContact({
        id: c.id, name: c.display_name, phone: c.phone_e164, email: c.email, document: c.document,
      });
    })();
  }, [open, dealId, contact]);

  const onSubmit = async () => {
    const cents = brlToCents(amount);
    if (cents <= 0) { toast.error("Informe um valor válido"); return; }
    if (!gatewayId) { toast.error("Selecione um gateway"); return; }
    const selectedMethods: string[] = [];
    if (methods.credit_card) selectedMethods.push("credit_card");
    if (methods.pix) selectedMethods.push("pix");
    if (methods.boleto) selectedMethods.push("boleto");
    if (!selectedMethods.length) { toast.error("Escolha ao menos um método"); return; }

    try {
      const r = await create.mutateAsync({
        gateway_id: gatewayId,
        amount_cents: cents,
        description: description.trim() || "Pagamento",
        contact_id: effectiveContact?.id ?? null,
        deal_id: dealId ?? null,
        customer_name: effectiveContact?.name,
        customer_email: effectiveContact?.email,
        customer_phone: effectiveContact?.phone,
        customer_document: effectiveContact?.document,
        max_installments: installments,
        payment_methods: selectedMethods,
        expires_in_hours: expiresInHours,
      });
      setResult({ url: r.url, expires_at: r.expires_at });
      toast.success("Link criado!");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao gerar link");
    }
  };

  const copy = async () => {
    if (!result?.url) return;
    await navigator.clipboard.writeText(result.url);
    toast.success("Link copiado");
  };

  const sendWhatsapp = async () => {
    if (!result?.url || !effectiveContact?.phone) {
      toast.error("Telefone do contato indisponível");
      return;
    }
    const cents = brlToCents(amount);
    const expFmt = result.expires_at ? format(new Date(result.expires_at), "dd/MM/yyyy") : "—";
    const text = `Olá ${effectiveContact?.name ?? ""}! Segue o link de pagamento de ${formatBRL(cents)}: ${result.url}\nVencimento: ${expFmt}`;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("uazapi-send", {
        body: {
          conversation_id: conversationId ?? null,
          contact_id: effectiveContact?.id ?? null,
          phone: effectiveContact!.phone,
          type: "text",
          text,
        },
      });
      if (error) throw error;
      toast.success("Mensagem enviada no WhatsApp");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao enviar");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Link de Pagamento</DialogTitle>
          <DialogDescription>Gere e envie um link para o cliente pagar.</DialogDescription>
        </DialogHeader>

        {effectiveContact && (
          <Card className="p-3 flex items-center gap-3 bg-muted/30">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-semibold">
              {(effectiveContact.name?.[0] ?? "?").toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-medium truncate">{effectiveContact.name ?? "—"}</div>
              <div className="text-xs text-muted-foreground truncate">
                {[effectiveContact.phone, effectiveContact.email, effectiveContact.document].filter(Boolean).join(" · ") || "Sem dados de contato"}
              </div>
            </div>
          </Card>
        )}

        {!result ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valor (R$)</Label>
                <Input inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Gateway</Label>
                <Select value={gatewayId} onValueChange={setGatewayId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {configured.length === 0 && <SelectItem value="none" disabled>Nenhum gateway</SelectItem>}
                    {configured.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.display_name}{g.is_default ? " (padrão)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Produto/Serviço" />
            </div>

            <div>
              <Label className="text-xs">Métodos aceitos</Label>
              <div className="flex gap-3 mt-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={methods.credit_card} onCheckedChange={(c) => setMethods((m) => ({ ...m, credit_card: !!c }))} />
                  <CreditCard className="h-3.5 w-3.5" /> Cartão
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={methods.pix} onCheckedChange={(c) => setMethods((m) => ({ ...m, pix: !!c }))} />
                  <QrCode className="h-3.5 w-3.5" /> Pix
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={methods.boleto} onCheckedChange={(c) => setMethods((m) => ({ ...m, boleto: !!c }))} />
                  <FileText className="h-3.5 w-3.5" /> Boleto
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Parcelas máx.</Label>
                <Input type="number" min={1} max={12} value={installments} onChange={(e) => setInstallments(Number(e.target.value) || 1)} />
              </div>
              <div className="space-y-1.5">
                <Label>Expira em (horas)</Label>
                <Input type="number" min={1} value={expiresInHours} onChange={(e) => setExpiresInHours(Number(e.target.value) || 72)} />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Card className="p-4 border-emerald-500/30 bg-emerald-500/5">
              <div className="flex items-center gap-2 text-emerald-600 font-medium">
                <CheckCircle2 className="h-4 w-4" /> Link criado
              </div>
              <div className="mt-2 break-all text-sm bg-background border rounded-md p-2 font-mono">
                {result.url}
              </div>
              {result.expires_at && (
                <p className="text-xs text-muted-foreground mt-2">
                  Vence em {format(new Date(result.expires_at), "dd/MM/yyyy HH:mm")}
                </p>
              )}
              <div className="flex gap-2 mt-3">
                <Button variant="outline" size="sm" onClick={copy} className="gap-1.5">
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </Button>
                <Button size="sm" onClick={sendWhatsapp} disabled={sending || !effectiveContact?.phone} className="gap-1.5">
                  {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Enviar no WhatsApp
                </Button>
              </div>
            </Card>
          </div>
        )}

        <DialogFooter>
          {!result ? (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={onSubmit} disabled={create.isPending}>
                {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gerar Link"}
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
