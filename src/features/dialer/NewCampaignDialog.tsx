import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { usePipelines } from "@/features/pipeline/leadEditHooks";
import { useStages } from "@/features/pipeline/hooks";
import { useCreateCampaign } from "./hooks";
import { toast } from "sonner";

export function NewCampaignDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const { data: pipelines = [] } = usePipelines();
  const { data: stages = [] } = useStages();
  const create = useCreateCampaign();

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [pipelineId, setPipelineId] = useState<string>("");
  const [stageIds, setStageIds] = useState<string[]>([]);
  const [semRespostaDias, setSemRespostaDias] = useState<string>("");
  const [valorMin, setValorMin] = useState<string>("");
  const [timeout_, setTimeout_] = useState<number>(30);
  const [autoMsg, setAutoMsg] = useState(true);

  useEffect(() => {
    if (open) {
      setName(""); setDesc(""); setPipelineId(""); setStageIds([]);
      setSemRespostaDias(""); setValorMin(""); setTimeout_(30); setAutoMsg(true);
    }
  }, [open]);

  useEffect(() => {
    if (!pipelineId && pipelines.length) setPipelineId(pipelines[0].id);
  }, [pipelines, pipelineId]);

  const availableStages = useMemo(() => {
    // stages don't all have pipeline_id; filter when applicable
    return stages.filter((s: any) => !s.pipeline_id || s.pipeline_id === pipelineId);
  }, [stages, pipelineId]);

  const toggleStage = (id: string) => {
    setStageIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const submit = async () => {
    if (!name.trim()) { toast.error("Informe o nome da campanha"); return; }
    if (!stageIds.length) { toast.error("Selecione ao menos 1 etapa"); return; }
    try {
      const filters: any = {};
      if (semRespostaDias) filters.sem_resposta_dias = +semRespostaDias;
      if (valorMin) filters.valor_minimo_cents = Math.round(parseFloat(valorMin) * 100);

      const id = await create.mutateAsync({
        name: name.trim(),
        description: desc.trim() || undefined,
        pipeline_id: pipelineId || null,
        stage_ids: stageIds,
        filters,
        call_timeout_seconds: timeout_,
        auto_send_no_answer_msg: autoMsg,
      });
      toast.success("Campanha criada — fila gerada");
      onOpenChange(false);
      navigate(`/discador/${id}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao criar campanha");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Campanha de Discador</DialogTitle>
          <DialogDescription>Configure os filtros para gerar a fila de leads.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label>Nome *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Reativação Maio" autoFocus />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Objetivo da campanha" rows={2} />
            </div>
          </div>

          <div>
            <Label>Pipeline</Label>
            <Select value={pipelineId} onValueChange={setPipelineId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {pipelines.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Etapas *</Label>
            <div className="space-y-1.5 max-h-44 overflow-y-auto border rounded-md p-2">
              {availableStages.length === 0 && (
                <div className="text-xs text-muted-foreground italic px-1">Nenhuma etapa.</div>
              )}
              {availableStages.map((s: any) => (
                <label key={s.id} className="flex items-center gap-2 px-2 py-1 hover:bg-muted/50 rounded cursor-pointer">
                  <Checkbox checked={stageIds.includes(s.id)} onCheckedChange={() => toggleStage(s.id)} />
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  <span className="text-sm">{s.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Sem resposta há (dias)</Label>
              <Input type="number" value={semRespostaDias} onChange={(e) => setSemRespostaDias(e.target.value)} placeholder="Opcional" />
            </div>
            <div>
              <Label>Valor mínimo (R$)</Label>
              <Input type="number" value={valorMin} onChange={(e) => setValorMin(e.target.value)} placeholder="Opcional" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Timeout chamada (s)</Label>
              <Input type="number" value={timeout_} onChange={(e) => setTimeout_(+e.target.value || 30)} />
            </div>
            <div className="flex items-end">
              <div className="flex items-center gap-2 border rounded-md p-2 w-full">
                <Switch checked={autoMsg} onCheckedChange={setAutoMsg} id="auto-msg" />
                <label htmlFor="auto-msg" className="text-xs cursor-pointer flex-1">
                  Enviar WhatsApp ao não atender
                </label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? "Criando..." : "Criar e iniciar fila"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
