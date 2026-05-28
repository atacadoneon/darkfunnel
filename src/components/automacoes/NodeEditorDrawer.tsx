import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useFlowNodeMutations, type FlowNode } from "@/hooks/useFlowNodes";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

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

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[480px] sm:max-w-[480px] flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle>Editar {LABELS[node.node_type] ?? node.node_type}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {node.node_type === "message" && <MessageEditor config={config} setConfig={setConfig} />}
          {node.node_type === "action" && <ActionEditor config={config} setConfig={setConfig} />}
          {node.node_type === "condition" && <ConditionEditor config={config} setConfig={setConfig} />}
          {node.node_type === "wait" && <WaitEditor config={config} setConfig={setConfig} />}
          {node.node_type === "random" && <RandomEditor config={config} setConfig={setConfig} />}
          {node.node_type === "api" && <ApiEditor config={config} setConfig={setConfig} />}
          {node.node_type === "fields" && <FieldsEditor config={config} setConfig={setConfig} />}
          {node.node_type === "ai" && <AiEditor config={config} setConfig={setConfig} />}
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

function MessageEditor({ config, setConfig }: any) {
  return (
    <>
      <div>
        <Label>Tipo</Label>
        <Select value={config.message_type ?? "text"} onValueChange={(v) => setConfig({ ...config, message_type: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Texto</SelectItem>
            <SelectItem value="image">Imagem</SelectItem>
            <SelectItem value="audio">Áudio</SelectItem>
            <SelectItem value="video">Vídeo</SelectItem>
            <SelectItem value="document">Documento</SelectItem>
            <SelectItem value="template">Template</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Mensagem</Label>
        <Textarea
          value={config.text ?? ""}
          onChange={(e) => setConfig({ ...config, text: e.target.value })}
          rows={6}
          placeholder="Olá {{lead.name}}, ..."
        />
        <p className="text-xs text-muted-foreground mt-1">
          Variáveis: {"{{lead.name}}"}, {"{{lead.phone}}"}, {"{{deal.title}}"}
        </p>
      </div>
    </>
  );
}

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

function ConditionEditor({ config, setConfig }: any) {
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
          <div key={i} className="grid grid-cols-12 gap-1 items-center">
            <Input placeholder="campo" className="col-span-4 h-8" value={c.field ?? ""}
              onChange={(e) => { const cs = [...conds]; cs[i] = { ...c, field: e.target.value }; setConds(cs); }} />
            <Select value={c.operator ?? "eq"} onValueChange={(v) => { const cs = [...conds]; cs[i] = { ...c, operator: v }; setConds(cs); }}>
              <SelectTrigger className="col-span-3 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["eq","neq","gt","gte","lt","lte","contains","not_contains","exists","not_exists","in","not_in"].map(op => (
                  <SelectItem key={op} value={op}>{op}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="valor" className="col-span-4 h-8" value={c.value ?? ""}
              onChange={(e) => { const cs = [...conds]; cs[i] = { ...c, value: e.target.value }; setConds(cs); }} />
            <Button size="icon" variant="ghost" className="col-span-1 h-8 w-8"
              onClick={() => setConds(conds.filter((_: any, j: number) => j !== i))}>
              <Trash2 className="h-3 w-3" />
            </Button>
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

function ApiEditor({ config, setConfig }: any) {
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
          <Input value={config.url ?? ""} onChange={(e) => setConfig({ ...config, url: e.target.value })} placeholder="https://..." />
        </div>
      </div>
      <div>
        <Label>Headers (JSON)</Label>
        <Textarea rows={3} className="font-mono text-xs" value={JSON.stringify(config.headers ?? {}, null, 2)}
          onChange={(e) => { try { setConfig({ ...config, headers: JSON.parse(e.target.value) }); } catch {} }} />
      </div>
      <div>
        <Label>Body (JSON)</Label>
        <Textarea rows={4} className="font-mono text-xs" value={typeof config.body === "string" ? config.body : JSON.stringify(config.body ?? {}, null, 2)}
          onChange={(e) => setConfig({ ...config, body: e.target.value })} />
      </div>
      <div>
        <Label>Timeout (ms)</Label>
        <Input type="number" value={config.timeout_ms ?? 10000} onChange={(e) => setConfig({ ...config, timeout_ms: Number(e.target.value) })} />
      </div>
    </>
  );
}

function FieldsEditor({ config, setConfig }: any) {
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
        <Input value={config.value ?? ""} onChange={(e) => setConfig({ ...config, value: e.target.value })} />
      </div>
    </>
  );
}

function AiEditor({ config, setConfig }: any) {
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
        <Textarea rows={6} value={config.prompt ?? ""} onChange={(e) => setConfig({ ...config, prompt: e.target.value })} />
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
