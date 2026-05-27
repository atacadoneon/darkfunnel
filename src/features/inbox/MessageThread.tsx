import { useEffect, useMemo, useRef, useState } from "react";
import { format, isToday, isYesterday, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FileText, Download, MapPin, Image as ImageIcon, Music, Video as VideoIcon,
  RefreshCw, Play, Pause, X, AlertCircle, Clock, CornerDownRight,
  User as UserIcon, Phone, Mic,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ForwardMessageDialog } from "./ForwardMessageDialog";
import { ReactionPicker, ReactionChips } from "./ReactionPicker";
import { MessageActions, isDeletedForMe, isDeletedForAll, isPinned } from "./MessageActions";
import { PinnedMessagesBar } from "./PinnedMessagesBar";
import { useAuth } from "@/features/auth/AuthProvider";
import type { MessageRow } from "./hooks";

/* ============================== Helpers ============================== */

function dayLabel(d: Date): string {
  if (isToday(d)) return "Hoje";
  if (isYesterday(d)) return "Ontem";
  const diff = differenceInCalendarDays(new Date(), d);
  if (diff < 7) return format(d, "EEEE", { locale: ptBR }).replace(/^./, (c) => c.toUpperCase());
  return format(d, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
}

function formatBytes(b?: number) {
  if (!b && b !== 0) return null;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} kB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function formatDuration(s?: number) {
  if (!s && s !== 0) return "0:00";
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${String(ss).padStart(2, "0")}`;
}

function highlight(text: string, query: string) {
  if (!query || query.length < 2) return text;
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
  const parts = text.split(re);
  return parts.map((p, i) =>
    re.test(p) ? <mark key={i} className="bg-yellow-300 text-black rounded px-0.5">{p}</mark> : <span key={i}>{p}</span>
  );
}

function linkify(text: string) {
  const re = /(https?:\/\/[^\s]+)/g;
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <a key={m.index} href={m[0]} target="_blank" rel="noreferrer" className="wa-link">
        {m[0]}
      </a>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/* ============================== Bubble tail SVG ============================== */

function BubbleTail({ side }: { side: "left" | "right" }) {
  const fill = side === "right" ? "var(--wa-bubble-out-bg)" : "var(--wa-bubble-in-bg)";
  if (side === "right") {
    return (
      <svg className="wa-tail-out" viewBox="0 0 8 13" aria-hidden>
        <path d="M0 0h5l3 13C5 11 1 7 0 0z" fill={fill} />
      </svg>
    );
  }
  return (
    <svg className="wa-tail-in" viewBox="0 0 8 13" aria-hidden>
      <path d="M8 0H3L0 13c3-2 7-6 8-13z" fill={fill} />
    </svg>
  );
}

/* ============================== Status checks ============================== */

function StatusChecks({ status }: { status: string }) {
  if (status === "failed") return <AlertCircle className="h-3 w-3 text-red-500" aria-label="falhou" />;
  if (status === "queued" || status === "sending")
    return <Clock className="h-3 w-3 opacity-70 animate-pulse" aria-label="enviando" />;
  const isRead = status === "read";
  const isDelivered = isRead || status === "delivered";
  const color = isRead ? "#53bdeb" : "#667781";
  if (isDelivered) {
    return (
      <svg width="16" height="11" viewBox="0 0 16 11" aria-label={isRead ? "lida" : "entregue"} style={{ color }}>
        <path d="M15.01 3.316l-.478-.372a.365.365 0 00-.51.063L8.666 9.879a.32.32 0 01-.484.033l-.358-.325a.319.319 0 00-.484.032l-.378.483a.418.418 0 00.036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 00-.064-.512zm-4.1 0l-.478-.372a.365.365 0 00-.51.063L4.566 9.879a.32.32 0 01-.484.033L1.891 7.769a.366.366 0 00-.515.006l-.423.433a.364.364 0 00.006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 00-.063-.51z" fill="currentColor"/>
      </svg>
    );
  }
  return (
    <svg width="16" height="11" viewBox="0 0 16 11" aria-label="enviada" style={{ color }}>
      <path d="M11.071.653a.457.457 0 00-.304-.102.493.493 0 00-.381.178l-6.19 7.636-2.405-2.272a.463.463 0 00-.336-.146.47.47 0 00-.343.156L.165 7.105a.49.49 0 00-.001.694l3.234 3.246a.512.512 0 00.367.155.499.499 0 00.388-.18L11.192 1.39a.483.483 0 00-.121-.741z" fill="currentColor"/>
    </svg>
  );
}

/* ============================== Media refresh wrapper ============================== */

function RefreshMediaButton({ messageId, conversationId, onRefreshed }: { messageId: string; conversationId: string; onRefreshed: (url: string) => void; }) {
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();
  return (
    <Button
      type="button" size="sm" variant="outline" disabled={loading}
      onClick={async () => {
        setLoading(true);
        const { data, error } = await supabase.functions.invoke("refresh-media", { body: { message_id: messageId } });
        setLoading(false);
        if (error || !data?.ok || !data?.media_url) { toast.error("Não foi possível recarregar a mídia"); return; }
        onRefreshed(data.media_url as string);
        qc.invalidateQueries({ queryKey: ["messages", conversationId] });
        toast.success("Mídia recarregada");
      }}
    >
      <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
      Recarregar mídia
    </Button>
  );
}

function MediaWithRefresh({
  messageId, conversationId, url, render,
}: {
  messageId: string; conversationId: string; url: string;
  render: (currentUrl: string, onError: () => void) => React.ReactNode;
}) {
  const [currentUrl, setCurrentUrl] = useState(url);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setCurrentUrl(url); setFailed(false); }, [url]);
  if (failed) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-md border bg-background/40 p-2">
        <span className="text-xs opacity-70">Mídia expirada ou indisponível.</span>
        <RefreshMediaButton
          messageId={messageId} conversationId={conversationId}
          onRefreshed={(u) => { setCurrentUrl(u); setFailed(false); }}
        />
      </div>
    );
  }
  return <>{render(currentUrl, () => setFailed(true))}</>;
}

/* ============================== Forwarded / Quoted ============================== */

function ForwardedHeader() {
  return (
    <div className="flex items-center gap-1 text-[12px] italic mb-1" style={{ color: "var(--wa-forwarded)" }}>
      <CornerDownRight className="h-3 w-3" /> Encaminhada
    </div>
  );
}

function QuotedPreview({ quoted }: { quoted: { sender?: string; text?: string; type?: string } }) {
  const preview =
    quoted.text ||
    (quoted.type === "image" ? "📷 Foto" :
     quoted.type === "video" ? "🎬 Vídeo" :
     quoted.type === "audio" ? "🎙 Áudio" :
     quoted.type === "document" ? "📄 Documento" : "Mídia");
  return (
    <div
      className="mb-1.5 rounded-md px-2 py-1.5 border-l-4 text-[13px] leading-tight"
      style={{ background: "var(--wa-quote-bg)", borderColor: "var(--wa-quote-border)" }}
    >
      <div className="font-medium" style={{ color: "var(--wa-quote-border)" }}>
        {quoted.sender || "Você"}
      </div>
      <div className="truncate opacity-80">{preview}</div>
    </div>
  );
}

/* ============================== Image with lightbox ============================== */

function ImageMessage({ m, query }: { m: MessageRow; query: string }) {
  const p = (m.payload ?? {}) as Record<string, unknown>;
  const mediaUrl = p.media_url as string | undefined;
  const caption = (p.body as string | undefined) || (p.caption as string | undefined) || "";
  const width = p.width as number | undefined;
  const height = p.height as number | undefined;
  const thumb = p.thumbnail_b64 as string | undefined;
  const [open, setOpen] = useState(false);
  if (!mediaUrl) return (
    <span className="inline-flex items-center gap-1.5 italic opacity-70 text-sm p-1">
      <ImageIcon className="h-4 w-4" /> 📷 imagem (indisponível)
    </span>
  );
  const ratio = width && height ? width / height : 4 / 3;
  const maxW = 330;
  const displayW = Math.min(maxW, width || maxW);
  const displayH = displayW / ratio;
  return (
    <>
      <div className="space-y-1">
        <button
          type="button" onClick={() => setOpen(true)}
          className="block overflow-hidden rounded-md bg-black/5"
          style={{ width: displayW, height: displayH }}
        >
          <MediaWithRefresh
            messageId={m.id} conversationId={m.conversation_id} url={mediaUrl}
            render={(u, onError) => (
              <img
                src={u} loading="lazy" onError={onError} alt={caption || "imagem"}
                className="h-full w-full object-cover"
                style={thumb ? { backgroundImage: `url(data:image/jpeg;base64,${thumb})`, backgroundSize: "cover" } : undefined}
              />
            )}
          />
        </button>
        {caption && (
          <div className="px-1 text-sm whitespace-pre-wrap break-words">{highlight(caption, query)}</div>
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-0 flex items-center justify-center">
          <button onClick={() => setOpen(false)} className="absolute right-3 top-3 z-10 rounded-full bg-black/60 p-2 text-white hover:bg-black/80">
            <X className="h-5 w-5" />
          </button>
          <a href={mediaUrl} download className="absolute right-14 top-3 z-10 rounded-full bg-black/60 p-2 text-white hover:bg-black/80" target="_blank" rel="noreferrer">
            <Download className="h-5 w-5" />
          </a>
          <img src={mediaUrl} alt={caption || "imagem"} className="max-h-[95vh] max-w-[95vw] object-contain" />
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ============================== Video ============================== */

function VideoMessage({ m, query }: { m: MessageRow; query: string }) {
  const p = (m.payload ?? {}) as Record<string, unknown>;
  const mediaUrl = p.media_url as string | undefined;
  const caption = (p.body as string | undefined) || (p.caption as string | undefined) || "";
  if (!mediaUrl) return (
    <span className="inline-flex items-center gap-1.5 italic opacity-70 text-sm p-1">
      <VideoIcon className="h-4 w-4" /> 🎬 vídeo (indisponível)
    </span>
  );
  return (
    <div className="space-y-1">
      <MediaWithRefresh
        messageId={m.id} conversationId={m.conversation_id} url={mediaUrl}
        render={(u, onError) => (
          <video controls preload="metadata" src={u} onError={onError} className="max-h-80 w-full max-w-[330px] rounded-md" />
        )}
      />
      {caption && <div className="px-1 text-sm whitespace-pre-wrap break-words">{highlight(caption, query)}</div>}
    </div>
  );
}

/* ============================== Audio (PTT + waveform) ============================== */

function parseWaveform(b64?: string): number[] {
  if (!b64) return Array(40).fill(0.4);
  try {
    const bin = atob(b64);
    const arr: number[] = [];
    for (let i = 0; i < bin.length; i++) arr.push(bin.charCodeAt(i) / 255);
    if (arr.length === 0) return Array(40).fill(0.4);
    // Downsample/upsample to ~40 bars
    const target = 40;
    const out: number[] = [];
    for (let i = 0; i < target; i++) {
      const idx = Math.floor((i / target) * arr.length);
      out.push(Math.max(0.15, arr[idx] ?? 0.4));
    }
    return out;
  } catch {
    return Array(40).fill(0.4);
  }
}

function AudioAvatar({ url, fallback, ptt }: { url?: string | null; fallback: string; ptt: boolean }) {
  return (
    <div className="relative w-8 h-8 flex-shrink-0">
      {url ? (
        <img src={url} className="w-8 h-8 rounded-full object-cover" alt="" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-emerald-500/30 flex items-center justify-center text-emerald-800 text-xs font-medium">
          {fallback}
        </div>
      )}
      {ptt && (
        <div
          className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#53bdeb] flex items-center justify-center"
          style={{ border: "2px solid var(--wa-bubble-in-bg)" }}
        >
          <Mic className="w-2 h-2 text-white" strokeWidth={3} />
        </div>
      )}
    </div>
  );
}

function AudioMessage({ m, isOut, contactAvatar, channelAvatar }: {
  m: MessageRow;
  isOut: boolean;
  contactAvatar?: string | null;
  channelAvatar?: string | null;
}) {
  const p = (m.payload ?? {}) as Record<string, unknown>;
  const mediaUrl = p.media_url as string | undefined;
  const initialSeconds = (p.seconds as number | undefined) ?? 0;
  const waveform = p.waveform as string | undefined;
  const ptt = (p.ptt as boolean | undefined) ?? false;
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialSeconds);
  const [speed, setSpeed] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const bars = useMemo(() => parseWaveform(waveform), [waveform]);

  if (!mediaUrl) return (
    <span className="inline-flex items-center gap-1.5 italic opacity-70 text-sm p-1">
      <Music className="h-4 w-4" /> 🎙 áudio (indisponível)
    </span>
  );

  const togglePlay = () => {
    const a = audioRef.current; if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      a.playbackRate = speed;
      void a.play();
      setPlaying(true);
    }
  };

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const onWaveClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = waveformRef.current; const a = audioRef.current;
    if (!el || !a || !duration) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    a.currentTime = pct * duration;
    setCurrentTime(a.currentTime);
  };

  const progress = duration > 0 ? currentTime / duration : 0;
  const playedBars = Math.floor(progress * bars.length);
  const currentDisplay = playing || currentTime > 0 ? formatDuration(Math.floor(currentTime)) : formatDuration(duration);

  const contactFallback = "?";
  const avatar = (
    <AudioAvatar
      url={isOut ? channelAvatar : contactAvatar}
      fallback={isOut ? "E" : contactFallback}
      ptt={ptt}
    />
  );

  return (
    <div className="flex items-center gap-2 min-w-[260px] max-w-[330px] py-1 pb-4 relative">
      {isOut && avatar}
      <button
        onClick={playing && speed > 1 ? cycleSpeed : togglePlay}
        onDoubleClick={cycleSpeed}
        className="w-7 h-7 flex items-center justify-center flex-shrink-0"
        title={playing ? `${speed}x — clique pra mudar velocidade` : "Reproduzir"}
      >
        {playing && speed > 1 ? (
          <span className="text-[12px] font-bold" style={{ color: "#54656f" }}>{speed}x</span>
        ) : playing ? (
          <Pause className="w-5 h-5" fill="currentColor" style={{ color: "#54656f" }} />
        ) : (
          <Play className="w-5 h-5 ml-0.5" fill="currentColor" style={{ color: "#54656f" }} />
        )}
      </button>
      <div
        ref={waveformRef}
        onClick={onWaveClick}
        className="flex-1 relative flex items-center gap-[2px] h-8 cursor-pointer"
      >
        {bars.map((h, i) => {
          const isPlayed = i <= playedBars;
          return (
            <div
              key={i}
              className="rounded-full"
              style={{
                width: "2px",
                height: `${Math.max(4, h * 26)}px`,
                background: isPlayed ? "#54656f" : "#a8a8a8",
              }}
            />
          );
        })}
        <div
          className="absolute w-2.5 h-2.5 rounded-full bg-[#53bdeb] shadow-md pointer-events-none"
          style={{
            left: `calc(${progress * 100}% - 5px)`,
            top: "50%",
            transform: "translateY(-50%)",
          }}
        />
        <span className="absolute -bottom-4 left-0 text-[11px] tabular-nums" style={{ color: "#667781" }}>
          {currentDisplay}
        </span>
      </div>
      {!isOut && avatar}
      <MediaWithRefresh
        messageId={m.id} conversationId={m.conversation_id} url={mediaUrl}
        render={(u, onError) => (
          <audio
            ref={audioRef} src={u} preload="metadata" className="hidden"
            onError={onError}
            onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (isFinite(d) && d > 0) setDuration(d); }}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onEnded={() => { setPlaying(false); setCurrentTime(0); }}
          />
        )}
      />
    </div>
  );
}


/* ============================== Document ============================== */

function DocumentMessage({ m }: { m: MessageRow }) {
  const p = (m.payload ?? {}) as Record<string, unknown>;
  const mediaUrl = p.media_url as string | undefined;
  const filename = (p.filename as string | undefined) || "arquivo";
  const mime = (p.mime as string | undefined) || "";
  const size = p.size as number | undefined;
  const pages = p.pages as number | undefined;
  const ext = (filename.split(".").pop() || mime.split("/").pop() || "FILE").toUpperCase().slice(0, 4);
  const sizeFmt = formatBytes(size);
  if (!mediaUrl) return (
    <span className="inline-flex items-center gap-1.5 italic opacity-70 text-sm p-1">
      <FileText className="h-4 w-4" /> 📎 documento (indisponível)
    </span>
  );
  const isPdf = mime.includes("pdf") || ext === "PDF";
  return (
    <MediaWithRefresh
      messageId={m.id} conversationId={m.conversation_id} url={mediaUrl}
      render={(u) => (
        <a
          href={u} target="_blank" rel="noreferrer"
          className="group/doc flex items-center gap-2 rounded-[6px] p-2 min-w-[260px] max-w-[320px] hover:opacity-95 transition-opacity"
          style={{ background: "var(--wa-doc-bg)" }}
        >
          {isPdf ? (
            <div className="h-[55px] w-[40px] rounded-sm flex flex-col items-center justify-center shrink-0" style={{ background: "#f15c4e" }}>
              <FileText className="h-5 w-5 text-white" />
              <span className="text-[9px] font-bold text-white mt-0.5 leading-none">PDF</span>
            </div>
          ) : (
            <div className="h-[55px] w-[40px] rounded-sm bg-white/80 dark:bg-white/10 flex flex-col items-center justify-center shrink-0 border border-black/10 dark:border-white/10">
              <FileText className="h-4 w-4 opacity-70" />
              <span className="text-[8px] font-bold opacity-70 mt-0.5">{ext}</span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14.2px] font-medium">{filename}</div>
            <div className="truncate text-[12px] opacity-60">
              {pages ? `${pages} ${pages === 1 ? "página" : "páginas"}` : null}
              {pages && (ext || sizeFmt) ? " · " : ""}
              {ext}{sizeFmt ? ` · ${sizeFmt}` : ""}
            </div>
          </div>
          <Download className="h-4 w-4 opacity-0 group-hover/doc:opacity-70 transition-opacity shrink-0" />
        </a>
      )}
    />
  );
}

/* ============================== Sticker / Location / Contact / Reaction ============================== */

function StickerMessage({ m }: { m: MessageRow }) {
  const p = (m.payload ?? {}) as Record<string, unknown>;
  const mediaUrl = p.media_url as string | undefined;
  if (!mediaUrl) return null;
  return (
    <MediaWithRefresh
      messageId={m.id} conversationId={m.conversation_id} url={mediaUrl}
      render={(u, onError) => (
        <img src={u} onError={onError} alt="sticker" className="h-24 w-24 object-contain" />
      )}
    />
  );
}

function LocationMessage({ m }: { m: MessageRow }) {
  const p = (m.payload ?? {}) as Record<string, unknown>;
  const lat = p.lat as number | undefined;
  const lng = p.lng as number | undefined;
  if (lat == null || lng == null) return (
    <span className="inline-flex items-center gap-1.5 italic opacity-70 text-sm p-1">
      <MapPin className="h-4 w-4" /> 📍 localização (indisponível)
    </span>
  );
  const name = (p.name as string | undefined) || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  const mapImg = `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=15&size=300x150&markers=${lat},${lng},red-pushpin`;
  return (
    <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer" className="block w-[260px] rounded-md overflow-hidden">
      <img src={mapImg} alt="mapa" className="h-[130px] w-full object-cover bg-black/10" onError={(e) => { e.currentTarget.style.display = "none"; }} />
      <div className="flex items-center gap-2 px-2 py-1.5">
        <MapPin className="h-4 w-4 opacity-80 shrink-0" />
        <span className="text-sm truncate">{name}</span>
      </div>
    </a>
  );
}

function ContactMessage({ m }: { m: MessageRow }) {
  const p = (m.payload ?? {}) as Record<string, unknown>;
  const vcard = (p.vcard as string | undefined) || "";
  const displayName =
    (p.display_name as string | undefined) ||
    (vcard.match(/FN[^:]*:([^\r\n]+)/i)?.[1]?.trim()) ||
    "Contato";
  const telMatch = vcard.match(/TEL[^:]*:([^\r\n]+)/i);
  const tel = telMatch ? telMatch[1].trim() : null;
  const telDigits = tel ? tel.replace(/\D/g, "") : null;
  const emailMatch = vcard.match(/EMAIL[^:]*:([^\r\n]+)/i);
  const email = emailMatch ? emailMatch[1].trim() : null;

  const handleSave = async () => {
    if (!telDigits) return;
    try {
      const phoneE164 = telDigits.startsWith("+") ? telDigits : `+${telDigits}`;
      const { data: existing } = await supabase
        .from("contacts").select("id").eq("phone_e164", phoneE164).maybeSingle();
      if (existing) { toast.success("Contato já existe"); return; }
      const { data: u } = await supabase.auth.getUser();
      const { data: convs } = await supabase
        .from("conversations").select("workspace_id").limit(1).maybeSingle();
      const workspaceId = convs?.workspace_id;
      if (!workspaceId) { toast.error("Workspace não encontrado"); return; }
      const { error } = await supabase.from("contacts").insert({
        workspace_id: workspaceId,
        display_name: displayName,
        phone_e164: phoneE164,
        email: email,
        created_by: u?.user?.id,
      });
      if (error) throw error;
      toast.success("Contato salvo");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="w-[280px]">
      <div className="flex items-center gap-2 px-1 py-1.5">
        <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-700 font-medium">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate text-[14px]">{displayName}</div>
          {tel && (
            <div className="flex items-center gap-1 text-[12px] opacity-70">
              <Phone className="h-3 w-3" /> {tel}
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-black/10 flex">
        {telDigits && (
          <a
            href={`https://wa.me/${telDigits}`}
            target="_blank"
            rel="noreferrer"
            className="flex-1 text-center py-2 text-[13px] font-medium text-[#027eb5] hover:bg-black/5"
          >
            MENSAGEM
          </a>
        )}
        <div className="w-px bg-black/10" />
        <button
          type="button"
          onClick={handleSave}
          className="flex-1 text-center py-2 text-[13px] font-medium text-[#027eb5] hover:bg-black/5"
        >
          SALVAR CONTATO
        </button>
      </div>
    </div>
  );
}

