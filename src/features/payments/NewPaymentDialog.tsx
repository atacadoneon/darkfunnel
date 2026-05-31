import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card } from "@/components/ui/card";
import { CalendarIcon, Loader2, Copy, Send, Zap, Barcode, CreditCard, ArrowLeftRight } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SellerSelect } from "@/components/sellers/SellerSelect";
import { useCreatePayment } from "@/hooks/usePayments";
import { GATEWAYS } from "./paymentMeta";

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

function parseBRL(s: string): number {
  const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

const METHOD_CARDS = [
  { v: "pix", label: "PIX", icon: Zap },
  { v: "boleto", label: "Boleto", icon: Barcode },
  { v: "credit_card", label: "Cartão crédito", icon: CreditCard },
  { v: "wire_transfer", label: "Transferência", icon: ArrowLeftRight },
];

export function NewPaymentDialog({ open, onOpenChange }: Props) {
  const create = useCreatePayment();
  const [mode, setMode] = useState<"once" | "recurring">("once");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [doc, setDoc] = useState("");
  const [seller, setSeller] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("pix");
  const [installments, setInstallments] = useState(1);
  const [due, setDue] = useState<Date>(() => { const d = new Date(); d.setDate(d.getDate() + 7); return d; });
  const [description, setDescription] = useState("");
  const [gateway, setGateway] = useState<string>("manual");
  const [recurInterval, setRecurInterval] = useState(1);
  const [recurUnit, setRecurUnit] = useState<"day" | "week" | "month">("month");
  const [result, setResult] = useState<{ url: string | null; id: string } | null>(null);

  useEffect(() => {
    if (open) {
      setResult(null); setName(""); setEmail(""); setPhone(""); setDoc("");
      setAmount(""); setDescription(""); setMethod("pix"); setInstallments(1);
      const d = new Date(); d.setDate(d.getDate() + 7); setDue(d);
    }
  }, [open]);

  const onSubmit = async () => {
    const cents = parseBRL(amount);
    if (cents <= 0) { toast.error("Valor inválido"); return; }
    if (!name) { toast.error("Informe o cliente"); return; }
    try {
      const meta = mode === "recurring" ? { recurring: { interval: recurInterval, unit: recurUnit } } : null;
      const r = await create.mutateAsync({
        amount_cents: cents,
        method,
        installments: method === "credit_card" ? installments : 1,
        due_date: due.toISOString().slice(0, 10),
        description,
        gateway,
        customer_name: name, customer_email: email, customer_phone: phone, customer_document: doc,
        assigned_user_id: seller || undefined,
        ...(meta ? { description: `${description} [recorrente]` } : {}),
      } as any);
      setResult({ url: r.payment_url ?? null, id: r.id });
      toast.success("Cobrança criada");
    } catch (e: any) { toast.error(e.message ?? "Erro ao criar"); }
  };

  const copy = () => { if (result?.url) { navigator.clipboard.writeText(result.url); toast.success("Link copiado"); } };
  const sendWa = () => {
    if (!result?.url || !phone) { toast.error("Telefone ausente"); return; }
    const msg = encodeURIComponent(`Olá ${name}! Segue o link de pagamento: ${result.url}`);
    window.open(`https://wa.me/${phone.replace(/\D/g, "")}?text=${msg}`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nova cobrança</DialogTitle></DialogHeader>

        {result ? (
          <Card className="p-4 space-y-3">
            <p className="text-sm font-medium text-emerald-600">Cobrança criada com sucesso</p>
            {result.url && (
              <div className="flex items-center gap-2">
                <code className="text-xs flex-1 truncate bg-muted px-2 py-1.5 rounded">{result.url}</code>
                <Button size="sm" variant="outline" onClick={copy}><Copy className="h-3.5 w-3.5" /></Button>
              </div>
            )}
            <div className="flex gap-2">
              {result.url && <Button size="sm" onClick={sendWa} className="gap-1.5"><Send className="h-3.5 w-3.5" /> Enviar WhatsApp</Button>}
              <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
            </div>
          </Card>
        ) : (
          <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
            <TabsList className="w-full">
              <TabsTrigger value="once" className="flex-1">Cobrança única</TabsTrigger>
              <TabsTrigger value="recurring" className="flex-1">Recorrente</TabsTrigger>
            </TabsList>

            <div className="space-y-3 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Cliente *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Vendedor</Label><SellerSelect value={seller} onValueChange={setSeller} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>E-mail</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Telefone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>CPF/CNPJ</Label><Input value={doc} onChange={(e) => setDoc(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Valor (R$) *</Label><Input inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
              </div>

              <div className="space-y-1.5">
                <Label>Método</Label>
                <div className="grid grid-cols-4 gap-2">
                  {METHOD_CARDS.map((m) => {
                    const I = m.icon; const active = method === m.v;
                    return (
                      <button type="button" key={m.v} onClick={() => setMethod(m.v)}
                        className={cn("border rounded-md p-2 text-xs flex flex-col items-center gap-1 transition-colors",
                          active ? "border-primary bg-primary/5 text-primary" : "hover:bg-muted/50")}>
                        <I className="h-4 w-4" />{m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {method === "credit_card" && (
                  <div className="space-y-1.5"><Label>Parcelas</Label>
                    <Select value={String(installments)} onValueChange={(v) => setInstallments(Number(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <SelectItem key={n} value={String(n)}>{n}x</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1.5"><Label>Vencimento</Label>
                  <Popover><PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start"><CalendarIcon className="h-3.5 w-3.5 mr-2" />{format(due, "dd/MM/yyyy")}</Button>
                  </PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={due} onSelect={(d) => d && setDue(d)} initialFocus className="p-3 pointer-events-auto" /></PopoverContent></Popover>
                </div>
                <div className="space-y-1.5"><Label>Gateway</Label>
                  <Select value={gateway} onValueChange={setGateway}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{GATEWAYS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5"><Label>Descrição</Label><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>

              <TabsContent value="recurring" className="mt-0 p-3 bg-muted/30 rounded-md space-y-2">
                <Label className="text-xs">Repetir a cada</Label>
                <div className="flex gap-2">
                  <Input type="number" min={1} value={recurInterval} onChange={(e) => setRecurInterval(Number(e.target.value) || 1)} className="w-24" />
                  <Select value={recurUnit} onValueChange={(v) => setRecurUnit(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">dias</SelectItem><SelectItem value="week">semanas</SelectItem><SelectItem value="month">meses</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        )}

        {!result && (
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={onSubmit} disabled={create.isPending}>
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gerar cobrança"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default NewPaymentDialog;
