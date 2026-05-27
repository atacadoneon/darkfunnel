import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { CheckCircle2 } from "lucide-react";
import {
  useTrackingConfig, useUpsertTrackingConfig, useGoogleTrackedStats, useProcessQueue,
} from "./hooks";
import { StageMappingCard } from "./MetaAdsTab";

function StatusBadge({ status }: { status: string | null | undefined }) {
  if (status === "configured")
    return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">Conectado</Badge>;
  if (status === "error") return <Badge variant="destructive">Erro</Badge>;
  return <Badge variant="secondary">Não configurado</Badge>;
}

export function GoogleAdsTab() {
  const { data: cfg } = useTrackingConfig();
  const upsert = useUpsertTrackingConfig();
  const stats = useGoogleTrackedStats();
  const processQueue = useProcessQueue();

  const [cid, setCid] = useState("");
  const [actId, setActId] = useState("");

  useEffect(() => {
    setCid(cfg?.google_customer_id ?? "");
    setActId(cfg?.google_conversion_action_id ?? "");
  }, [cfg]);

  const save = () => {
    upsert.mutate({
      google_customer_id: cid || null,
      google_conversion_action_id: actId || null,
      google_status: cid && actId ? "configured" : "not_configured",
      google_configured_at: cid && actId ? new Date().toISOString() : null,
    });
  };

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-semibold">Google Ads</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Envie conversões offline para o Google Ads via Data Manager (HTTPS).
            </p>
          </div>
          <StatusBadge status={cfg?.google_status} />
        </div>

        <div className="mt-4 rounded-md border p-4 space-y-4">
          <div className="text-xs font-semibold flex items-center gap-2">
            <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] grid place-items-center">1</span>
            Credenciais
          </div>
          <div>
            <Label className="text-xs">Customer ID (CID) *</Label>
            <Input value={cid} onChange={(e) => setCid(e.target.value)} placeholder="123-456-7890" />
          </div>
          <div>
            <Label className="text-xs">Conversion Action ID</Label>
            <Input value={actId} onChange={(e) => setActId(e.target.value)} placeholder="Ex: 12345678" />
          </div>
          <Button className="w-full" onClick={save} disabled={upsert.isPending}>
            Salvar configurações
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">Total rastreados</div>
            <div className="text-xl font-bold">{stats.data?.total ?? 0}</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">Últimos 30 dias</div>
            <div className="text-xl font-bold">{stats.data?.recent ?? 0}</div>
          </div>
        </div>
      </Card>

      <Card className="p-4 bg-emerald-500/5 border-emerald-500/30">
        <div className="text-sm font-semibold mb-2">Como funciona</div>
        <ul className="text-xs text-muted-foreground space-y-1.5">
          <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mt-0.5" /> Salve Customer ID e Conversion Action ID.</li>
          <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mt-0.5" /> Configure o mapeamento de etapas abaixo.</li>
          <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mt-0.5" /> No Google Ads, vá em Data Manager → + Conectar → HTTPS e cole URL, usuário e senha.</li>
          <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mt-0.5" /> O Google puxa as conversões automaticamente a cada 6 horas.</li>
        </ul>
        <div className="text-xs mt-2">
          Dica: habilite <span className="font-semibold text-emerald-700">Auto-tagging</span> no Google Ads.
        </div>
      </Card>

      <HowToConnectDialog />

      <StageMappingCard
        provider="google"
        onProcessQueue={() => processQueue.mutate()}
        processing={processQueue.isPending}
      />
    </div>
  );
}

function HowToConnectDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="link" className="px-0">Como conectar HTTPS no Data Manager →</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Conectar HTTPS no Google Data Manager</DialogTitle></DialogHeader>
        <ol className="text-sm space-y-2 list-decimal pl-5">
          <li>Abra Google Ads → Ferramentas → Data Manager.</li>
          <li>Clique em <b>+ Conectar fonte</b> e escolha <b>HTTPS</b>.</li>
          <li>Cole a URL fornecida pelo DarkFunnel e as credenciais geradas.</li>
          <li>Selecione a Conversion Action correspondente.</li>
          <li>Salve. O Google sincroniza a cada 6 horas.</li>
        </ol>
      </DialogContent>
    </Dialog>
  );
}
