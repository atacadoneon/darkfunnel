import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";
import {
  ACTION_TYPES, CATEGORY_LABEL, TRIGGER_EVENTS,
  type Automation, type AutomationAction, type AutomationCategory, type AutomationCondition,
} from "@/types/automation";
import { useAutomationMutations } from "@/hooks/useAutomations";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onClose: () => void;
  automation: Automation | null;
};

const OPERATORS = ["equals", "not_equals", "contains", "greater_than", "less_than", "is_empty", "is_not_empty"];

export function AutomationBuilder({ open, onClose, automation }: Props) {
  const { create, update } = useAutomationMutations();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [category, setCategory] = useState<AutomationCategory>("other");
  const [triggerEvent, setTriggerEvent] = useState("lead_created");
  const [conditions, setConditions] = useState<AutomationCondition[]>([]);
  const [actions, setActions] = useState<AutomationAction[]>([]);

  useEffect(() => {
    if (open) {
      setName(automation?.name ?? "");
      setDescription(automation?.description ?? "");
      setActive(automation?.active ?? true);
      setCategory(automation?.category ?? "other");
      setTriggerEvent(automation?.trigger?.event ?? "lead_created");
      setConditions(automation?.conditions ?? []);
      setActions(automation?.actions ?? []);
    }
  }, [open, automation]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Nome obrigatório");
      return;
    }
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      active,
      category,
      trigger: { event: triggerEvent },
      conditions,
      actions,
    };
    try {
      if (automation) {
        await update.mutateAsync({ id: automation.id, patch: payload });
        toast.success("Automação atualizada");
      } else {
        await create.mutateAsync(payload);
        toast.success("Automação criada");
      }
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{automation ? "Editar automação" : "Nova automação"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Nome*</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Distribuir leads novos" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Descrição</Label>
              <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as AutomationCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end justify-end gap-2">
              <Label className="mb-2">Ativa</Label>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>
          </div>

          <Card className="p-4">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Gatilho</Label>
            <Select value={triggerEvent} onValueChange={setTriggerEvent}>
              <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRIGGER_EVENTS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Card>

          <Card className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Condições</Label>
              <Button size="sm" variant="outline" onClick={() => setConditions([...conditions, { field: "", operator: "equals", value: "" }])}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
              </Button>
            </div>
            {conditions.length === 0 && <p className="text-xs text-muted-foreground">Sem condições — a automação roda sempre.</p>}
            {conditions.map((c, i) => (
              <div key={i} className="grid grid-cols-[1fr_140px_1fr_auto] gap-2">
                <Input placeholder="Campo" value={c.field} onChange={(e) => {
                  const next = [...conditions]; next[i] = { ...c, field: e.target.value }; setConditions(next);
                }} />
                <Select value={c.operator} onValueChange={(v) => {
                  const next = [...conditions]; next[i] = { ...c, operator: v }; setConditions(next);
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input placeholder="Valor" value={String(c.value ?? "")} onChange={(e) => {
                  const next = [...conditions]; next[i] = { ...c, value: e.target.value }; setConditions(next);
                }} />
                <Button size="icon" variant="ghost" onClick={() => setConditions(conditions.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </Card>

          <Card className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Ações</Label>
              <Button size="sm" variant="outline" onClick={() => setActions([...actions, { type: "assign_user", config: {} }])}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
              </Button>
            </div>
            {actions.length === 0 && <p className="text-xs text-muted-foreground">Adicione ao menos uma ação.</p>}
            {actions.map((a, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto] gap-2">
                <Select value={a.type} onValueChange={(v) => {
                  const next = [...actions]; next[i] = { ...a, type: v }; setActions(next);
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACTION_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="icon" variant="ghost" onClick={() => setActions(actions.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </Card>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={create.isPending || update.isPending}>
            {automation ? "Salvar" : "Criar"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