function ReactionMessage({ m }: { m: MessageRow }) {
  const p = (m.payload ?? {}) as Record<string, unknown>;
  const emoji = (p.emoji as string | undefined) || "👍";
  return <span className="text-3xl leading-none">{emoji}</span>;
}

/* ============================== Body dispatch ============================== */

const MEDIA_TYPES = new Set(["image", "audio", "video", "document", "sticker", "location", "contact"]);

function renderBody(m: MessageRow, query: string) {
  switch (m.type) {
    case "text": {
      const body = ((m.payload ?? {}) as Record<string, unknown>).body as string | undefined;
      const text = body ?? "";
      // emoji-only short → larger
      const onlyEmoji = /^[\p{Emoji}\s]{1,6}$/u.test(text);
      return (
        <span className={cn("whitespace-pre-wrap break-words", onlyEmoji && "text-3xl leading-tight")}>
          {query ? highlight(text, query) : linkify(text)}
        </span>
      );
    }
    case "image":    return <ImageMessage m={m} query={query} />;
    case "video":    return <VideoMessage m={m} query={query} />;
    case "audio":    return <AudioMessage m={m} />;
    case "document": return <DocumentMessage m={m} />;
    case "sticker":  return <StickerMessage m={m} />;
    case "location": return <LocationMessage m={m} />;
    case "contact":  return <ContactMessage m={m} />;
    case "reaction": return <ReactionMessage m={m} />;
    case "template": {
      const p = (m.payload ?? {}) as Record<string, unknown>;
      return <span className="italic opacity-80">📋 template ({String(p.name ?? "")})</span>;
    }
    case "system":
      return null;
    default:
      return <span className="italic opacity-60">[{m.type}]</span>;
  }
}

