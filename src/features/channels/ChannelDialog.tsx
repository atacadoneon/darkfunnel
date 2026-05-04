import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Smartphone, BadgeCheck, ArrowLeft, Loader2, RefreshCw, CheckCircle2, Pencil, Check } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ChannelKind, ChannelRow, ChannelVisibility } from "./hooks";
import { ChannelStepInfo, type Step1Value } from "./ChannelStepInfo";
import { ChannelStepRotation } from "./ChannelStepRotation";
import { ChannelStepIntegrations } from "./ChannelStepIntegrations";
import { ChannelProfilePrivacy } from "./ChannelProfilePrivacy";
import { useChannelMembers, setChannelMembers } from "./configHooks";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  channel?: ChannelRow | null;
};

type Step = "type" | "info" | "rotation" | "integrations" | "uaz_connect";

const STEPS: { key: Step; label: string }[] = [
  { key: "info", label: "Informações" },
  { key: "rotation", label: "Rodízio" },
  { key: "integrations", label: "Integrações" },
  { key: "uaz_connect", label: "Conectar QR" },
];

export function ChannelDialog({ open, onOpenChange, channel }: Props) {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const editing = !!channel;

  const [step, setStep] = useState<Step>("type");
  const [kind, setKind] = useState<ChannelKind>("uazapi");
  const [info, setInfo] = useState<Step1Value>({
    display_name: "",
    sector_id: null,
    visibility: "all",
    selected_user_ids: [],
  });
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [savingInfo, setSavingInfo] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);

  // QR
  const [qr, setQr] = useState<string | null>(null);
  const [connStatus, setConnStatus] = useState<string>("pending");
  const [connectError, setConnectError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef<number | null>(null);

  const { data: existingMembers = [] } = useChannelMembers(activeChannelId);

  useEffect(() => {
    if (!open) { stopPoll(); return; }
    const isUaz = (channel?.kind ?? "uazapi") === "uazapi";
    setKind((channel?.kind ?? "uazapi") as ChannelKind);
    setInfo({
      display_name: channel?.display_name ?? "",
      sector_id: channel?.sector_id ?? null,
      visibility: (channel?.visibility ?? "all") as ChannelVisibility,
      selected_user_ids: [],
    });
    setActiveChannelId(channel?.id ?? null);
    setQr(null);
    setConnectError(null);
    setConnStatus(channel?.status ?? "pending");
    setStep(editing ? "info" : "type");
    if (editing && isUaz && channel?.id) void connect(channel.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, channel, editing]);

  // hidrata seleção de usuários quando carrega membros do canal
  useEffect(() => {
    if (existingMembers.length && info.visibility === "selected" && info.selected_user_ids.length === 0) {
      setInfo((p) => ({ ...p, selected_user_ids: existingMembers }));
    }
  }, [existingMembers]); // eslint-disable-line

  const stopPoll = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setPolling(false);
  };

  const pickType = (k: ChannelKind) => { setKind(k); setStep("info"); };

  const saveInfo = async (): Promise<string | null> => {
    if (!current) return null;
    const name = info.display_name.trim();
    if (!name) { toast.error("Informe o nome do canal"); return null; }
    if (info.visibility === "sector" && !info.sector_id) { toast.error("Selecione um setor"); return null; }
    setSavingInfo(true);
    try {
      // Verifica duplicidade de nome no workspace
      const { data: dup } = await supabase
        .from("channels")
        .select("id")
        .eq("workspace_id", current.id)
        .ilike("display_name", name)
        .maybeSingle();
      if (dup && dup.id !== (editing ? channel?.id : activeChannelId)) {
        toast.error("Já existe um canal com esse nome");
        return null;
      }

      const payload = {
        workspace_id: current.id,
        kind,
        display_name: name,
        sector_id: info.sector_id,
        visibility: info.visibility,
      };
      let id = activeChannelId;
      if (editing && channel) {
        const { error } = await supabase.from("channels").update(payload).eq("id", channel.id);
        if (error) throw error;
        id = channel.id;
      } else if (id) {
        const { error } = await supabase.from("channels").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("channels").insert(payload).select("id").single();
        if (error) {
          if ((error as { code?: string }).code === "23505") {
            toast.error("Já existe um canal com esse nome ou telefone");
            return null;
          }
          throw error;
        }
        id = data.id;
      }
      if (info.visibility === "selected") {
        await setChannelMembers(id!, info.selected_user_ids);
      }
      setActiveChannelId(id);
      qc.invalidateQueries({ queryKey: ["channels", current.id] });
      qc.invalidateQueries({ queryKey: ["channel-members", id] });
      return id;
    } catch (e) {
      toast.error((e as Error).message);
      return null;
    } finally {
      setSavingInfo(false);
    }
  };

  const connect = async (id: string) => {
    setQr(null);
    setConnectError(null);
    const { data, error } = await supabase.functions.invoke("uazapi-instance", {
      body: { channel_id: id, action: "connect" },
    });
    const detail = data?.detail ? `: ${typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail)}` : "";
    if (error || data?.error) {
      const message = `${data?.error ?? error?.message ?? "Erro ao gerar QR Code"}${detail}`;
      setConnectError(message);
      toast.error(message);
      return;
    }
    if (data?.qr) setQr(data.qr);
    if (!data?.qr && data?.status !== "connected") setConnectError("A UAZAPI não retornou um QR Code. Clique em Atualizar QR para tentar novamente.");
    if (data?.status) setConnStatus(data.status);
    startPoll(id);
  };

  const startPoll = (id: string) => {
    stopPoll();
    setPolling(true);
    pollRef.current = window.setInterval(async () => {
      const { data } = await supabase.functions.invoke("uazapi-instance", {
        body: { channel_id: id, action: "status" },
      });
      if (data?.status) setConnStatus(data.status);
      if (data?.status === "connected") {
        stopPoll();
        toast.success("WhatsApp conectado!");
        qc.invalidateQueries({ queryKey: ["channels", current?.id] });
      }
    }, 3000) as unknown as number;
  };

  const disconnect = async () => {
    if (!activeChannelId) return;
    await supabase.functions.invoke("uazapi-instance", { body: { channel_id: activeChannelId, action: "disconnect" } });
    setConnStatus("disconnected");
    stopPoll();
    qc.invalidateQueries({ queryKey: ["channels", current?.id] });
  };

  const [advancing, setAdvancing] = useState(false);
  const [initializing, setInitializing] = useState(false);

  const goNext = async () => {
    if (step === "info") {
      setAdvancing(true);
      const id = await saveInfo();
      setAdvancing(false);
      if (!id) return;
      setStep("rotation");
    } else if (step === "rotation") {
      if (kind === "uazapi") {
        setStep("integrations");
      } else {
        toast.success("Canal salvo");
        onOpenChange(false);
      }
    } else if (step === "integrations") {
      setStep("uaz_connect");
      if (activeChannelId) void initAndConnect(activeChannelId);
    }
  };

  const initAndConnect = async (id: string) => {
    setInitializing(true);
    setConnectError(null);
    try {
      const { data, error } = await supabase.functions.invoke("uazapi-instance", {
        body: { channel_id: id, action: "init" },
      });
      const detail = data?.detail ? `: ${typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail)}` : "";
      if (error || data?.error) {
        const message = `Falha ao inicializar instância: ${data?.error ?? error?.message ?? "erro desconhecido"}${detail}`;
        setConnectError(message);
        toast.error(message);
        return;
      }
      await connect(id);
    } catch (e) {
      setConnectError((e as Error).message);
      toast.error((e as Error).message);
    } finally {
      setInitializing(false);
    }
  };

  const goBack = () => {
    if (step === "rotation") setStep("info");
    else if (step === "integrations") setStep("rotation");
    else if (step === "uaz_connect") setStep("integrations");
    else if (step === "info" && !editing) setStep("type");
  };

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) stopPoll(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {step === "type" && !editing ? (
          <>
            <DialogHeader>
              <DialogTitle>Escolha o tipo de canal</DialogTitle>
              <DialogDescription>Selecione qual integração você deseja conectar.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <Card className="p-4 cursor-pointer hover:border-primary transition-colors flex items-start gap-3" onClick={() => pickType("uazapi")}>
                <div className="h-10 w-10 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <Smartphone className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <div className="font-semibold">WhatsApp Business (uazapi)</div>
                  <p className="text-sm text-muted-foreground">Conecte via QR Code. Rápido e ideal para começar.</p>
                </div>
              </Card>
              <Card className="p-4 cursor-pointer hover:border-primary transition-colors flex items-start gap-3 opacity-60" onClick={() => toast.info("Em breve")}>
                <div className="h-10 w-10 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                  <BadgeCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="font-semibold">WhatsApp API (WABA)</div>
                  <p className="text-sm text-muted-foreground">Cloud API oficial da Meta. Em breve.</p>
                </div>
              </Card>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {step !== "info" || !editing ? (
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 -ml-1" onClick={goBack}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                ) : null}
                {editing ? "Editar canal" : "Novo WhatsApp Business"}
              </DialogTitle>
              <DialogDescription>
                {kind === "uazapi"
                  ? `Conexão via API não-oficial UAZAPI · passo ${stepIndex + 1} de ${STEPS.length}`
                  : `Configure seu canal em ${STEPS.length} passos.`}
              </DialogDescription>
            </DialogHeader>

            {/* Stepper */}
            <div className="flex items-center gap-2 py-3">
              {STEPS.map((s, i) => {
                const done = i < stepIndex;
                const active = i === stepIndex;
                return (
                  <div key={s.key} className="flex items-center gap-2 flex-1">
                    <div className={cn(
                      "h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold border shrink-0",
                      active && "bg-primary text-primary-foreground border-primary",
                      done && "bg-emerald-500 text-white border-emerald-500",
                      !active && !done && "bg-muted text-muted-foreground border-border",
                    )}>
                      {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                    </div>
                    <span className={cn("text-xs font-medium", active ? "text-foreground" : "text-muted-foreground")}>{s.label}</span>
                    {i < STEPS.length - 1 && <div className={cn("h-px flex-1", done ? "bg-emerald-500" : "bg-border")} />}
                  </div>
                );
              })}
            </div>

            <div className="py-2">
              {step === "info" && <ChannelStepInfo value={info} onChange={setInfo} />}
              {step === "rotation" && <ChannelStepRotation channelId={activeChannelId} />}
              {step === "integrations" && <ChannelStepIntegrations channelId={activeChannelId} />}
              {step === "uaz_connect" && (
                <UazConnect
                  channelId={activeChannelId}
                  displayName={info.display_name}
                  phone={channel?.phone_e164 ?? null}
                  qr={qr}
                  connStatus={connStatus}
                  connectError={connectError}
                  polling={polling}
                  editingName={editingName}
                  nameDraft={nameDraft}
                  savingName={savingName}
                  onStartEdit={() => { setNameDraft(info.display_name); setEditingName(true); }}
                  onCancelEdit={() => setEditingName(false)}
                  onSaveName={async () => {
                    if (!activeChannelId || !nameDraft.trim()) return;
                    setSavingName(true);
                    const { error } = await supabase.from("channels").update({ display_name: nameDraft.trim() }).eq("id", activeChannelId);
                    setSavingName(false);
                    if (error) { toast.error(error.message); return; }
                    setInfo((p) => ({ ...p, display_name: nameDraft.trim() }));
                    setEditingName(false);
                    qc.invalidateQueries({ queryKey: ["channels", current?.id] });
                    toast.success("Nome atualizado");
                  }}
                  setNameDraft={setNameDraft}
                  onRefreshQr={() => activeChannelId && initAndConnect(activeChannelId)}
                  initializing={initializing}
                  onDisconnect={disconnect}
                />
              )}
            </div>

            <DialogFooter className="gap-2 sm:justify-between">
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => onOpenChange(false)}>
                  {step === "uaz_connect" ? "Fechar" : "Cancelar"}
                </Button>
              </div>
              <div className="flex gap-2">
                {(step === "rotation" || step === "uaz_connect" || (step === "info" && !editing)) && (
                  <Button type="button" variant="outline" onClick={goBack}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
                  </Button>
                )}
                {step !== "uaz_connect" && (
                  <Button onClick={goNext} disabled={savingInfo || advancing}>
                    {savingInfo || advancing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{step === "rotation" ? "Inicializando..." : "Salvando..."}</> : (
                      step === "rotation" && kind === "uazapi" ? "Avançar para QR" :
                      step === "rotation" ? "Concluir" : "Avançar"
                    )}
                  </Button>
                )}
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function UazConnect(props: {
  displayName: string;
  phone: string | null;
  qr: string | null;
  connStatus: string;
  connectError: string | null;
  polling: boolean;
  editingName: boolean;
  nameDraft: string;
  savingName: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveName: () => void;
  setNameDraft: (v: string) => void;
  onRefreshQr: () => void;
  onDisconnect: () => void;
  initializing?: boolean;
}) {
  const { displayName, phone, qr, connStatus, connectError, polling, editingName, nameDraft, savingName, initializing } = props;
  return (
    <div className="space-y-4">
      {(displayName || phone) && (
        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Canal</span>
            {editingName ? (
              <div className="flex items-center gap-2 flex-1 max-w-[260px]">
                <Input autoFocus value={nameDraft} onChange={(e) => props.setNameDraft(e.target.value)} className="h-8" />
                <Button size="sm" disabled={savingName || !nameDraft.trim()} onClick={props.onSaveName}>
                  {savingName ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
                </Button>
                <Button size="sm" variant="ghost" onClick={props.onCancelEdit}>Cancelar</Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-medium">{displayName}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={props.onStartEdit} aria-label="Editar nome">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
          {phone && (
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Número</span>
              <span className="font-medium">{phone}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col items-center gap-4 py-2">
        {connStatus === "connected" ? (
          <div className="flex flex-col items-center gap-2 py-8">
            <CheckCircle2 className="h-16 w-16 text-emerald-500" />
            <p className="font-semibold">Conectado!</p>
          </div>
        ) : qr ? (
          <div className="bg-white p-4 rounded-lg">
            {qr.startsWith("data:") || qr.startsWith("http")
              ? <img src={qr} alt="QR Code" width={240} height={240} />
              : <QRCodeSVG value={qr} size={240} />}
          </div>
        ) : connectError ? (
          <div className="text-center text-sm text-destructive py-10 max-w-sm">{connectError}</div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground py-12">
            <Loader2 className="h-5 w-5 animate-spin" /> {initializing ? "Inicializando instância UAZAPI..." : "Gerando QR Code..."}
          </div>
        )}
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          Status: <span className="font-medium">{connStatus}</span>
          {polling && <Loader2 className="h-3 w-3 animate-spin" />}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={props.onRefreshQr}>
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar QR
          </Button>
          {connStatus === "connected" && (
            <Button variant="outline" size="sm" onClick={props.onDisconnect}>Desconectar</Button>
          )}
        </div>
      </div>
    </div>
  );
}
