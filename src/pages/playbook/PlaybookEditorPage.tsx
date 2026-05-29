import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, ChevronRight, Save, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  usePlaybook, usePlaybookSteps, usePlaybookMutations, usePlaybookStepMutations,
  useStartPlaybookRun, ACTION_TYPES, CATEGORIES, type PlaybookStep,
} from "@/features/playbook/hooks";
import { useIsManagerOrAdmin } from "@/features/workspace/permissions";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

const COLORS = ["#8b5cf6", "#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#ec4899", "#06b6d4"];

export default function PlaybookEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: pb } = usePlaybook(id);
  const { data: steps = [] } = usePlaybookSteps(id);
  const { update } = usePlaybookMutations();
  const { upsert, remove, reorder } = usePlaybookStepMutations(id);
  const isManager = useIsManagerOrAdmin();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("geral");
  const [color, setColor] = useState("#8b5cf6");
  const [isActive, setIsActive] = useState(true);
  const [startOpen, setStartOpen] = useState(false);

  useEffect(() => {
    if (pb) {
      setName(pb.name);
      setDescription(pb.description ?? "");
      setCategory(pb.category ?? "geral");
      setColor(pb.color ?? "#8b5cf6");
      setIsActive(pb.is_active);
    }
  }, [pb]);

  const handleSaveMeta = () => {
    if (!id) return;
    update.mutate(
      { id, patch: { name, description, category, color, is_active: isActive } },
      { onSuccess: () => toast.success("Salvo") },
    );
  };

  const move = (idx: number, dir: -1 | 1) => {
    const newOrder = [...steps];
    const target = idx + dir;
    if (target < 0 || target >= newOrder.length) return;
    [newOrder[idx], newOrder[target]] = [newOrder[target], newOrder[idx]];
    reorder.mutate(newOrder.map((s) => s.id));
  };

  const addStep = () => {
    upsert.mutate({
      position: steps.length,
      title: `Passo ${steps.length + 1}`,
      action_type: "task",
      action_config: {},
      due_offset_days: 0,
      due_offset_hours: 0,
      is_required: false,
    });
  };

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm"><Link to="/playbook"><ArrowLeft className="h-4 w-4 mr-2" /> Voltar</Link></Button>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setStartOpen(true)} disabled={!steps.length}>
            <Play className="h-4 w-4 mr-2" /> Iniciar para 1 lead
          </Button>
          {isManager && (
            <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white" onClick={handleSaveMeta}>
              <Save className="h-4 w-4 mr-2" /> Salvar
            </Button>
          )}
        </div>
      </div>

      <Card className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!isManager} className="mt-1" />
          </div>
          <div>
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory} disabled={!isManager}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Descrição</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={!isManager} className="mt-1" rows={2} />
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <Label>Cor</Label>
            <div className="flex gap-1.5 mt-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => isManager && setColor(c)}
                  className="h-7 w-7 rounded-md border-2"
                  style={{ backgroundColor: c, borderColor: color === c ? "#000" : "transparent" }}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} disabled={!isManager} />
            <Label>Ativo</Label>
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Passos ({steps.length})</h2>
      </div>

      <div className="space-y-2">
        {steps.map((s, idx) => (
          <StepCard
            key={s.id}
            step={s}
            index={idx}
            total={steps.length}
            canEdit={isManager}
            onMove={(dir) => move(idx, dir)}
            onSave={(patch) => upsert.mutate({ id: s.id, ...patch })}
            onDelete={() => { if (confirm("Excluir passo?")) remove.mutate(s.id); }}
          />
        ))}
        {!steps.length && (
          <Card className="p-8 text-center border-dashed text-sm text-muted-foreground">
            Nenhum passo ainda. Adicione o primeiro abaixo.
          </Card>
        )}
      </div>

      {isManager && (
        <Button variant="outline" className="w-full" onClick={addStep}>
          <Plus className="h-4 w-4 mr-2" /> Adicionar passo
        </Button>
      )}

      <StartRunDialog open={startOpen} onOpenChange={setStartOpen} playbookId={id!} />
    </div>
  );
}

