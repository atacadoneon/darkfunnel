import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Eye, EyeOff, Send } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  useTrackingConfig, useUpsertTrackingConfig, useStageEventMappings,
  useUpsertStageMapping, useTestMetaConnection, useProcessQueue,
} from "./hooks";
import { useStages } from "@/features/pipeline/hooks";
import { usePipelines } from "@/features/pipeline/leadEditHooks";

const META_EVENTS = [
  "Nenhum", "Lead", "ViewContent", "AddToCart", "InitiateCheckout",
  "AddPaymentInfo", "Purchase", "Schedule", "CompleteRegistration", "Contact",
];

function StatusBadge({ status }: { status: string | null | undefined }) {
  if (status === "configured")
    return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">Conectado</Badge>;
  if (status === "error")
    return <Badge variant="destructive">Erro</Badge>;
  return <Badge variant="secondary">Não configurado</Badge>;
}

export function MetaAdsTab() {
  const { data: cfg } = useTrackingConfig();
  const upsert = useUpsertTrackingConfig();
  const test = useTestMetaConnection();
  const processQueue = useProcessQueue();

  const [pixel, setPixel] = useState("");
  const [token, setToken] = useState("");
  const [showTok, setShowTok] = useState(false);
  const [testCode, setTestCode] = useState("");

  useEffect(() => {
    setPixel(cfg?.meta_pixel_id ?? "");
    setToken(cfg?.meta_access_token_encrypted ?? "");
    setTestCode(cfg?.meta_test_event_code ?? "");
  }, [cfg]);

  const save = () => {
    upsert.mutate({
      meta_pixel_id: pixel || null,
      meta_access_token_encrypted: token || null,
      meta_test_event_code: testCode || null,
      meta_status: pixel && token ? "configured" : "not_configured",
      meta_configured_at: pixel && token ? new Date().toISOString() : null,
    });
  };

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold">Conexão Meta Ads</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Envie conversões via Conversions API.
            </p>
          </div>
          <StatusBadge status={cfg?.meta_status} />
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Pixel ID / Dataset ID</Label>
            <Input value={pixel} onChange={(e) => setPixel(e.target.value)} placeholder="123456789012345" />
            <p className="text-xs text-muted-foreground mt-1">
              Meta Events Manager → Fontes de dados → ID do pixel/dataset.
            </p>
          </div>
          <div>
            <Label className="text-xs">Access Token</Label>
            <div className="relative">
              <Input type={showTok ? "text" : "password"} value={token}
                onChange={(e) => setToken(e.target.value)} placeholder="EAAB..." className="pr-9" />
              <button type="button" onClick={() => setShowTok((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showTok ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Token System User em Meta Business Settings → Usuários do sistema.
            </p>
          </div>
          <div>
            <Label className="text-xs">Test Event Code (opcional)</Label>
            <Input value={testCode} onChange={(e) => setTestCode(e.target.value)} placeholder="Ex: TEST12345" />
            <p className="text-xs text-muted-foreground mt-1">Use para validar no Events Manager.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={upsert.isPending}>Salvar</Button>
            <Button variant="outline" onClick={() => test.mutate()} disabled={test.isPending}>
              Testar conexão
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-4 bg-blue-500/5 border-blue-500/30">
        <div className="text-sm font-semibold mb-2">Como funciona</div>
        <ol className="text-xs text-muted-foreground space-y-1 list-decimal pl-4">
          <li>Leads via Click-to-WhatsApp (CTWA) são identificados automaticamente.</li>
          <li>Quando o lead vai para uma etapa marcada como Ganho, um evento Purchase é enviado.</li>
          <li>O evento inclui dados de atribuição para otimização das campanhas no Meta.</li>
        </ol>
      </Card>

      <StageMappingCard
        provider="meta"
        onProcessQueue={() => processQueue.mutate()}
        processing={processQueue.isPending}
      />
    </div>
  );
}

export function StageMappingCard({
  provider, onProcessQueue, processing,
}: { provider: "meta" | "google"; onProcessQueue: () => void; processing: boolean }) {
  const { data: pipelines = [] } = usePipelines();
  const [pipelineId, setPipelineId] = useState<string>("");
  useEffect(() => { if (!pipelineId && pipelines[0]) setPipelineId(pipelines[0].id); }, [pipelines, pipelineId]);

  const { data: stages = [] } = useStages();
  const filteredStages = stages.filter((s) => !pipelineId || (s as any).pipeline_id === pipelineId || (s as any).pipeline_id === null);
  const { data: maps = [] } = useStageEventMappings(provider);
  const upsert = useUpsertStageMapping();

  const mapByStage = new Map(maps.map((m) => [m.stage_id, m]));

  const setEvent = (stage_id: string, event_name: string) => {
    const existing = mapByStage.get(stage_id);
    upsert.mutate({ stage_id, provider, event_name: event_name === "Nenhum" ? null : event_name,
      value_mode: existing?.value_mode ?? "none", fixed_value_cents: existing?.fixed_value_cents ?? null,
      active: existing?.active ?? true });
  };
  const setValueMode = (stage_id: string, value_mode: "none" | "deal" | "fixed") => {
    const existing = mapByStage.get(stage_id);
    upsert.mutate({ stage_id, provider, event_name: existing?.event_name ?? null, value_mode,
      fixed_value_cents: existing?.fixed_value_cents ?? null, active: existing?.active ?? true });
  };
  const setActive = (stage_id: string, active: boolean) => {
    const existing = mapByStage.get(stage_id);
    upsert.mutate({ stage_id, provider, event_name: existing?.event_name ?? null,
      value_mode: existing?.value_mode ?? "none", fixed_value_cents: existing?.fixed_value_cents ?? null, active });
  };

  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-4 border-b flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="font-semibold text-sm">
            Mapeamento de {provider === "meta" ? "eventos Meta" : "conversões Google"}
          </div>
          <div className="text-xs text-muted-foreground">
            Configure qual {provider === "meta" ? "evento" : "conversão"} será enviado quando o lead mudar para cada etapa.
          </div>
        </div>
        <div className="flex gap-2">
          <Select value={pipelineId} onValueChange={setPipelineId}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Pipeline" /></SelectTrigger>
            <SelectContent>
              {pipelines.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={onProcessQueue} disabled={processing}>
            <Send className="h-4 w-4" /> Processar fila
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="text-left p-3 font-medium">Etapa do funil</th>
              <th className="text-left p-3 font-medium">
                {provider === "meta" ? "Evento Meta" : "Conversão Google"}
              </th>
              <th className="text-left p-3 font-medium">Valor</th>
              <th className="text-right p-3 font-medium">Ativo</th>
            </tr>
          </thead>
          <tbody>
            {filteredStages.map((s) => {
              const m = mapByStage.get(s.id);
              const rowCls = s.is_won ? "bg-emerald-500/5" : s.is_lost ? "bg-red-500/5" : "";
              return (
                <tr key={s.id} className={`border-t ${rowCls}`}>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                      <span>{s.name}</span>
                      {s.is_won && <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">Ganho</Badge>}
                      {s.is_lost && <Badge variant="destructive">Perdido</Badge>}
                    </div>
                  </td>
                  <td className="p-3">
                    {provider === "meta" ? (
                      <Select value={m?.event_name ?? "Nenhum"} onValueChange={(v) => setEvent(s.id, v)}>
                        <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {META_EVENTS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        defaultValue={m?.event_name ?? ""}
                        placeholder="Nome da conversion action"
                        onBlur={(e) => {
                          if ((m?.event_name ?? "") !== e.target.value)
                            setEvent(s.id, e.target.value || "Nenhum");
                        }}
                      />
                    )}
                  </td>
                  <td className="p-3">
                    <Select value={m?.value_mode ?? "none"} onValueChange={(v) => setValueMode(s.id, v as any)}>
                      <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem valor</SelectItem>
                        <SelectItem value="deal">Valor do deal</SelectItem>
                        <SelectItem value="fixed">Valor fixo</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3 text-right">
                    <Switch checked={m?.active ?? true} onCheckedChange={(v) => setActive(s.id, v)} />
                  </td>
                </tr>
              );
            })}
            {filteredStages.length === 0 && (
              <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Nenhuma etapa neste pipeline</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
