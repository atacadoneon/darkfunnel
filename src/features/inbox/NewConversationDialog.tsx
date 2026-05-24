import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, MessageCircle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthProvider";
import { useChannels } from "@/features/channels/hooks";
import { useWorkspaceMembers } from "@/features/workspace/permissions";
import { usePipelines } from "@/features/pipeline/leadEditHooks";
import { useStages } from "@/features/pipeline/hooks";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (conversationId: string) => void;
};

export type StartConversationResponse = {
  ok: true;
  partial?: boolean;
  contact_id: string;
  conversation_id: string;
  message?: { ok: boolean; message_id?: string } | null;
  deal?: { id: string; title: string; stage_id: string; value: number | null } | null;
  message_error?: string;
  deal_error?: string;
  created_by_user_id: string;
  assigned_user_id: string | null;
};

export function NewConversationDialog({ open, onOpenChange, onCreated }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: channels = [] } = useChannels();
  const { data: members = [] } = useWorkspaceMembers();
  const { data: pipelines = [] } = usePipelines();
  const { data: stagesAll = [] } = useStages();

  const activeChannels = useMemo(
    () => channels.filter((c) => c.status === "connected" && !c.deleted_at),
    [channels]
  );

  const [channelId, setChannelId] = useState<string>("");
  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [assignedUserId, setAssignedUserId] = useState<string>("");
  const [firstMessage, setFirstMessage] = useState("");
  const [createLead, setCreateLead] = useState(false);
  const [pipelineId, setPipelineId] = useState<string>("");
  const [stageId, setStageId] = useState<string>("");
  const [dealValue, setDealValue] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Defaults
  useEffect(() => {
    if (open && !channelId && activeChannels.length === 1) setChannelId(activeChannels[0].id);
  }, [open, activeChannels, channelId]);
  useEffect(() => {
    if (open && !assignedUserId && user) setAssignedUserId(user.id);
  }, [open, user, assignedUserId]);
  useEffect(() => {
    if (createLead && !pipelineId && pipelines.length) {
      const def = pipelines.find((p) => p.is_default) ?? pipelines[0];
      setPipelineId(def.id);
    }
  }, [createLead, pipelines, pipelineId]);

  const stages = useMemo(
    () => stagesAll.filter((s) => !pipelineId || (s as any).pipeline_id === pipelineId),
    [stagesAll, pipelineId]
  );
  useEffect(() => {
    if (createLead && pipelineId && stages.length && !stages.find((s) => s.id === stageId)) {
      setStageId(stages[0].id);
    }
  }, [createLead, pipelineId, stages, stageId]);

  const reset = () => {
    setChannelId(""); setPhone(""); setDisplayName(""); setAssignedUserId("");
    setFirstMessage(""); setCreateLead(false); setPipelineId(""); setStageId("");
    setDealValue("");
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const submit = async () => {
    if (!channelId) { toast.error("Selecione um canal"); return; }
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) { toast.error("Telefone inválido"); return; }
    if (createLead && (!pipelineId || !stageId)) {
      toast.error("Selecione pipeline e etapa para criar o lead");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        channel_id: channelId,
        phone: phone.trim(),
      };
      if (firstMessage.trim()) body.first_message = firstMessage.trim();
      if (displayName.trim()) body.display_name = displayName.trim();
      if (assignedUserId) body.assigned_user_id = assignedUserId;
      if (createLead) {
        body.create_lead = true;
        body.pipeline_id = pipelineId;
        body.stage_id = stageId;
        const v = parseFloat(dealValue.replace(",", "."));
        if (!Number.isNaN(v) && v > 0) body.deal_value = v;
      }

      const { data, error } = await supabase.functions.invoke<StartConversationResponse>(
        "start-conversation",
        { body }
      );
      if (error) throw error;
      if (!data?.ok) throw new Error("Resposta inválida da função");

      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["deals"] });
      qc.invalidateQueries({ queryKey: ["messages", data.conversation_id] });

      if (data.partial) {
        toast.warning(data.message_error || data.deal_error || "Conversa criada com avisos");
      } else {
        toast.success("Conversa iniciada");
      }

      onCreated?.(data.conversation_id);
      handleOpenChange(false);
      navigate(`/inbox?conversation=${data.conversation_id}`);
    } catch (e) {
      toast.error((e as Error).message || "Falha ao iniciar conversa");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" /> Nova conversa
          </DialogTitle>
          <DialogDescription>
            Inicie uma nova conversa via WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Canal WhatsApp</Label>
            <Select value={channelId || undefined} onValueChange={setChannelId}>
              <SelectTrigger><SelectValue placeholder="Selecione o canal" /></SelectTrigger>
              <SelectContent>
                {activeChannels.length === 0 && (
                  <div className="px-2 py-2 text-xs text-muted-foreground">Nenhum canal conectado</div>
                )}
                {activeChannels.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.display_name} {c.phone_e164 ? `· ${c.phone_e164}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Telefone</Label>
              <Input
                placeholder="+55 11 98765-4321"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nome (opcional)</Label>
              <Input
                placeholder="Ex: João Silva"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Responsável (Closer)</Label>
            <Select value={assignedUserId || undefined} onValueChange={setAssignedUserId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.display_name || m.email || m.user_id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Primeira mensagem (opcional)</Label>
            <Textarea
              rows={3}
              placeholder="Olá! Tudo bem?"
              value={firstMessage}
              onChange={(e) => setFirstMessage(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="space-y-0.5">
              <Label className="text-sm">Criar lead no CRM</Label>
              <p className="text-xs text-muted-foreground">Adiciona um deal no pipeline.</p>
            </div>
            <Switch checked={createLead} onCheckedChange={setCreateLead} />
          </div>

          {createLead && (
            <div className="space-y-3 rounded-md border p-3 bg-muted/30">
              <div className="space-y-1.5">
                <Label className="text-xs">Pipeline</Label>
                <Select value={pipelineId || undefined} onValueChange={(v) => { setPipelineId(v); setStageId(""); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione o pipeline" /></SelectTrigger>
                  <SelectContent>
                    {pipelines.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Etapa</Label>
                <Select value={stageId || undefined} onValueChange={setStageId}>
                  <SelectTrigger><SelectValue placeholder="Selecione a etapa" /></SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Valor do deal (opcional)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={dealValue}
                  onChange={(e) => setDealValue(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving || !channelId || !phone}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Iniciar Conversa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
