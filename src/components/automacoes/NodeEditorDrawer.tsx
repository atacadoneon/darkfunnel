import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useFlowNodeMutations, type FlowNode } from "@/hooks/useFlowNodes";
import { useChannels } from "@/features/channels/hooks";
import { toast } from "sonner";
import {
  Plus, Trash2, MessageCircle, MessageSquareReply, Clock, Mic, Paperclip, Link as LinkIcon,
  ArrowRightLeft, Settings, ArrowUp, ArrowDown, X,
} from "lucide-react";
import { VariableTextarea } from "./VariableTextarea";
import { nanoid } from "nanoid";
import { cn } from "@/lib/utils";

type Props = { open: boolean; onClose: () => void; node: FlowNode | null; flowId: string };

export function NodeEditorDrawer({ open, onClose, node, flowId }: Props) {
  const { updateNode } = useFlowNodeMutations(flowId);
  const [config, setConfig] = useState<any>({});

  useEffect(() => {
    setConfig(node?.config ?? {});
  }, [node]);

  if (!node) return null;

  const handleSave = async () => {
    try {
      await updateNode.mutateAsync({ id: node.id, patch: { config } });
      toast.success("Salvo");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    }
  };

  const ctx = { flowId, currentNodeId: node.id };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[560px] sm:max-w-[560px] flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle>Editar {LABELS[node.node_type] ?? node.node_type}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {node.node_type === "message" && <MessageEditor config={config} setConfig={setConfig} ctx={ctx} />}
          {node.node_type === "action" && <ActionEditor config={config} setConfig={setConfig} />}
          {node.node_type === "condition" && <ConditionEditor config={config} setConfig={setConfig} ctx={ctx} />}
          {node.node_type === "wait" && <WaitEditor config={config} setConfig={setConfig} />}
          {node.node_type === "random" && <RandomEditor config={config} setConfig={setConfig} />}
          {node.node_type === "api" && <ApiEditor config={config} setConfig={setConfig} ctx={ctx} />}
          {node.node_type === "fields" && <FieldsEditor config={config} setConfig={setConfig} ctx={ctx} />}
          {node.node_type === "ai" && <AiEditor config={config} setConfig={setConfig} ctx={ctx} />}
          {node.node_type === "javascript" && <JsEditor config={config} setConfig={setConfig} />}
        </div>

        <SheetFooter className="px-6 py-3 border-t">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

const LABELS: Record<string, string> = {
  message: "Mensagem", action: "Ação", condition: "Condição", wait: "Espera",
  random: "Randomizador", api: "API", fields: "Operações de campos", ai: "IA", javascript: "JavaScript",
};

/* ============== MESSAGE ============== */

const SUB_TYPES = [
  { type: "text", label: "Mensagem de texto", icon: MessageCircle },
  { type: "user_input", label: "Entrada do usuário", icon: MessageSquareReply },
  { type: "typing_delay", label: "Atraso de tempo", icon: Clock },
  { type: "audio", label: "Mensagem de áudio", icon: Mic },
  { type: "file", label: "Arquivo anexo", icon: Paperclip },
  { type: "file_url", label: "Arquivo URL dinâmica", icon: LinkIcon },
] as const;

function MessageEditor({ config, setConfig, ctx }: any) {
  const { data: channels = [] } = useChannels();
  const subblocks: any[] = config.subblocks ?? [];

  const setSubblocks = (next: any[]) => setConfig({ ...config, subblocks: next });
  const addSub = (subtype: string) => {
    const base: any = { id: `sb_${nanoid(6)}`, subtype };
    if (subtype === "text") Object.assign(base, { text: "", buttons: [], schedule_at: null });
    if (subtype === "user_input") Object.assign(base, { user_input_var: "resposta", user_input_timeout_minutes: 60 });
    if (subtype === "typing_delay") Object.assign(base, { amount: 2, unit: "seconds" });
    if (subtype === "audio") Object.assign(base, { media_url: "" });
    if (subtype === "file") Object.assign(base, { media_url: "", filename: "" });
    if (subtype === "file_url") Object.assign(base, { url: "" });
    setSubblocks([...subblocks, base]);
  };
  const updateSub = (id: string, patch: any) =>
    setSubblocks(subblocks.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const removeSub = (id: string) => setSubblocks(subblocks.filter((s) => s.id !== id));
  const moveSub = (id: string, dir: -1 | 1) => {
    const idx = subblocks.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= subblocks.length) return;
    const next = [...subblocks];
    [next[idx], next[j]] = [next[j], next[idx]];
    setSubblocks(next);
  };

  const whatsappChannels = channels.filter((c: any) => c.kind === "whatsapp" || c.kind === "whatsapp_uazapi" || c.kind === "whatsapp_cloud");
  const channelList = whatsappChannels.length ? whatsappChannels : channels;

  return (
    <>
      {/* Channel selector */}
      <div className="space-y-1">
        <Label>Conexão</Label>
        <div className="flex gap-1">
          <Select
            value={config.channel_id ?? "__inherit__"}
            onValueChange={(v) => setConfig({ ...config, channel_id: v === "__inherit__" ? null : v })}
          >
            <SelectTrigger className="flex-1"><SelectValue placeholder="Herdar do bloco anterior" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__inherit__">Herdar do bloco anterior</SelectItem>
              {channelList.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" title="Trocar canal"
            onClick={() => setConfig({ ...config, channel_id: null })}>
            <ArrowRightLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" title="Configurar canais"
            onClick={() => window.open("/settings/canais", "_blank")}>
            <Settings className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">Deixe em branco para usar a conexão dos blocos anteriores.</p>
      </div>

      {/* Error handle toggle */}
      <div className="flex items-center justify-between py-1">
        <div>
          <Label className="cursor-pointer">Caso ocorrer erro no envio</Label>
          <p className="text-[11px] text-muted-foreground">Habilita saída vermelha para tratar erros.</p>
        </div>
        <Switch
          checked={config.on_error_handle === "enabled"}
          onCheckedChange={(v) => setConfig({ ...config, on_error_handle: v ? "enabled" : "disabled" })}
        />
      </div>

      {/* Sub-blocks list */}
      <div className="space-y-2">
        <Label>Sub-blocos</Label>
        {subblocks.length === 0 && (
          <p className="text-xs text-muted-foreground border border-dashed rounded-md p-3 text-center">
            Adicione sub-blocos abaixo
          </p>
        )}
        {subblocks.map((sb, i) => (
          <SubblockCard
            key={sb.id}
            sb={sb}
            ctx={ctx}
            onChange={(patch) => updateSub(sb.id, patch)}
            onRemove={() => removeSub(sb.id)}
            onMoveUp={i > 0 ? () => moveSub(sb.id, -1) : undefined}
            onMoveDown={i < subblocks.length - 1 ? () => moveSub(sb.id, 1) : undefined}
          />
        ))}
      </div>

      {/* Add sub-block */}
      <div>
        <Label className="text-xs">Adicionar sub-bloco</Label>
        <div className="grid grid-cols-3 gap-2 mt-1">
          {SUB_TYPES.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.type}
                onClick={() => addSub(s.type)}
                className="flex flex-col items-center gap-1 p-2 border rounded-md hover:border-primary hover:bg-muted/40 text-xs"
              >
                <Icon className="h-4 w-4 text-primary" />
                <span className="text-center leading-tight">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

function SubblockCard({ sb, ctx, onChange, onRemove, onMoveUp, onMoveDown }: any) {
  const meta = SUB_TYPES.find((s) => s.type === sb.subtype);
  const Icon = meta?.icon ?? MessageCircle;
  return (
    <div className="border rounded-md bg-card">
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium flex-1">{meta?.label ?? sb.subtype}</span>
        <Button size="icon" variant="ghost" className="h-6 w-6" disabled={!onMoveUp} onClick={onMoveUp}>
          <ArrowUp className="h-3 w-3" />
        </Button>
        <Button size="icon" variant="ghost" className="h-6 w-6" disabled={!onMoveDown} onClick={onMoveDown}>
          <ArrowDown className="h-3 w-3" />
        </Button>
        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={onRemove}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      <div className="p-3 space-y-2">
        {sb.subtype === "text" && <TextSub sb={sb} ctx={ctx} onChange={onChange} />}
        {sb.subtype === "user_input" && (
          <>
            <div>
              <Label className="text-xs">Variável (nome)</Label>
              <Input value={sb.user_input_var ?? ""} onChange={(e) => onChange({ user_input_var: e.target.value })} placeholder="resposta" />
            </div>
            <div>
              <Label className="text-xs">Timeout (minutos)</Label>
              <Input type="number" value={sb.user_input_timeout_minutes ?? 60}
                onChange={(e) => onChange({ user_input_timeout_minutes: Number(e.target.value) })} />
            </div>
          </>
        )}
        {sb.subtype === "typing_delay" && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Quantidade</Label>
              <Input type="number" value={sb.amount ?? 2} onChange={(e) => onChange({ amount: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs">Unidade</Label>
              <Select value={sb.unit ?? "seconds"} onValueChange={(v) => onChange({ unit: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="seconds">Segundos</SelectItem>
                  <SelectItem value="minutes">Minutos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        {(sb.subtype === "audio" || sb.subtype === "file") && (
          <div>
            <Label className="text-xs">URL da mídia</Label>
            <Input value={sb.media_url ?? ""} onChange={(e) => onChange({ media_url: e.target.value })} placeholder="https://..." />
            {sb.subtype === "file" && (
              <Input className="mt-2" value={sb.filename ?? ""} onChange={(e) => onChange({ filename: e.target.value })} placeholder="nome.pdf" />
            )}
          </div>
        )}
        {sb.subtype === "file_url" && (
          <div>
            <Label className="text-xs">URL dinâmica</Label>
            <VariableTextarea
              value={sb.url ?? ""}
              onChange={(v) => onChange({ url: v })}
              placeholder="{{deal.proposal_pdf_url}}"
              multiline={false}
              flowId={ctx?.flowId}
              currentNodeId={ctx?.currentNodeId}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function TextSub({ sb, ctx, onChange }: any) {
  const buttons: any[] = sb.buttons ?? [];
  const addBtn = () => {
    if (buttons.length >= 3) return;
    onChange({ buttons: [...buttons, { id: `btn_${nanoid(6)}`, title: "" }] });
  };
  const updBtn = (id: string, title: string) =>
    onChange({ buttons: buttons.map((b) => (b.id === id ? { ...b, title: title.slice(0, 20) } : b)) });
  const rmBtn = (id: string) => onChange({ buttons: buttons.filter((b) => b.id !== id) });

  return (
    <>
      <div>
        <Label className="text-xs">Texto</Label>
        <VariableTextarea
          value={sb.text ?? ""}
          onChange={(v) => onChange({ text: v })}
          placeholder="Olá {{lead.first_name}}..."
          rows={4}
          flowId={ctx?.flowId}
          currentNodeId={ctx?.currentNodeId}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Botões interativos (máx 3)</Label>
        {buttons.map((b) => (
          <div key={b.id} className="flex items-center gap-1">
            <Input
              value={b.title}
              maxLength={20}
              onChange={(e) => updBtn(b.id, e.target.value)}
              placeholder="Texto do botão"
              className="h-8"
            />
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => rmBtn(b.id)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
        {buttons.length < 3 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addBtn}
            className="w-full h-8 border-dashed border-primary/60 text-primary hover:bg-primary/5"
          >
            <Plus className="h-3 w-3 mr-1" /> Adicionar botão
          </Button>
        )}
      </div>

      <div>
        <Label className="text-xs">Agendar envio (opcional)</Label>
        <Input
          type="datetime-local"
          value={sb.schedule_at ?? ""}
          onChange={(e) => onChange({ schedule_at: e.target.value || null })}
        />
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Se preenchido, a mensagem será enviada apenas neste momento.
        </p>
      </div>
    </>
  );
}

/* ============== OTHER EDITORS ============== */

function ActionEditor({ config, setConfig }: any) {
  return (
    <div>
      <Label>Ação</Label>
      <Select value={config.action_type ?? ""} onValueChange={(v) => setConfig({ ...config, action_type: v })}>
        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
        <SelectContent>
          <SelectItem value="move_deal">Mover negócio</SelectItem>
          <SelectItem value="create_activity">Criar atividade</SelectItem>
          <SelectItem value="add_tag">Adicionar tag</SelectItem>
          <SelectItem value="remove_tag">Remover tag</SelectItem>
          <SelectItem value="add_list">Adicionar à lista</SelectItem>
          <SelectItem value="remove_list">Remover da lista</SelectItem>
          <SelectItem value="assign_user">Atribuir vendedor</SelectItem>
          <SelectItem value="change_department">Mudar departamento</SelectItem>
          <SelectItem value="create_task">Criar tarefa</SelectItem>
          <SelectItem value="update_lead">Atualizar lead</SelectItem>
          <SelectItem value="note">Adicionar nota</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function ConditionEditor({ config, setConfig, ctx }: any) {
  const conds = config.conditions ?? [];
  const setConds = (c: any[]) => setConfig({ ...config, conditions: c });
  return (
    <>
      <div>
        <Label>Lógica</Label>
        <Select value={config.logic ?? "and"} onValueChange={(v) => setConfig({ ...config, logic: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="and">Todas (E)</SelectItem>
            <SelectItem value="or">Qualquer (OU)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        {conds.map((c: any, i: number) => (
          <div key={i} className="space-y-1 border p-2 rounded-md">
            <div className="grid grid-cols-12 gap-1 items-center">
              <div className="col-span-7">
                <VariableTextarea
                  value={c.field ?? ""}
                  onChange={(v) => { const cs = [...conds]; cs[i] = { ...c, field: v }; setConds(cs); }}
                  placeholder="{{lead.first_name}}"
                  multiline={false}
                  flowId={ctx?.flowId}
                  currentNodeId={ctx?.currentNodeId}
                />
              </div>
              <Select value={c.operator ?? "eq"} onValueChange={(v) => { const cs = [...conds]; cs[i] = { ...c, operator: v }; setConds(cs); }}>
                <SelectTrigger className="col-span-4 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["eq","neq","gt","gte","lt","lte","contains","not_contains","exists","not_exists","in","not_in"].map(op => (
                    <SelectItem key={op} value={op}>{op}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="icon" variant="ghost" className="col-span-1 h-8 w-8"
                onClick={() => setConds(conds.filter((_: any, j: number) => j !== i))}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <VariableTextarea
              value={c.value ?? ""}
              onChange={(v) => { const cs = [...conds]; cs[i] = { ...c, value: v }; setConds(cs); }}
              placeholder="valor"
              multiline={false}
              flowId={ctx?.flowId}
              currentNodeId={ctx?.currentNodeId}
            />
          </div>
        ))}
        <Button size="sm" variant="outline" className="w-full" onClick={() => setConds([...conds, { field: "", operator: "eq", value: "" }])}>
          <Plus className="h-3 w-3 mr-1" /> Adicionar condição
        </Button>
      </div>
    </>
  );
}

function WaitEditor({ config, setConfig }: any) {
  return (
    <>
      <div>
        <Label>Tipo de espera</Label>
        <Select value={config.wait_type ?? "fixed"} onValueChange={(v) => setConfig({ ...config, wait_type: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="fixed">Tempo fixo</SelectItem>
            <SelectItem value="weekday">Dia da semana</SelectItem>
            <SelectItem value="date">Data específica</SelectItem>
            <SelectItem value="business_hours">Horário comercial</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {(config.wait_type ?? "fixed") === "fixed" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Quantidade</Label>
            <Input type="number" value={config.amount ?? 0} onChange={(e) => setConfig({ ...config, amount: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Unidade</Label>
            <Select value={config.unit ?? "minutes"} onValueChange={(v) => setConfig({ ...config, unit: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="seconds">Segundos</SelectItem>
                <SelectItem value="minutes">Minutos</SelectItem>
                <SelectItem value="hours">Horas</SelectItem>
                <SelectItem value="days">Dias</SelectItem>
                <SelectItem value="weeks">Semanas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </>
  );
}

function RandomEditor({ config, setConfig }: any) {
  const variants = config.variants ?? [];
  const setVariants = (v: any[]) => setConfig({ ...config, variants: v });
  return (
    <div className="space-y-2">
      <Label>Variantes (peso 0-100, soma deve ser 100)</Label>
      {variants.map((v: any, i: number) => (
        <div key={i} className="grid grid-cols-12 gap-1 items-center">
          <Input placeholder="Label" className="col-span-7 h-8" value={v.label ?? ""}
            onChange={(e) => { const vs = [...variants]; vs[i] = { ...v, label: e.target.value }; setVariants(vs); }} />
          <Input type="number" placeholder="Peso" className="col-span-4 h-8" value={v.weight ?? 0}
            onChange={(e) => { const vs = [...variants]; vs[i] = { ...v, weight: Number(e.target.value) }; setVariants(vs); }} />
          <Button size="icon" variant="ghost" className="col-span-1 h-8 w-8" onClick={() => setVariants(variants.filter((_: any, j: number) => j !== i))}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <Button size="sm" variant="outline" className="w-full" onClick={() => setVariants([...variants, { id: `variant_${variants.length}`, label: `Variante ${variants.length + 1}`, weight: 0 }])}>
        <Plus className="h-3 w-3 mr-1" /> Adicionar variante
      </Button>
    </div>
  );
}

function ApiEditor({ config, setConfig, ctx }: any) {
  return (
    <>
      <div className="grid grid-cols-4 gap-2">
        <div>
          <Label>Método</Label>
          <Select value={config.method ?? "GET"} onValueChange={(v) => setConfig({ ...config, method: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["GET","POST","PUT","PATCH","DELETE"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-3">
          <Label>URL</Label>
          <VariableTextarea
            value={config.url ?? ""}
            onChange={(v) => setConfig({ ...config, url: v })}
            placeholder="https://..."
            multiline={false}
            flowId={ctx?.flowId}
            currentNodeId={ctx?.currentNodeId}
          />
        </div>
      </div>
      <div>
        <Label>Headers (JSON)</Label>
        <Textarea rows={3} className="font-mono text-xs" value={JSON.stringify(config.headers ?? {}, null, 2)}
          onChange={(e) => { try { setConfig({ ...config, headers: JSON.parse(e.target.value) }); } catch {} }} />
      </div>
      <div>
        <Label>Body (JSON)</Label>
        <VariableTextarea
          value={typeof config.body === "string" ? config.body : JSON.stringify(config.body ?? {}, null, 2)}
          onChange={(v) => setConfig({ ...config, body: v })}
          rows={4}
          flowId={ctx?.flowId}
          currentNodeId={ctx?.currentNodeId}
        />
      </div>
      <div>
        <Label>Timeout (ms)</Label>
        <Input type="number" value={config.timeout_ms ?? 10000} onChange={(e) => setConfig({ ...config, timeout_ms: Number(e.target.value) })} />
      </div>
    </>
  );
}

function FieldsEditor({ config, setConfig, ctx }: any) {
  return (
    <>
      <div>
        <Label>Alvo</Label>
        <Select value={config.target ?? "lead"} onValueChange={(v) => setConfig({ ...config, target: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="lead">Lead</SelectItem>
            <SelectItem value="deal">Negócio</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Campo</Label>
        <Input value={config.field_path ?? ""} onChange={(e) => setConfig({ ...config, field_path: e.target.value })} placeholder="custom_fields.foo" />
      </div>
      <div>
        <Label>Operação</Label>
        <Select value={config.operation ?? "set"} onValueChange={(v) => setConfig({ ...config, operation: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {["set","clear","increment","decrement","append","prepend","replace"].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Valor</Label>
        <VariableTextarea
          value={config.value ?? ""}
          onChange={(v) => setConfig({ ...config, value: v })}
          multiline={false}
          flowId={ctx?.flowId}
          currentNodeId={ctx?.currentNodeId}
        />
      </div>
    </>
  );
}

function AiEditor({ config, setConfig, ctx }: any) {
  return (
    <>
      <div>
        <Label>Modelo</Label>
        <Select value={config.model ?? "google/gemini-2.5-flash"} onValueChange={(v) => setConfig({ ...config, model: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="google/gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
            <SelectItem value="google/gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
            <SelectItem value="openai/gpt-5-mini">GPT-5 Mini</SelectItem>
            <SelectItem value="openai/gpt-5">GPT-5</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Prompt</Label>
        <VariableTextarea
          value={config.prompt ?? ""}
          onChange={(v) => setConfig({ ...config, prompt: v })}
          rows={6}
          flowId={ctx?.flowId}
          currentNodeId={ctx?.currentNodeId}
        />
      </div>
      <div>
        <Label>Temperatura: {config.temperature ?? 0.7}</Label>
        <Slider value={[config.temperature ?? 0.7]} min={0} max={2} step={0.1}
          onValueChange={(v) => setConfig({ ...config, temperature: v[0] })} />
      </div>
      <div>
        <Label>Max tokens</Label>
        <Input type="number" value={config.max_tokens ?? 1000} onChange={(e) => setConfig({ ...config, max_tokens: Number(e.target.value) })} />
      </div>
      <div>
        <Label>Variável de saída</Label>
        <Input value={config.response_var ?? "ai_response"} onChange={(e) => setConfig({ ...config, response_var: e.target.value })} />
      </div>
    </>
  );
}

function JsEditor({ config, setConfig }: any) {
  return (
    <>
      <div>
        <Label>Código JavaScript</Label>
        <Textarea
          className="font-mono text-xs"
          rows={14}
          value={config.code ?? "// return value\nreturn { ok: true };"}
          onChange={(e) => setConfig({ ...config, code: e.target.value })}
        />
      </div>
      <div>
        <Label>Timeout (ms)</Label>
        <Input type="number" value={config.timeout_ms ?? 5000} onChange={(e) => setConfig({ ...config, timeout_ms: Number(e.target.value) })} />
      </div>
    </>
  );
}
