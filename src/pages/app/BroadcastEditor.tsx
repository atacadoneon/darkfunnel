import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, ArrowRight, Check, Save, Send, Users, Eye, Calendar as CalIcon,
  ChevronsUpDown, X, Loader2, Upload, Code,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import {
  useBroadcast, useUpsertBroadcast, usePreviewRecipients, type RecipientPreview,
} from "@/features/broadcasts/hooks";
import { useChannels } from "@/features/channels/hooks";
import { useStages } from "@/features/pipeline/hooks";
import { useLists, useCadastrosTags } from "@/features/cadastros/hooks";
import { useInvokableFlows } from "@/hooks/useFlow";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";

type Filters = {
  tag_ids: string[];
  pipeline_ids: string[];
  stage_ids: string[];
  seller_ids: string[];
  city: string;
  list_ids: string[];
  created_within_days: number | null;
  last_interaction_within_days: number | null;
  require_valid_phone: boolean;
  skip_blocked: boolean;
};

const EMPTY_FILTERS: Filters = {
  tag_ids: [], pipeline_ids: [], stage_ids: [], seller_ids: [],
  city: "", list_ids: [],
  created_within_days: null, last_interaction_within_days: null,
  require_valid_phone: true, skip_blocked: true,
};

const STEPS = [
  { n: 1, label: "Destinatários" },
  { n: 2, label: "Mensagem" },
  { n: 3, label: "Pós-disparo" },
  { n: 4, label: "Agendamento" },
];

/* ----------------------- Multi-select chip popover ----------------------- */
function MultiPicker({
  options, value, onChange, placeholder = "Selecionar...",
}: {
  options: Array<{ id: string; label: string }>;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const selected = options.filter((o) => value.includes(o.id));
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between font-normal">
          <span className="truncate text-left">
            {selected.length === 0
              ? <span className="text-muted-foreground">{placeholder}</span>
              : selected.length <= 2
                ? selected.map((s) => s.label).join(", ")
                : `${selected.length} selecionados`}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 max-h-72 overflow-y-auto">
        {options.length === 0 ? (
          <div className="p-3 text-xs text-muted-foreground">Nenhuma opção</div>
        ) : (
          options.map((o) => (
            <button
              key={o.id}
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
              onClick={() => toggle(o.id)}
            >
              <Checkbox checked={value.includes(o.id)} />
              <span className="truncate">{o.label}</span>
            </button>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ----------------------- Pipelines (sem hook dedicado) ----------------------- */
function usePipelines() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["pipelines", current?.id],
    enabled: !!current,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipelines" as any)
        .select("id,name")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string }>;
    },
  });
}

function useSellers() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["workspace-sellers", current?.id],
    enabled: !!current,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_sellers" as any)
        .select("id,name")
        .eq("workspace_id", current!.id)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string | null }>;
    },
  });
}