function StepCard({
  step, index, total, canEdit, onMove, onSave, onDelete,
}: {
  step: PlaybookStep;
  index: number;
  total: number;
  canEdit: boolean;
  onMove: (dir: -1 | 1) => void;
  onSave: (patch: Partial<PlaybookStep>) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(step.title ?? "");
  const [description, setDescription] = useState(step.description ?? "");
  const [actionType, setActionType] = useState(step.action_type);
  const [dueDays, setDueDays] = useState(step.due_offset_days ?? 0);
  const [dueHours, setDueHours] = useState(step.due_offset_hours ?? 0);
  const [required, setRequired] = useState(step.is_required);
  const [configRaw, setConfigRaw] = useState(JSON.stringify(step.action_config ?? {}, null, 2));

  useEffect(() => {
    setTitle(step.title ?? "");
    setDescription(step.description ?? "");
    setActionType(step.action_type);
    setDueDays(step.due_offset_days ?? 0);
    setDueHours(step.due_offset_hours ?? 0);
    setRequired(step.is_required);
    setConfigRaw(JSON.stringify(step.action_config ?? {}, null, 2));
  }, [step]);

  const handleSave = () => {
    let cfg: any = {};
    try { cfg = JSON.parse(configRaw || "{}"); } catch { toast.error("JSON inválido em action_config"); return; }
    onSave({
      title, description, action_type: actionType,
      due_offset_days: dueDays, due_offset_hours: dueHours,
      is_required: required, action_config: cfg,
    });
    toast.success("Passo salvo");
    setOpen(false);
  };

  const actionLabel = ACTION_TYPES.find((a) => a.value === step.action_type)?.label ?? step.action_type;

  return (
    <Card className="p-3">
      <div className="flex items-center gap-2">
        <button onClick={() => setOpen((v) => !v)} className="p-1 hover:bg-muted rounded">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <Badge variant="outline" className="font-mono">{index + 1}</Badge>
        <span className="font-medium flex-1 truncate">{step.title ?? "Sem título"}</span>
        <Badge variant="secondary">{actionLabel}</Badge>
        <Badge variant="outline" className="text-xs">
          D+{step.due_offset_days ?? 0}{(step.due_offset_hours ?? 0) > 0 ? ` ${step.due_offset_hours}h` : ""}
        </Badge>
        {canEdit && (
          <div className="flex items-center">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onMove(-1)} disabled={index === 0}><ChevronUp className="h-3 w-3" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onMove(1)} disabled={index === total - 1}><ChevronDown className="h-3 w-3" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}><Trash2 className="h-3 w-3" /></Button>
          </div>
        )}
      </div>

      {open && (
        <div className="mt-3 pt-3 border-t space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit} className="mt-1" />
            </div>
            <div>
              <Label>Tipo de ação</Label>
              <Select value={actionType} onValueChange={setActionType} disabled={!canEdit}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={!canEdit} rows={2} className="mt-1" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Atraso (dias)</Label>
              <Input type="number" min={0} value={dueDays} onChange={(e) => setDueDays(parseInt(e.target.value) || 0)} disabled={!canEdit} className="mt-1" />
            </div>
            <div>
              <Label>Atraso (horas)</Label>
              <Input type="number" min={0} max={23} value={dueHours} onChange={(e) => setDueHours(parseInt(e.target.value) || 0)} disabled={!canEdit} className="mt-1" />
            </div>
            <div className="flex items-end gap-2 pb-1">
              <Switch checked={required} onCheckedChange={setRequired} disabled={!canEdit} />
              <Label>Obrigatório</Label>
            </div>
          </div>
          <div>
            <Label>Configuração (JSON)</Label>
            <Textarea
              value={configRaw}
              onChange={(e) => setConfigRaw(e.target.value)}
              disabled={!canEdit}
              rows={4}
              className="mt-1 font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Ex: para WhatsApp template — {`{"template_id":"...","vars":{}}`}
            </p>
          </div>
          {canEdit && (
            <div className="flex justify-end">
              <Button size="sm" onClick={handleSave}>Salvar passo</Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function StartRunDialog({
  open, onOpenChange, playbookId,
}: { open: boolean; onOpenChange: (v: boolean) => void; playbookId: string }) {
  const { current } = useWorkspace();
  const startRun = useStartPlaybookRun();
  const [dealId, setDealId] = useState<string>("");

  const { data: deals = [] } = useQuery({
    queryKey: ["pb:deals-pick", current?.id],
    enabled: !!current && open,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("deals").select("id,title,contact_id").eq("workspace_id", current!.id)
        .order("created_at", { ascending: false }).limit(50);
      return (data ?? []) as { id: string; title: string; contact_id: string | null }[];
    },
  });

  const handleStart = async () => {
    const deal = deals.find((d) => d.id === dealId);
    if (!deal) return;
    try {
      await startRun.mutateAsync({ playbook_id: playbookId, deal_id: deal.id, contact_id: deal.contact_id });
      toast.success("Execução iniciada");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao iniciar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Iniciar playbook</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Label>Selecione o Deal</Label>
          <Select value={dealId} onValueChange={setDealId}>
            <SelectTrigger><SelectValue placeholder="Escolha um deal..." /></SelectTrigger>
            <SelectContent>
              {deals.map((d) => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleStart} disabled={!dealId || startRun.isPending}>Iniciar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
