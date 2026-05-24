import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Wallet as WalletIcon, Plus, TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useWallet, useWalletTransactions, usePhoneNumbers, useVoicePricing, formatBRL } from "@/features/wallet/hooks";

const PRESETS = [5000, 10000, 25000, 50000];

export default function Wallet() {
  const [sp, setSp] = useSearchParams();
  const tab = sp.get("tab") ?? "history";
  const setTab = (t: string) => { const n = new URLSearchParams(sp); n.set("tab", t); setSp(n); };
  const { current } = useWorkspace();
  const wsId = current?.id;
  const { data: wallet, isLoading } = useWallet();
  const { data: txs = [] } = useWalletTransactions(200);
  const { data: numbers = [] } = usePhoneNumbers();
  const { data: pricing = [] } = useVoicePricing();

  const [customOpen, setCustomOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [acquireOpen, setAcquireOpen] = useState(false);

  const balance = wallet?.balance_cents ?? 0;
  const low = wallet?.low_balance_alert_cents ?? 0;
  const isLow = low > 0 && balance <= low;

  const monthDebit = txs
    .filter(t => t.type?.includes("debit") && new Date(t.created_at).getMonth() === new Date().getMonth())
    .reduce((a, t) => a + Math.abs(t.amount_cents), 0);

  const last30 = txs.filter(t => Date.now() - new Date(t.created_at).getTime() < 30 * 86400_000);
  const avg30 = last30.length ? last30.reduce((a, t) => a + (t.balance_after_cents ?? 0), 0) / last30.length : 0;

  const recharge = async (cents: number) => {
    if (!wsId) return;
    try {
      const { data, error } = await supabase.functions.invoke("stripe-checkout-wallet", {
        body: { workspace_id: wsId, amount_cents: cents },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: any) { toast.error(e?.message ?? "Erro ao iniciar recarga"); }
  };

  const saveSettings = async (patch: Partial<NonNullable<typeof wallet>>) => {
    if (!wsId) return;
    const { error } = await supabase.from("wallets").update(patch).eq("workspace_id", wsId);
    if (error) toast.error(error.message); else toast.success("Salvo");
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent border-b">
        <div className="max-w-6xl mx-auto p-6 flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center">
            <WalletIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Wallet</h1>
            <p className="text-sm text-muted-foreground">Gerencie créditos, recargas e números BINA.</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Saldo atual</div>
            {isLoading ? <Skeleton className="h-8 w-32 mt-1" /> :
              <div className={`text-2xl font-bold mt-1 ${isLow ? "text-orange-500" : balance < 0 ? "text-destructive" : "text-emerald-600"}`}>
                {formatBRL(balance)}
              </div>}
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Consumo este mês</div>
            <div className="text-2xl font-bold mt-1">{formatBRL(monthDebit)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              Saldo médio (30d) {avg30 > balance ? <TrendingDown className="h-3 w-3 text-destructive" /> : <TrendingUp className="h-3 w-3 text-emerald-500" />}
            </div>
            <div className="text-2xl font-bold mt-1">{formatBRL(avg30)}</div>
          </Card>
        </div>

        <Card className="p-4">
          <div className="text-sm font-semibold mb-3">Adicionar saldo</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {PRESETS.map(c => (
              <Button key={c} variant="outline" className="h-12" onClick={() => recharge(c)}>{formatBRL(c)}</Button>
            ))}
            <Button variant="default" className="h-12 gap-1" onClick={() => setCustomOpen(true)}>
              <Plus className="h-4 w-4" /> Outro
            </Button>
          </div>
        </Card>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="history">Histórico</TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
            <TabsTrigger value="numbers">Números</TabsTrigger>
            <TabsTrigger value="pricing">Tarifas</TabsTrigger>
          </TabsList>

          <TabsContent value="history">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Saldo após</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txs.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Sem transações</TableCell></TableRow>
                  )}
                  {txs.map(t => {
                    const credit = t.amount_cents > 0;
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="text-xs">{format(new Date(t.created_at), "dd/MM/yy HH:mm")}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{t.type}</Badge></TableCell>
                        <TableCell className="text-sm">{t.description ?? "—"}</TableCell>
                        <TableCell className={`text-right font-mono ${credit ? "text-emerald-600" : "text-destructive"}`}>
                          {credit ? "+" : ""}{formatBRL(t.amount_cents)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">{formatBRL(t.balance_after_cents ?? 0)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card className="p-6 space-y-4 max-w-xl">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Recarga automática</Label>
                  <p className="text-xs text-muted-foreground">Adiciona saldo quando atingir o limite.</p>
                </div>
                <Switch checked={!!wallet?.auto_recharge} onCheckedChange={(v) => saveSettings({ auto_recharge: v })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Limite (R$)</Label>
                  <Input
                    type="number"
                    defaultValue={(wallet?.auto_recharge_threshold_cents ?? 0) / 100}
                    onBlur={(e) => saveSettings({ auto_recharge_threshold_cents: Math.round(Number(e.target.value) * 100) })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Valor (R$)</Label>
                  <Input
                    type="number"
                    defaultValue={(wallet?.auto_recharge_amount_cents ?? 0) / 100}
                    onBlur={(e) => saveSettings({ auto_recharge_amount_cents: Math.round(Number(e.target.value) * 100) })}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Alerta saldo baixo (R$)</Label>
                <Input
                  type="number"
                  defaultValue={(wallet?.low_balance_alert_cents ?? 0) / 100}
                  onBlur={(e) => saveSettings({ low_balance_alert_cents: Math.round(Number(e.target.value) * 100) })}
                />
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="numbers">
            <div className="flex justify-end mb-2">
              <Button size="sm" onClick={() => setAcquireOpen(true)}><Plus className="h-4 w-4 mr-1" /> Adquirir número</Button>
            </div>
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>UF</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Custo mensal</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {numbers.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Nenhum número</TableCell></TableRow>}
                  {(numbers as any[]).map(n => (
                    <TableRow key={n.id}>
                      <TableCell className="font-mono">{n.e164}</TableCell>
                      <TableCell>{n.uf ?? "—"}</TableCell>
                      <TableCell>{n.type ?? "—"}</TableCell>
                      <TableCell className="text-right">{formatBRL(n.monthly_cost_cents ?? 0)}</TableCell>
                      <TableCell><Badge variant={n.active ? "default" : "secondary"}>{n.active ? "Ativo" : "Inativo"}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="pricing">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Canal</TableHead><TableHead>Destino</TableHead><TableHead className="text-right">Tarifa /min</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {pricing.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-8">—</TableCell></TableRow>}
                  {(pricing as any[]).map((p, i) => (
                    <TableRow key={i}>
                      <TableCell>{p.channel}</TableCell>
                      <TableCell>{p.destination ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono">{formatBRL(p.rate_per_min_cents ?? 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Recarga personalizada</DialogTitle></DialogHeader>
          <Label>Valor (R$)</Label>
          <Input type="number" value={customAmount} onChange={e => setCustomAmount(e.target.value)} placeholder="100" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomOpen(false)}>Cancelar</Button>
            <Button onClick={() => { const c = Math.round(Number(customAmount) * 100); if (c > 0) recharge(c); setCustomOpen(false); }}>Continuar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AcquireNumberDialog open={acquireOpen} onOpenChange={setAcquireOpen} />
    </div>
  );
}

function AcquireNumberDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { current } = useWorkspace();
  const [uf, setUf] = useState("SP");
  const [type, setType] = useState("local");
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (!current?.id) return;
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("voice-outbound", {
        body: { _action: "acquire_number", workspace_id: current.id, uf, type },
      });
      if (error) throw error;
      toast.success("Solicitação enviada");
      onOpenChange(false);
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
    finally { setLoading(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Adquirir número</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>UF</Label>
            <Select value={uf} onValueChange={setUf}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["SP","RJ","MG","RS","PR","SC","BA","DF","PE","CE"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Local</SelectItem>
                <SelectItem value="mobile">Móvel</SelectItem>
                <SelectItem value="toll-free">0800</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">Preview de preço estará disponível após cotação.</div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>{loading ? "Solicitando…" : "Solicitar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
