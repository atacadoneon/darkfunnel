import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Deal, Stage } from "./hooks";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  stages: Stage[];
  deal?: Deal | null;
  defaultStageId?: string;
};

export function DealDialog({ open, onOpenChange, stages, deal, defaultStageId }: Props) {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const editing = !!deal;

  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [stageId, setStageId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(deal?.title ?? "");
      setValue(deal ? (deal.value_cents / 100).toFixed(2) : "");
      setStageId(deal?.stage_id ?? defaultStageId ?? stages[0]?.id ?? "");
      setNotes(deal?.notes ?? "");
    }
  }, [open, deal, defaultStageId, stages]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) return;
    setSaving(true);
    try {
      const payload = {
        workspace_id: current.id,
        stage_id: stageId,
        title: title.trim(),
        value_cents: Math.round(parseFloat(value || "0") * 100),
        notes: notes.trim() || null,
      };
      if (editing && deal) {
        const { error } = await supabase.from("deals").update(payload).eq("id", deal.id);
        if (error) throw error;
        toast.success("Negócio atualizado");
      } else {
        const { error } = await supabase.from("deals").insert(payload);
        if (error) throw error;
        toast.success("Negócio criado");
      }
      qc.invalidateQueries({ queryKey: ["deals", current.id] });
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar negócio" : "Novo negócio"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="t">Título</Label>
            <Input id="t" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Pacote anual — Empresa X" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="v">Valor (R$)</Label>
              <Input id="v" type="number" step="0.01" min="0" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Etapa</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="n">Notas</Label>
            <Textarea id="n" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving || !title.trim() || !stageId}>
              {saving ? "Salvando..." : editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
