import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, GripVertical, MessageSquare, Clock, GitBranch } from "lucide-react";
import { useChannels } from "@/features/channels/hooks";
import { useCadenceMutations, useCadenceSteps } from "@/hooks/useCadences";
import {
  STEP_LABEL, TRIGGER_LABEL,
  type Cadence, type CadenceStepType, type CadenceTriggerType,
} from "@/types/cadence";
import { toast } from "sonner";

type DraftStep = {
  type: CadenceStepType;
  content: Record<string, unknown>;
  delay_minutes: number;
};

const STEP_ICON: Record<CadenceStepType, typeof MessageSquare> = {
  message: MessageSquare,
  wait: Clock,
  condition: GitBranch,
};

export function CadenceDialog({
  open, onClose, cadence,
}: { open: boolean; onClose: () => void; cadence: Cadence | null }) {
  const { data: channels = [] } = useChannels();
  const { create, update } = useCadenceMutations();
  const { data: existingSteps = [] } = useCadenceSteps(cadence?.id ?? null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [channelId, setChannelId] = useState<string | null>(null);
  const [triggerType, setTriggerType] = useState<CadenceTriggerType>("manual");
  const [steps, setSteps] = useState<DraftStep[]>([]);

  useEffect(() => {
    if (!open) return;
    setName(cadence?.name ?? "");
    setDescription(cadence?.description ?? "");
    setChannelId(cadence?.channel_id ?? null);
    setTriggerType(cadence?.trigger_type ?? "manual");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cadence?.id]);

  useEffect(() => {
    if (!open) return;
    setSteps(
      existingSteps.map((s) => ({ type: s.type, content: s.content, delay_minutes: s.delay_minutes })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cadence?.id, existingSteps.length]);

  const addStep = (type: CadenceStepType) => {
    const base: DraftStep = type === "message"
      ? { type, content: { text: "" }, delay_minutes: 0 }
      : type === "wait"
      ? { type, content: {}, delay_minutes: 60 }
      : { type, content: { rule: "" }, delay_minutes: 0 };
    setSteps([...steps, base]);
  };

  const moveStep = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    setSteps(next);
  };

  const handleSave = async () => {
    if (!name.trim()) return toast.error("Nome obrigatório");
    try {
      if (cadence) {
        await update.mutateAsync({
          id: cadence.id,
          patch: {
            name: name.trim(),
            description: description.trim() || null,
            channel_id: channelId,
            trigger_type: triggerType,
          },
        });
        toast.success("Cadência atualizada");
      } else {
        await create.mutateAsync({
          name: name.trim(),
          description: description.trim() || undefined,
          channel_id: channelId,
          trigger_type: triggerType,
          steps,
        });
        toast.success("Cadência criada");
      }
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{cadence ? "Editar cadência" : "Nova cadência"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Nome*</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Recuperação 7 dias" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Descrição</Label>
              <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Canal</Label>
              <Select value={channelId ?? "none"} onValueChange={(v) => setChannelId(v === "none" ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {channels.map((c) => <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Trigger</Label>
              <Select value={triggerType} onValueChange={(v) => setTriggerType(v as CadenceTriggerType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TRIGGER_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Steps</Label>
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" onClick={() => addStep("message")}>
                  <MessageSquare className="h-3.5 w-3.5 mr-1" /> Mensagem
                </Button>
                <Button size="sm" variant="outline" onClick={() => addStep("wait")}>
                  <Clock className="h-3.5 w-3.5 mr-1" /> Espera
                </Button>
                <Button size="sm" variant="outline" onClick={() => addStep("condition")}>
                  <GitBranch className="h-3.5 w-3.5 mr-1" /> Condição
                </Button>
              </div>
            </div>
            {steps.length === 0 && <p className="text-xs text-muted-foreground">Adicione steps para compor o fluxo.</p>}
            {steps.map((s, i) => {
              const Icon = STEP_ICON[s.type];
              return (
                <div key={i} className="flex items-start gap-2 rounded-md border bg-muted/30 p-2">
                  <div className="flex flex-col items-center gap-0.5 pt-1">
                    <button onClick={() => moveStep(i, -1)} className="text-muted-foreground hover:text-foreground" aria-label="Mover para cima"><GripVertical className="h-3 w-3" /></button>
                    <span className="text-[10px] font-mono">{i + 1}</span>
                  </div>
                  <Icon className="h-4 w-4 mt-2 text-muted-foreground" />
                  <div className="flex-1 space-y-2">
                    <div className="text-xs font-medium">{STEP_LABEL[s.type]}</div>
                    {s.type === "message" && (
                      <Textarea
                        rows={2}
                        placeholder="Texto da mensagem"
                        value={(s.content.text as string) ?? ""}
                        onChange={(e) => {
                          const next = [...steps]; next[i] = { ...s, content: { ...s.content, text: e.target.value } }; setSteps(next);
                        }}
                      />
                    )}
                    {s.type === "condition" && (
                      <Input
                        placeholder="Regra (ex: respondeu = sim)"
                        value={(s.content.rule as string) ?? ""}
                        onChange={(e) => {
                          const next = [...steps]; next[i] = { ...s, content: { ...s.content, rule: e.target.value } }; setSteps(next);
                        }}
                      />
                    )}
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Delay (min)</Label>
                      <Input
                        type="number"
                        className="h-8 w-24"
                        value={s.delay_minutes}
                        onChange={(e) => {
                          const next = [...steps]; next[i] = { ...s, delay_minutes: Number(e.target.value) || 0 }; setSteps(next);
                        }}
                      />
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSteps(steps.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={create.isPending || update.isPending}>
            {cadence ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