/* =================================================================== */
export default function BroadcastEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const isNew = !id || id === "novo";
  const { data: existing } = useBroadcast(isNew ? undefined : id);
  const upsert = useUpsertBroadcast();
  const preview = usePreviewRecipients();

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [previewData, setPreviewData] = useState<RecipientPreview | null>(null);

  const [channelId, setChannelId] = useState<string>("");
  const [messageTemplate, setMessageTemplate] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string>("");

  const [createTask, setCreateTask] = useState(false);
  const [taskTemplate, setTaskTemplate] = useState("");
  const [taskOffsetDays, setTaskOffsetDays] = useState<number>(1);

  const [invokeFlowEnabled, setInvokeFlowEnabled] = useState(false);
  const [invokeFlowId, setInvokeFlowId] = useState<string>("");

  const [whenMode, setWhenMode] = useState<"now" | "scheduled">("now");
  const [scheduledAt, setScheduledAt] = useState<string>(() => {
    const d = new Date(Date.now() + 60 * 60_000);
    d.setSeconds(0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  });
  const [ratePerMinute, setRatePerMinute] = useState(30);

  /* Carregar existente */
  useEffect(() => {
    if (!existing) return;
    setName(existing.name ?? "");
    setFilters({ ...EMPTY_FILTERS, ...(existing.filters ?? {}) });
    setChannelId(existing.channel_id ?? "");
    setMessageTemplate(existing.message_template ?? "");
    setMediaUrl(existing.media_url ?? "");
    setCreateTask(!!existing.create_task);
    setTaskTemplate(existing.task_template ?? "");
    setTaskOffsetDays(existing.task_offset_days ?? 1);
    setInvokeFlowEnabled(!!existing.invoke_flow_id);
    setInvokeFlowId(existing.invoke_flow_id ?? "");
    setRatePerMinute(existing.rate_per_minute ?? 30);
    if (existing.scheduled_at) {
      setWhenMode("scheduled");
      const d = new Date(existing.scheduled_at);
      setScheduledAt(new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16));
    }
  }, [existing]);

  /* Sources */
  const { data: channels = [] } = useChannels();
  const { data: tags = [] } = useCadastrosTags();
  const { data: pipelines = [] } = usePipelines();
  const { data: stages = [] } = useStages();
  const { data: sellers = [] } = useSellers();
  const { data: lists = [] } = useLists();
  const { data: invokableFlows = [] } = useInvokableFlows();

  const filteredStages = useMemo(() => {
    if (filters.pipeline_ids.length === 0) return stages as any[];
    return (stages as any[]).filter((s) => filters.pipeline_ids.includes(s.pipeline_id));
  }, [stages, filters.pipeline_ids]);

  const channel = channels.find((c: any) => c.id === channelId) as any;

  /* Render preview rendering with first sample */
  const renderedPreview = useMemo(() => {
    const sample = previewData?.sample?.[0];
    if (!sample) return messageTemplate;
    return messageTemplate
      .replace(/\{\{contact\.first_name\}\}/g, (sample.display_name ?? "").split(" ")[0] || "")
      .replace(/\{\{contact\.name\}\}/g, sample.display_name ?? "")
      .replace(/\{\{contact\.phone\}\}/g, sample.phone_e164 ?? "");
  }, [messageTemplate, previewData]);

  /* Handlers */
  async function runPreview() {
    try {
      const data = await preview.mutateAsync(filters);
      setPreviewData(data);
      toast.success(`${data.total} destinatários encontrados`);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao prever destinatários");
    }
  }

  function buildPayload(status: "draft" | "scheduled" | "running") {
    return {
      name: name || "Disparo sem nome",
      status,
      channel_id: channelId || null,
      filters,
      message_template: messageTemplate || null,
      media_url: mediaUrl || null,
      total_recipients: previewData?.total ?? 0,
      scheduled_at: whenMode === "scheduled" ? new Date(scheduledAt).toISOString() : null,
      rate_per_minute: ratePerMinute,
      create_task: createTask,
      task_template: createTask ? taskTemplate : null,
      task_offset_days: createTask ? taskOffsetDays : null,
      invoke_flow_id: invokeFlowEnabled ? (invokeFlowId || null) : null,
    } as any;
  }

  async function save(status: "draft" | "scheduled" | "running") {
    try {
      const payload = buildPayload(status);
      const b = await upsert.mutateAsync(isNew ? payload : { id, ...payload });
      toast.success(status === "draft" ? "Rascunho salvo" : "Disparo criado");
      if (isNew) nav(`/broadcasts/${b.id}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar");
    }
  }

  function insertVariable(v: string) {
    setMessageTemplate((m) => m + ` {{${v}}}`);
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => nav("/broadcasts")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <Input
            placeholder="Nome do disparo..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-lg font-semibold border-transparent hover:border-input focus:border-input h-9"
          />
        </div>
        <Button variant="outline" onClick={() => save("draft")} disabled={upsert.isPending}>
          <Save className="h-4 w-4 mr-1.5" /> Salvar rascunho
        </Button>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const active = step === s.n;
          const done = step > s.n;
          return (
            <div key={s.n} className="flex items-center gap-2 flex-1">
              <button
                onClick={() => setStep(s.n)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors w-full",
                  active && "bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/30",
                  done && "text-muted-foreground",
                  !active && !done && "text-muted-foreground hover:bg-accent",
                )}
              >
                <span className={cn(
                  "h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold",
                  active ? "bg-violet-600 text-white" : done ? "bg-emerald-500 text-white" : "bg-muted",
                )}>
                  {done ? <Check className="h-3 w-3" /> : s.n}
                </span>
                <span className="hidden md:inline">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && <div className="hidden md:block h-px flex-1 bg-border" />}
            </div>
          );
        })}
      </div>

      {/* PASSO 1 */}
      {step === 1 && (
        <Card className="p-5 space-y-4">
          <h2 className="font-semibold">Quem vai receber</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Tags</Label>
              <MultiPicker
                options={(tags as any[]).map((t) => ({ id: t.id, label: t.name }))}
                value={filters.tag_ids}
                onChange={(v) => setFilters((f) => ({ ...f, tag_ids: v }))}
                placeholder="Todas as tags"
              />
            </div>
            <div>
              <Label>Listas</Label>
              <MultiPicker
                options={(lists as any[]).map((l) => ({ id: l.id, label: l.name }))}
                value={filters.list_ids}
                onChange={(v) => setFilters((f) => ({ ...f, list_ids: v }))}
                placeholder="Todas as listas"
              />
            </div>
            <div>
              <Label>Pipelines</Label>
              <MultiPicker
                options={(pipelines as any[]).map((p) => ({ id: p.id, label: p.name }))}
                value={filters.pipeline_ids}
                onChange={(v) => setFilters((f) => ({ ...f, pipeline_ids: v, stage_ids: [] }))}
                placeholder="Todos os pipelines"
              />
            </div>
            <div>
              <Label>Etapas {filters.pipeline_ids.length === 0 && <span className="text-xs text-muted-foreground">(selecione pipeline primeiro)</span>}</Label>
              <MultiPicker
                options={(filteredStages as any[]).map((s) => ({ id: s.id, label: s.name }))}
                value={filters.stage_ids}
                onChange={(v) => setFilters((f) => ({ ...f, stage_ids: v }))}
                placeholder="Todas as etapas"
              />
            </div>
            <div>
              <Label>Vendedor responsável</Label>
              <MultiPicker
                options={(sellers as any[]).map((s) => ({ id: s.id, label: s.name || "—" }))}
                value={filters.seller_ids}
                onChange={(v) => setFilters((f) => ({ ...f, seller_ids: v }))}
                placeholder="Todos os vendedores"
              />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input
                value={filters.city}
                onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))}
                placeholder="Ex: São Paulo"
              />
            </div>
            <div>
              <Label>Cadastrado nos últimos (dias)</Label>
              <Input
                type="number"
                min={0}
                value={filters.created_within_days ?? ""}
                onChange={(e) => setFilters((f) => ({ ...f, created_within_days: e.target.value ? +e.target.value : null }))}
                placeholder="Qualquer"
              />
            </div>
            <div>
              <Label>Última interação nos últimos (dias)</Label>
              <Input
                type="number"
                min={0}
                value={filters.last_interaction_within_days ?? ""}
                onChange={(e) => setFilters((f) => ({ ...f, last_interaction_within_days: e.target.value ? +e.target.value : null }))}
                placeholder="Qualquer"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-6 pt-2 border-t">
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={filters.require_valid_phone}
                onCheckedChange={(v) => setFilters((f) => ({ ...f, require_valid_phone: v }))}
              />
              Exigir telefone E.164 válido
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={filters.skip_blocked}
                onCheckedChange={(v) => setFilters((f) => ({ ...f, skip_blocked: v }))}
              />
              Pular contatos bloqueados
            </label>
          </div>

          <div className="pt-3 border-t">
            <Button onClick={runPreview} disabled={preview.isPending} variant="outline">
              {preview.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Eye className="h-4 w-4 mr-1.5" />}
              Pré-visualizar destinatários
            </Button>
            {previewData && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-violet-500" />
                  <span className="text-3xl font-bold tabular-nums">{previewData.total}</span>
                  <span className="text-sm text-muted-foreground">destinatários encontrados</span>
                </div>
                {previewData.sample.length > 0 && (
                  <Card className="overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Telefone</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.sample.slice(0, 20).map((c) => (
                          <TableRow key={c.contact_id}>
                            <TableCell>{c.display_name ?? "—"}</TableCell>
                            <TableCell className="font-mono text-xs">{c.phone_e164 ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* PASSO 2 */}
      {step === 2 && (
        <Card className="p-5 space-y-4">
          <h2 className="font-semibold">Mensagem</h2>
          <div>
            <Label>Canal de envio</Label>
            <Select value={channelId} onValueChange={setChannelId}>
              <SelectTrigger><SelectValue placeholder="Selecione um canal" /></SelectTrigger>
              <SelectContent>
                {(channels as any[]).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Mensagem</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 text-xs">
                    <Code className="h-3 w-3 mr-1" /> Variáveis
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-56 p-1">
                  {["contact.first_name", "contact.name", "contact.phone", "contact.email"].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insertVariable(v)}
                      className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent font-mono"
                    >
                      {`{{${v}}}`}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            </div>
            <Textarea
              rows={6}
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              placeholder="Olá {{contact.first_name}}, ..."
            />
          </div>

          <div>
            <Label>Mídia (opcional)</Label>
            <div className="flex gap-2">
              <Input
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="URL da imagem/vídeo/PDF"
              />
              <Button variant="outline" disabled title="Upload em breve"><Upload className="h-4 w-4" /></Button>
            </div>
          </div>

          {messageTemplate && (
            <div className="border-t pt-4">
              <Label className="text-xs text-muted-foreground">Pré-visualização {previewData?.sample?.[0] ? `(${previewData.sample[0].display_name})` : ""}</Label>
              <div className="mt-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-sm whitespace-pre-wrap max-w-md">
                {renderedPreview || messageTemplate}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* PASSO 3 */}
      {step === 3 && (
        <div className="space-y-4">
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Criar tarefa para o vendedor responsável</h3>
                <p className="text-xs text-muted-foreground">Após disparar, cria uma tarefa atribuída ao vendedor de cada contato.</p>
              </div>
              <Switch checked={createTask} onCheckedChange={setCreateTask} />
            </div>
            {createTask && (
              <div className="space-y-2 pt-2 border-t">
                <div>
                  <Label>Descrição da tarefa</Label>
                  <Textarea
                    rows={3}
                    value={taskTemplate}
                    onChange={(e) => setTaskTemplate(e.target.value)}
                    placeholder="Ligar para {{contact.first_name}} 24h após disparo"
                  />
                </div>
                <div>
                  <Label>Vencer em (dias após envio)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={taskOffsetDays}
                    onChange={(e) => setTaskOffsetDays(+e.target.value || 0)}
                    className="w-32"
                  />
                </div>
              </div>
            )}
          </Card>

          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Invocar automação para cada destinatário</h3>
                <p className="text-xs text-muted-foreground">Dispara um fluxo manual para cada contato após o envio.</p>
              </div>
              <Switch checked={invokeFlowEnabled} onCheckedChange={setInvokeFlowEnabled} />
            </div>
            {invokeFlowEnabled && (
              <div className="pt-2 border-t">
                <Label>Automação</Label>
                <Select value={invokeFlowId} onValueChange={setInvokeFlowId}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma automação invocável" /></SelectTrigger>
                  <SelectContent>
                    {(invokableFlows as any[]).length === 0 ? (
                      <div className="px-2 py-3 text-xs text-muted-foreground">Nenhuma automação marcada como invocável.</div>
                    ) : (invokableFlows as any[]).map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.manual_invoke_label ?? f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* PASSO 4 */}
      {step === 4 && (
        <div className="space-y-4">
          <Card className="p-5 space-y-4">
            <h3 className="font-semibold">Quando disparar</h3>
            <RadioGroup value={whenMode} onValueChange={(v) => setWhenMode(v as any)}>
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="now" /> Agora
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="scheduled" /> Agendar para data e hora
              </label>
            </RadioGroup>
            {whenMode === "scheduled" && (
              <div>
                <Label>Data e hora</Label>
                <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="w-64" />
              </div>
            )}

            <div className="pt-3 border-t">
              <div className="flex items-center justify-between mb-2">
                <Label>Rate limit (mensagens por minuto)</Label>
                <Badge variant="secondary">{ratePerMinute}/min</Badge>
              </div>
              <Slider value={[ratePerMinute]} min={5} max={60} step={5} onValueChange={([v]) => setRatePerMinute(v)} />
            </div>
          </Card>

          <Card className="p-5 space-y-2 text-sm">
            <h3 className="font-semibold">Resumo</h3>
            <div className="grid sm:grid-cols-2 gap-2">
              <div><span className="text-muted-foreground">Nome:</span> {name || "—"}</div>
              <div><span className="text-muted-foreground">Destinatários:</span> {previewData?.total ?? 0}</div>
              <div><span className="text-muted-foreground">Canal:</span> {channel?.name ?? "—"}</div>
              <div><span className="text-muted-foreground">Quando:</span> {whenMode === "now" ? "Agora" : new Date(scheduledAt).toLocaleString("pt-BR")}</div>
              <div className="sm:col-span-2"><span className="text-muted-foreground">Mensagem:</span> {messageTemplate ? messageTemplate.slice(0, 120) : "—"}</div>
              <div className="sm:col-span-2 flex flex-wrap gap-2">
                {createTask && <Badge variant="secondary">+ Tarefa pós-disparo</Badge>}
                {invokeFlowEnabled && invokeFlowId && <Badge variant="secondary">+ Invoca automação</Badge>}
              </div>
            </div>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => save("draft")} disabled={upsert.isPending}>
              <Save className="h-4 w-4 mr-1.5" /> Salvar rascunho
            </Button>
            <Button
              className="bg-violet-600 hover:bg-violet-700 text-white"
              onClick={() => save(whenMode === "scheduled" ? "scheduled" : "running")}
              disabled={upsert.isPending || !channelId || !messageTemplate}
            >
              {upsert.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
              Disparar
            </Button>
          </div>
        </div>
      )}

      {/* Step nav */}
      <div className="flex justify-between pt-2">
        <Button variant="ghost" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar
        </Button>
        {step < 4 && (
          <Button onClick={() => setStep((s) => Math.min(4, s + 1))}>
            Próximo <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
