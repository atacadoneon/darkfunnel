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
  type ConnectErr = { title: string; status?: number; message: string; body?: unknown; url?: string };
  const [qr, setQr] = useState<string | null>(null);
  const [connStatus, setConnStatus] = useState<string>("pending");
  const [connectError, setConnectError] = useState<ConnectErr | null>(null);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef<number | null>(null);
  const initInFlightRef = useRef<Promise<void> | null>(null);

  // Invoca edge function via fetch direto para capturar HTTP status + body bruto em caso de erro.
  const invokeEdge = async (fn: string, body: unknown): Promise<{ ok: true; data: any } | { ok: false; err: ConnectErr }> => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}`;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? (import.meta.env.VITE_SUPABASE_ANON_KEY as string);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let parsed: any = text;
      try { parsed = JSON.parse(text); } catch { /* keep text */ }
      if (!res.ok) {
        return {
          ok: false,
          err: {
            title: `HTTP ${res.status} ${res.statusText}`,
            status: res.status,
            message: (parsed && typeof parsed === "object" && parsed.error) || (typeof parsed === "string" ? parsed : "Erro na Edge Function"),
            body: parsed,
            url,
          },
        };
      }
      if (parsed && typeof parsed === "object" && parsed.error) {
        return {
          ok: false,
          err: { title: "Erro retornado pela função", status: res.status, message: String(parsed.error), body: parsed, url },
        };
      }
      return { ok: true, data: parsed };
    } catch (e) {
      return {
        ok: false,
        err: {
          title: "Falha de rede ao chamar Edge Function",
          message: (e as Error).message,
          body: { hint: "Possível CORS, função não publicada (404), ou bloqueio de rede. Verifique se a função foi publicada (Publish → Update)." },
          url,
        },
      };
    }
  };

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
    const r = await invokeEdge("uazapi-instance", { channel_id: id, action: "connect" });
    if (r.ok === false) {
      if (r.err.status === 400 && /instância não inicializada/i.test(r.err.message)) {
        await initAndConnect(id, true);
        return;
      }
      setConnectError({ ...r.err, title: r.err.title + " (connect)" });
      toast.error(`Conectar QR falhou: ${r.err.message}`);
      return;
    }
    const data = r.data;
    if (data?.qr) setQr(data.qr);
    if (!data?.qr && data?.status !== "connected") {
      setConnectError({ title: "QR não retornado", message: "A UAZAPI não retornou um QR Code. Clique em Atualizar QR para tentar novamente.", body: data });
    }
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


  const initAndConnect = async (id: string, force = false) => {
    if (initInFlightRef.current) return initInFlightRef.current;

    const task = (async () => {
      setInitializing(true);
      setConnectError(null);
      try {
        const r = await invokeEdge("uazapi-instance", { channel_id: id, action: "init", force });
        if (r.ok === false) {
          setConnectError({ ...r.err, title: r.err.title + " (init)" });
          toast.error(`Falha ao inicializar instância: ${r.err.message}`);
          return;
        }
        await connect(id);
      } catch (e) {
        setConnectError({ title: "Erro inesperado", message: (e as Error).message });
        toast.error((e as Error).message);
      } finally {
        setInitializing(false);
        initInFlightRef.current = null;
      }
    })();

    initInFlightRef.current = task;
    return task;
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
                {(step === "rotation" || step === "integrations" || step === "uaz_connect" || (step === "info" && !editing)) && (
                  <Button type="button" variant="outline" onClick={goBack}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
                  </Button>
                )}
                {step !== "uaz_connect" && (
                  <Button onClick={goNext} disabled={savingInfo || advancing}>
                    {savingInfo || advancing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{step === "integrations" ? "Inicializando..." : "Salvando..."}</> : (
                      step === "integrations" ? "Avançar para QR" :
                      step === "rotation" && kind === "uazapi" ? "Avançar" :
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
  channelId: string | null;
  displayName: string;
  phone: string | null;
  qr: string | null;
  connStatus: string;
  connectError: { title: string; status?: number; message: string; body?: unknown; url?: string } | null;
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
  const { channelId, phone, qr, connStatus, connectError, polling, initializing } = props;
  const connected = connStatus === "connected";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Smartphone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="font-semibold text-sm">Conexão via QR Code</div>
              <p className="text-xs text-muted-foreground">Escaneie o QR Code com o WhatsApp do celular</p>
            </div>
          </div>
          <span className={cn(
            "text-xs font-medium px-2.5 py-1 rounded-full border inline-flex items-center gap-1",
            connected ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                       : "bg-muted text-muted-foreground border-border",
          )}>
            {connected ? "Conectado" : connStatus === "qr_pending" ? "Aguardando QR" : "Desconectado"}
          </span>
        </div>

        {connected ? (
          <div className="rounded-lg border bg-emerald-500/5 border-emerald-500/30 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> WhatsApp Conectado
                </div>
                {phone && <div className="text-sm font-medium mt-0.5">{phone}</div>}
              </div>
              <Button size="sm" variant="outline" onClick={props.onDisconnect}>Desconectar</Button>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              Provider: <span className="font-medium text-foreground">UAZAPI</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-2">
            {qr ? (
              <div className="bg-white p-4 rounded-lg">
                {qr.startsWith("data:") || qr.startsWith("http")
                  ? <img src={qr} alt="QR Code" width={240} height={240} />
                  : <QRCodeSVG value={qr} size={240} />}
              </div>
            ) : connectError ? (
              <div className="w-full max-w-md rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-left space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-semibold text-destructive">{connectError.title}</div>
                  {connectError.status !== undefined && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-destructive/15 text-destructive shrink-0">
                      {connectError.status}
                    </span>
                  )}
                </div>
                <div className="text-xs text-foreground break-words">{connectError.message}</div>
                {connectError.url && (
                  <div className="text-[10px] font-mono text-muted-foreground break-all">{connectError.url}</div>
                )}
                {connectError.body !== undefined && connectError.body !== null && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
                      Ver corpo da resposta
                    </summary>
                    <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted/60 p-2 text-[11px] font-mono whitespace-pre-wrap break-all">
{typeof connectError.body === "string" ? connectError.body : JSON.stringify(connectError.body, null, 2)}
                    </pre>
                    <button
                      type="button"
                      className="mt-1 text-[11px] text-muted-foreground hover:text-foreground underline"
                      onClick={() => {
                        const txt = [
                          connectError.title,
                          connectError.status !== undefined ? `HTTP ${connectError.status}` : "",
                          connectError.url ?? "",
                          connectError.message,
                          typeof connectError.body === "string" ? connectError.body : JSON.stringify(connectError.body, null, 2),
                        ].filter(Boolean).join("\n");
                        navigator.clipboard.writeText(txt).then(() => toast.success("Erro copiado"));
                      }}
                    >
                      Copiar diagnóstico
                    </button>
                  </details>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground py-10">
                <Loader2 className="h-5 w-5 animate-spin" /> {initializing ? "Inicializando instância UAZAPI..." : "Gerando QR Code..."}
              </div>
            )}
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              Status: <span className="font-medium">{connStatus}</span>
              {polling && <Loader2 className="h-3 w-3 animate-spin" />}
            </div>
            <Button variant="outline" size="sm" onClick={props.onRefreshQr} disabled={initializing}>
              <RefreshCw className="h-4 w-4 mr-2" /> Atualizar QR
            </Button>
          </div>
        )}
      </div>

      <ChannelProfilePrivacy channelId={channelId} disabled={!connected} />

      <div className="rounded-xl border p-4">
        <div className="flex items-center gap-2 font-semibold text-sm mb-2">
          <CheckCircle2 className="h-4 w-4 text-primary" /> Resumo da configuração
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Canal</div>
            <div className="font-medium">{props.displayName || "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Status</div>
            <div className="font-medium">{connected ? "Conectado" : "Pendente"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
