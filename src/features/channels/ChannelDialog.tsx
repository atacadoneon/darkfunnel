import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Smartphone, BadgeCheck, ArrowLeft, Loader2, RefreshCw, CheckCircle2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ChannelKind, ChannelRow } from "./hooks";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  channel?: ChannelRow | null;
};

export function ChannelDialog({ open, onOpenChange, channel }: Props) {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const editing = !!channel;

  const [step, setStep] = useState<"type" | "form" | "uaz_connect">(editing ? "form" : "type");
  const [kind, setKind] = useState<ChannelKind>("uazapi");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [policy, setPolicy] = useState<ChannelRow["policy"]>("support");
  const [saving, setSaving] = useState(false);

  // QR / status
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [connStatus, setConnStatus] = useState<string>("pending");
  const [connectError, setConnectError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      setStep(editing ? "form" : "type");
      setKind((channel?.kind ?? "uazapi") as ChannelKind);
      setDisplayName(channel?.display_name ?? "");
      setPhone(channel?.phone_e164 ?? "");
      setPolicy((channel?.policy ?? "support") as ChannelRow["policy"]);
      setQr(null);
      setConnectError(null);
      setConnStatus(channel?.status ?? "pending");
      setActiveChannelId(channel?.id ?? null);
    } else {
      stopPoll();
    }
  }, [open, channel, editing]);

  const stopPoll = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setPolling(false);
  };

  const pickType = (k: ChannelKind) => { setKind(k); setStep("form"); };

  // Cria canal + (se uazapi) credenciais
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) return;
    setSaving(true);
    try {
      let channelId = channel?.id;
      const payload = {
        workspace_id: current.id,
        kind,
        display_name: displayName.trim(),
        phone_e164: phone.trim() || null,
        policy,
      };
      if (editing && channel) {
        const { error } = await supabase.from("channels").update(payload).eq("id", channel.id);
        if (error) throw error;
        toast.success("Canal atualizado");
      } else {
        const { data, error } = await supabase.from("channels").insert(payload).select("id").single();
        if (error) throw error;
        channelId = data.id;
        toast.success("Canal criado");
      }
      qc.invalidateQueries({ queryKey: ["channels", current.id] });

      if (kind === "uazapi" && channelId && !editing) {
        const { error } = await supabase.functions.invoke("uazapi-instance", {
          body: { channel_id: channelId, action: "init" },
        });
        if (error) throw new Error(error.message);
        toast.success("Instância criada");
        setActiveChannelId(channelId);
        setStep("uaz_connect");
        await connect(channelId);
        return;
      }
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
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

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) stopPoll(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        {step === "type" && !editing && (
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
        )}

        {step === "form" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {!editing && (
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 -ml-1" onClick={() => setStep("type")}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                )}
                {editing ? "Editar canal" : "Novo WhatsApp Business"}
              </DialogTitle>
              <DialogDescription>
                {kind === "uazapi"
                  ? "Dê um nome ao canal. Em seguida você escaneará o QR Code para conectar o WhatsApp."
                  : "Cadastre o canal."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="dn">Nome de exibição</Label>
                <Input id="dn" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Atendimento Principal" />
              </div>

              <div className="space-y-1.5">
                <Label>Política</Label>
                <Select value={policy} onValueChange={(v) => setPolicy(v as ChannelRow["policy"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="support">Suporte</SelectItem>
                    <SelectItem value="sales">Vendas</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="transactional">Transacional</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editing && kind === "uazapi" && (
                <Button type="button" variant="outline" className="w-full" onClick={() => { setActiveChannelId(channel!.id); setStep("uaz_connect"); void connect(channel!.id); }}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Reconectar / Ver QR Code
                </Button>
              )}

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving || !displayName.trim()}>
                  {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Conectando...</> : editing ? "Salvar" : "Criar e conectar"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}

        {step === "uaz_connect" && (
          <>
            <DialogHeader>
              <DialogTitle>Conectar WhatsApp</DialogTitle>
              <DialogDescription>
                Abra o WhatsApp no celular → Aparelhos conectados → Conectar aparelho. Aponte para o QR abaixo.
              </DialogDescription>
            </DialogHeader>

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
                <div className="text-center text-sm text-destructive py-10 max-w-sm">
                  {connectError}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground py-12">
                  <Loader2 className="h-5 w-5 animate-spin" /> Gerando QR Code...
                </div>
              )}
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                Status: <span className="font-medium">{connStatus}</span>
                {polling && <Loader2 className="h-3 w-3 animate-spin" />}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => activeChannelId && connect(activeChannelId)}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Atualizar QR
                </Button>
                {connStatus === "connected" && (
                  <Button variant="outline" size="sm" onClick={disconnect}>Desconectar</Button>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => { stopPoll(); onOpenChange(false); }}>Fechar</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