/* ============================== Main ============================== */

type Props = {
  messages: MessageRow[];
  searchQuery?: string;
  activeMatchId?: string | null;
};

export function MessageThread({ messages: rawMessages, searchQuery = "", activeMatchId = null }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [forwardMsg, setForwardMsg] = useState<MessageRow | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const lastLenRef = useRef(0);
  const { user } = useAuth();

  // Hide "delete for me" messages from current user
  const messages = useMemo(
    () => rawMessages.filter((m) => !isDeletedForMe(m, user?.id)),
    [rawMessages, user?.id],
  );

  // Track scroll position
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const onScroll = () => {
      const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      setAtBottom(near);
      if (near) setNewCount(0);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Smart auto-scroll: only when user is at bottom, else show pill
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const len = messages.length;
    const prev = lastLenRef.current;
    lastLenRef.current = len;
    if (len === 0) return;
    if (prev === 0) { el.scrollTop = el.scrollHeight; return; }
    if (len > prev) {
      const last = messages[len - 1];
      const isMine = last?.direction === "out";
      if (atBottom || isMine) {
        el.scrollTop = el.scrollHeight;
      } else {
        setNewCount((n) => n + (len - prev));
      }
    }
  }, [messages, atBottom]);

  useEffect(() => {
    if (!activeMatchId) return;
    const node = itemRefs.current[activeMatchId];
    if (node) node.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeMatchId]);

  const scrollToBottom = () => {
    const el = ref.current; if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setNewCount(0);
  };


  const handleReply = (m: MessageRow) => {
    const p = (m.payload ?? {}) as Record<string, unknown>;
    const body = (p.body as string | undefined) || (p.caption as string | undefined) || `[${m.type}]`;
    window.dispatchEvent(new CustomEvent("inbox:reply", { detail: { id: m.id, body, direction: m.direction } }));
  };

  const jumpTo = (id: string) => {
    const node = itemRefs.current[id];
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
      node.classList.add("ring-2", "ring-yellow-400");
      setTimeout(() => node.classList.remove("ring-2", "ring-yellow-400"), 1500);
    }
  };

  return (
    <div className="relative flex flex-1 min-h-0 flex-col">
      <PinnedMessagesBar messages={messages} onJump={jumpTo} />

      <div ref={ref} className="wa-thread flex-1 overflow-y-auto overscroll-contain scrollbar-hide px-[5%] py-4 space-y-0.5">
        {messages.map((m, idx) => {
          const out = m.direction === "out";
          const prev = messages[idx - 1];
          const next = messages[idx + 1];
          const showDay = !prev || differenceInCalendarDays(new Date(m.created_at), new Date(prev.created_at)) !== 0;
          const grouped = prev && prev.direction === m.direction && !showDay;
          const isLastInGroup = !next || next.direction !== m.direction;
          const isActive = m.id === activeMatchId;
          const p = (m.payload ?? {}) as Record<string, unknown>;
          const forwarded = !!p.forwarded;
          const quoted = (p.quoted_id || p.quoted_text) ? { sender: p.quoted_sender as string | undefined, text: p.quoted_text as string | undefined, type: p.quoted_type as string | undefined } : null;
          const isSticker = m.type === "sticker";
          const isReaction = m.type === "reaction";
          const isSystem = m.type === "system";
          const isMedia = MEDIA_TYPES.has(m.type);
          const deletedAll = isDeletedForAll(m);
          const pinnedHere = isPinned(m);

          if (isSystem) {
            return (
              <div key={m.id} className="flex justify-center my-2">
                <span className="wa-date-pill">{(p.body as string | undefined) || "—"}</span>
              </div>
            );
          }

          // Deleted for all — render placeholder bubble, no actions
          if (deletedAll) {
            return (
              <div key={m.id}>
                {showDay && (
                  <div className="flex justify-center my-3">
                    <span className="wa-date-pill">{dayLabel(new Date(m.created_at))}</span>
                  </div>
                )}
                <div
                  ref={(el) => { itemRefs.current[m.id] = el; }}
                  className={cn("flex mt-2", out ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "wa-bubble relative px-3 py-2 italic text-[13.5px] flex items-center gap-1.5",
                      out ? "wa-bubble-out" : "wa-bubble-in",
                    )}
                    style={{ color: "var(--wa-text-secondary)" }}
                  >
                    🚫 Esta mensagem foi apagada
                  </div>
                </div>
              </div>
            );
          }

          const actions = (
            <div className="flex items-center gap-1 opacity-0 group-hover/msg:opacity-100 transition-opacity">
              <ReactionPicker message={m} />
              <MessageActions
                message={m}
                side={out ? "out" : "in"}
                onReply={handleReply}
                onForward={(mm) => setForwardMsg(mm)}
              />
            </div>
          );

          return (
            <div key={m.id}>
              {showDay && (
                <div className="flex justify-center my-3">
                  <span className="wa-date-pill">{dayLabel(new Date(m.created_at))}</span>
                </div>
              )}
              <div
                ref={(el) => { itemRefs.current[m.id] = el; }}
                className={cn("group/msg flex items-center gap-1", out ? "justify-end" : "justify-start", grouped ? "mt-0.5" : "mt-2")}
              >
                {out && actions}

                {isSticker || isReaction ? (
                  <div className={cn("relative max-w-[75%]", isActive && "ring-2 ring-yellow-400 rounded-md")}>
                    {renderBody(m, searchQuery)}
                    <div className={cn("mt-0.5 flex items-center gap-1 text-[10px] opacity-70", out ? "justify-end" : "justify-start")}>
                      <span>{format(new Date(m.created_at), "HH:mm")}</span>
                      {out && <StatusChecks status={m.status} />}
                    </div>
                    <div className={cn("flex", out ? "justify-end" : "justify-start")}>
                      <ReactionChips message={m} />
                    </div>
                  </div>
                ) : (
                  <div className={cn("flex flex-col min-w-0", out ? "items-end" : "items-start")} style={{ maxWidth: "min(65%, 480px)" }}>
                    <div
                      className={cn(
                        "wa-bubble relative",
                        out ? "wa-bubble-out" : "wa-bubble-in",
                        isMedia ? "p-[3px]" : "px-2 py-[6px]",
                        isActive && "ring-2 ring-yellow-400 ring-offset-1",
                        (p as { _optimistic?: boolean })._optimistic && "opacity-70"
                      )}
                      style={{ width: "fit-content", maxWidth: "100%", minWidth: "80px" }}
                    >
                      {isLastInGroup && !grouped && <BubbleTail side={out ? "right" : "left"} />}
                      {(forwarded || quoted || pinnedHere) && (
                        <div className={cn(isMedia ? "px-1.5 pt-1" : "")}>
                          {pinnedHere && (
                            <div className="flex items-center gap-1 text-[11px] mb-0.5" style={{ color: "var(--wa-text-secondary)" }}>
                              📌 fixada
                            </div>
                          )}
                          {forwarded && <ForwardedHeader />}
                          {quoted && <QuotedPreview quoted={quoted} />}
                        </div>
                      )}
                      <div className={cn(!isMedia && "pr-14")}>{renderBody(m, searchQuery)}</div>
                      <div
                        className={cn(
                          "float-right ml-2 mt-1 flex items-center gap-1 -mb-0.5",
                          isMedia && "absolute right-2 bottom-1.5 bg-black/35 text-white rounded-md px-1.5 py-[1px]"
                        )}
                      >
                        <span className={cn("wa-time", isMedia && "!text-white !opacity-100")} style={isMedia ? { color: "#fff" } : undefined}>
                          {format(new Date(m.created_at), "HH:mm")}
                        </span>
                        {out && <StatusChecks status={m.status} />}
                      </div>
                    </div>
                    <ReactionChips message={m} />
                  </div>
                )}

                {!out && actions}
              </div>
            </div>
          );
        })}
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">
            Sem mensagens nesta conversa.
          </div>
        )}
      </div>
      {!atBottom && newCount > 0 && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-lg hover:bg-emerald-700 transition-colors"
        >
          {newCount} nova{newCount > 1 ? "s" : ""} mensagem{newCount > 1 ? "s" : ""} ↓
        </button>
      )}
      <ForwardMessageDialog open={!!forwardMsg} onOpenChange={(v) => { if (!v) setForwardMsg(null); }} message={forwardMsg} />
    </div>

  );
}

