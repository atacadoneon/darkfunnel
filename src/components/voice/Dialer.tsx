import { useEffect, useMemo, useRef, useState } from "react";
import { Phone, PhoneOff, X, Delete, Mic, MicOff, Grid3x3, Pause, UserPlus, MessageCircle, Minus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDialer } from "@/features/voice/VoiceProvider";
import { useVoiceDevice } from "@/hooks/useVoiceDevice";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { usePhoneNumbers } from "@/features/wallet/hooks";
import { useActiveCalls } from "@/features/voice/hooks";
import { CallTimer } from "./CallTimer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Mode = "idle" | "dialing" | "connecting" | "in_call";

const KEYS = ["1","2","3","4","5","6","7","8","9","*","0","#"];

export function Dialer() {
  const { isOpen, prefill, close, open, showInsufficient } = useDialer();
  const { current } = useWorkspace();
  const wsId = current?.id;
  const { data: numbers = [] } = usePhoneNumbers();
  const { data: activeCalls = [] } = useActiveCalls();
  const device = useVoiceDevice(isOpen);

  const [mode, setMode] = useState<Mode>("idle"); void open;
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState<"pstn" | "whatsapp">("pstn");
  const [bina, setBina] = useState<string>("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (prefill?.phone) setPhone(prefill.phone);
    if (prefill?.channel) setChannel(prefill.channel);
  }, [isOpen, prefill]);

  useEffect(() => {
    if (!bina && numbers.length) setBina((numbers as any)[0].e164 ?? "");
  }, [numbers, bina]);

  // Promote to in_call when active call appears
  useEffect(() => {
    if (!activeId) return;
    const c = activeCalls.find(c => c.id === activeId);
    if (c && (c.status === "in_progress" || c.status === "ringing")) setMode("in_call");
    if (c && (c.status === "completed" || c.status === "failed" || c.status === "no-answer")) {
      setMode("idle"); setActiveId(null);
    }
  }, [activeCalls, activeId]);

  // Drag
  useEffect(() => {
    const el = dragRef.current; if (!el) return;
    let down = false, sx = 0, sy = 0, ox = 0, oy = 0;
    const handle = el.querySelector("[data-drag-handle]") as HTMLElement | null;
    if (!handle) return;
    const md = (e: MouseEvent) => { down = true; sx = e.clientX; sy = e.clientY; const r = el.getBoundingClientRect(); ox = r.left; oy = r.top; };
    const mm = (e: MouseEvent) => { if (!down) return; setPos({ x: ox + (e.clientX - sx), y: oy + (e.clientY - sy) }); };
    const mu = () => { down = false; };
    handle.addEventListener("mousedown", md);
    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", mu);
    return () => { handle.removeEventListener("mousedown", md); window.removeEventListener("mousemove", mm); window.removeEventListener("mouseup", mu); };
  }, [isOpen, collapsed]);

  const appendDigit = (d: string) => {
    if (mode === "in_call") { device.sendDigit(d); return; }
    setPhone(p => p + d);
  };

  const startCall = async () => {
    if (!wsId) return;
    const raw = (prefill?.phone || phone).trim();
    if (!raw) return toast.error("Digite um número");
    const { toZenviaBR } = await import("@/lib/phone");
    const to = toZenviaBR(raw);
    if (!/^\d{10,11}$/.test(to)) {
      setMode("idle");
      return toast.error("Número inválido. Use DDD + número, ex: 4832830151");
    }
    setSubmitting(true);
    setMode("connecting");
    try {
      const { data, error } = await supabase.functions.invoke("voice-outbound", {
        body: {
          workspace_id: wsId,
          to,
          contact_id: prefill?.contactId ?? null,
          conversation_id: prefill?.conversationId ?? null,
          deal_id: prefill?.dealId ?? null,
          channel,
          from_number: bina || undefined,
        },
      });
      if (error) {
        const ctx: any = (error as any).context;
        let payload: any = ctx;
        try {
          if (ctx instanceof Response) payload = await ctx.clone().json();
          else if (typeof ctx?.text === "function") payload = JSON.parse(await ctx.text());
          else if (typeof ctx?.body === "string") payload = JSON.parse(ctx.body);
        } catch {}
        const code = payload?.code || (data as any)?.code;
        if (code === "insufficient_balance" || (error as any).status === 402) {
          showInsufficient(payload?.required ?? (data as any)?.required);
          setMode("idle");
          return;
        }
        if (code === "zenvia_error") {
          toast.error("Zenvia rejeitou a chamada", {
            description: payload?.zenvia_response?.mensagem ?? payload?.error,
          });
          setMode("idle");
          return;
        }
        throw new Error(payload?.error || (error as any).message || "Erro na chamada");
      }
      if (channel === "whatsapp" && data?.deeplink) {
        window.open(data.deeplink, "_blank");
        setMode("idle");
        toast.success("WhatsApp aberto");
        return;
      }
      if (data?.call_id) setActiveId(data.call_id);
      // PSTN: Twilio SDK auto-conecta via webhook; aguardar realtime
      setMode("in_call");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao iniciar chamada");
      setMode("idle");
    } finally { setSubmitting(false); }
  };

  const hangup = async () => {
    device.hangup();
    if (activeId) {
      try { await supabase.from("calls").update({ status: "completed" }).eq("id", activeId); } catch {}
    }
    setMode("idle");
    setActiveId(null);
  };

  const current_call = activeId ? activeCalls.find(c => c.id === activeId) : null;
  const displayName = prefill?.contactName ?? current_call?.contact?.display_name ?? phone ?? "—";
  const displayAvatar = prefill?.contactAvatar ?? current_call?.contact?.profile_pic_preview_url ?? null;
  const isWa = channel === "whatsapp";

  if (!isOpen) return null;

  const style: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" }
    : { right: 24, bottom: 24 };

  return (
    <div
      ref={dragRef}
      className="fixed z-[100] shadow-2xl rounded-xl border bg-card overflow-hidden"
      style={{ ...style, width: collapsed ? 220 : 360 }}
    >
      <div data-drag-handle className="flex items-center justify-between px-3 py-2 border-b bg-muted/40 cursor-move select-none">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Phone className="h-4 w-4" /> Dialer
          {device.status === "ready" && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
          {device.status === "loading" && <span className="text-xs text-muted-foreground">carregando…</span>}
          {device.status === "error" && <span className="text-xs text-destructive">erro SDK</span>}
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setCollapsed(c => !c)}>
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={close}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-4 space-y-3">
          {mode === "in_call" || mode === "connecting" ? (
            <div className="flex flex-col items-center text-center space-y-3">
              <Avatar className="h-20 w-20">
                <AvatarImage src={displayAvatar ?? undefined} />
                <AvatarFallback>{displayName.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <div className="font-semibold">{displayName}</div>
                <div className="text-xs text-muted-foreground">{prefill?.phone ?? phone}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded bg-destructive/10 text-destructive">
                  <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" /> REC
                </span>
                {isWa ? <MessageCircle className="h-4 w-4 text-emerald-500" /> : <Phone className="h-4 w-4 text-sky-500" />}
                <CallTimer startedAt={current_call?.initiated_at ?? new Date().toISOString()} className="text-sm font-mono" />
              </div>

              <div className="grid grid-cols-4 gap-2 w-full pt-2">
                <Button size="sm" variant={device.muted ? "default" : "outline"} onClick={device.toggleMute}>
                  {device.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
                <Button size="sm" variant="outline"><Grid3x3 className="h-4 w-4" /></Button>
                <Button size="sm" variant="outline"><Pause className="h-4 w-4" /></Button>
                <Button size="sm" variant="outline"><UserPlus className="h-4 w-4" /></Button>
              </div>

              <Button size="lg" variant="destructive" className="w-full mt-2 gap-2" onClick={hangup}>
                <PhoneOff className="h-4 w-4" /> Encerrar
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+55 11 99999-9999"
                  className="text-center text-lg font-mono"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                {KEYS.map(k => (
                  <Button key={k} variant="outline" className="h-12 text-lg font-semibold" onClick={() => appendDigit(k)}>
                    {k}
                  </Button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => setPhone(p => p.slice(0, -1))}>
                  <Delete className="h-4 w-4" />
                </Button>
                <Select value={bina} onValueChange={setBina}>
                  <SelectTrigger className="flex-1 h-10"><SelectValue placeholder="BINA" /></SelectTrigger>
                  <SelectContent>
                    {numbers.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum número</div>}
                    {(numbers as any[]).map(n => (
                      <SelectItem key={n.id} value={n.e164}>{n.e164} {n.uf ? `(${n.uf})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-1 text-xs">
                <Button size="sm" variant={channel === "pstn" ? "default" : "outline"} className="flex-1" onClick={() => setChannel("pstn")}>
                  <Phone className="h-3.5 w-3.5 mr-1" /> VoIP
                </Button>
                <Button size="sm" variant={channel === "whatsapp" ? "default" : "outline"} className="flex-1" onClick={() => setChannel("whatsapp")}>
                  <MessageCircle className="h-3.5 w-3.5 mr-1 text-emerald-500" /> WhatsApp <span className="ml-1 text-[10px] text-emerald-600">grátis</span>
                </Button>
              </div>

              <Button
                size="lg"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                onClick={startCall}
                disabled={submitting}
              >
                <Phone className="h-4 w-4" /> {submitting ? "Conectando…" : "Ligar"}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
