import { useEffect, useRef, useState } from "react";
import { format, isToday, isYesterday, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, CheckCheck, Clock, FileText, Download, MapPin, Image as ImageIcon, Music, Video as VideoIcon, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import type { MessageRow } from "./hooks";

function RefreshMediaButton({ messageId, conversationId, onRefreshed }: { messageId: string; conversationId: string; onRefreshed: (url: string) => void }) {
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        const { data, error } = await supabase.functions.invoke("refresh-media", { body: { message_id: messageId } });
        setLoading(false);
        if (error || !data?.ok || !data?.media_url) {
          toast.error("Não foi possível recarregar a mídia");
          return;
        }
        onRefreshed(data.media_url as string);
        qc.invalidateQueries({ queryKey: ["messages", conversationId] });
        toast.success(data.persisted_in_storage ? "Mídia recarregada e armazenada" : "Mídia recarregada");
      }}
    >
      <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
      Recarregar mídia
    </Button>
  );
}

function MediaWithRefresh({
  messageId,
  conversationId,
  url,
  render,
}: {
  messageId: string;
  conversationId: string;
  url: string;
  render: (currentUrl: string, onError: () => void) => React.ReactNode;
}) {
  const [currentUrl, setCurrentUrl] = useState(url);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setCurrentUrl(url); setFailed(false); }, [url]);
  useEffect(() => {
    let cancelled = false;
    fetch(currentUrl, { method: "HEAD" })
      .then((r) => { if (!cancelled && (r.status === 404 || r.status === 410)) setFailed(true); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [currentUrl]);
  if (failed) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-md border bg-background/40 p-2">
        <span className="text-xs opacity-70">Mídia expirada ou indisponível.</span>
        <RefreshMediaButton
          messageId={messageId}
          conversationId={conversationId}
          onRefreshed={(u) => { setCurrentUrl(u); setFailed(false); }}
        />
      </div>
    );
  }
  return <>{render(currentUrl, () => setFailed(true))}</>;
}


function dayLabel(d: Date): string {
  if (isToday(d)) return "Hoje";
  if (isYesterday(d)) return "Ontem";
  const diff = differenceInCalendarDays(new Date(), d);
  if (diff < 7) return format(d, "EEEE", { locale: ptBR }).replace(/^./, (c) => c.toUpperCase());
  return format(d, "dd/MM/yyyy");
}


function StatusIcon({ status }: { status: string }) {
  if (status === "read")
    return <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" strokeWidth={2.5} />;
  if (status === "delivered")
    return <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2.5} />;
  if (status === "sent")
    return <Check className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2.5} />;
  if (status === "failed")
    return <span className="text-destructive text-[10px] font-bold">!</span>;
  return <Clock className="h-3 w-3 opacity-60" />;
}

function highlight(text: string, query: string) {
  if (!query || query.length < 2) return text;
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
  const parts = text.split(re);
  return parts.map((p, i) =>
    re.test(p) ? <mark key={i} className="bg-yellow-300 text-black rounded px-0.5">{p}</mark> : <span key={i}>{p}</span>
  );
}

function unavailable(Icon: typeof FileText, label: string) {
  return (
    <span className="inline-flex items-center gap-1.5 italic opacity-70">
      <Icon className="h-4 w-4" /> {label} (mídia indisponível)
    </span>
  );
}

function renderBody(m: MessageRow, query: string) {
  const p = (m.payload ?? {}) as Record<string, unknown>;
  const mediaUrl = (p.media_url as string | undefined) || undefined;
  const caption = (p.body as string | undefined) || (p.caption as string | undefined) || "";

  if (m.type === "text")
    return <span className="whitespace-pre-wrap break-words">{highlight(String(p.body ?? ""), query)}</span>;

  if (m.type === "image") {
    if (!mediaUrl) return unavailable(ImageIcon, "📷 imagem");
    return (
      <div className="space-y-1">
        <MediaWithRefresh
          messageId={m.id} conversationId={m.conversation_id}
          url={mediaUrl}
          render={(u, onError) => (
            <a href={u} target="_blank" rel="noreferrer">
              <img src={u} loading="lazy" onError={onError} className="max-h-80 w-full rounded object-cover" alt={caption || "imagem"} />
            </a>
          )}
        />
        {caption && <div className="px-1 text-sm whitespace-pre-wrap break-words">{highlight(caption, query)}</div>}
      </div>
    );
  }

  if (m.type === "audio") {
    if (!mediaUrl) return unavailable(Music, "🎙 áudio");
    const seconds = p.seconds as number | undefined;
    return (
      <div className="space-y-1">
        <MediaWithRefresh
          messageId={m.id} conversationId={m.conversation_id}
          url={mediaUrl}
          render={(u, onError) => (
            <audio controls preload="metadata" src={u} onError={onError} className="h-10 w-full max-w-[280px]" />
          )}
        />
        <div className="px-1 text-xs opacity-70">🎙 áudio{seconds ? ` · ${seconds}s` : ""}</div>
      </div>
    );
  }

  if (m.type === "video") {
    if (!mediaUrl) return unavailable(VideoIcon, "🎬 vídeo");
    return (
      <div className="space-y-1">
        <MediaWithRefresh
          messageId={m.id} conversationId={m.conversation_id}
          url={mediaUrl}
          render={(u, onError) => (
            <video controls preload="metadata" src={u} onError={onError} className="max-h-80 w-full max-w-[320px] rounded" />
          )}
        />
        {caption && <div className="px-1 text-sm whitespace-pre-wrap break-words">{highlight(caption, query)}</div>}
      </div>
    );
  }

  if (m.type === "document") {
    if (!mediaUrl) return unavailable(FileText, "📎 documento");
    const filename = (p.filename as string | undefined) || "arquivo";
    const mime = (p.mime as string | undefined) || "";
    return (
      <MediaWithRefresh
        messageId={m.id} conversationId={m.conversation_id}
        url={mediaUrl}
        render={(u) => (
          <a
            href={u}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-md border bg-background/40 p-2 hover:bg-background/60 max-w-[300px]"
          >
            <FileText className="h-6 w-6 shrink-0 opacity-80" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{filename}</div>
              {mime && <div className="truncate text-xs opacity-60">{mime}</div>}
            </div>
            <Download className="h-4 w-4 shrink-0 opacity-70" />
          </a>
        )}
      />
    );
  }

  if (m.type === "sticker") {
    if (!mediaUrl) return unavailable(ImageIcon, "sticker");
    return (
      <MediaWithRefresh
        messageId={m.id} conversationId={m.conversation_id}
        url={mediaUrl}
        render={(u, onError) => (
          <img src={u} onError={onError} className="h-32 w-32 rounded object-contain" alt="sticker" />
        )}
      />
    );
  }


  if (m.type === "location") {
    const lat = p.lat as number | undefined;
    const lng = p.lng as number | undefined;
    if (lat == null || lng == null) return unavailable(MapPin, "📍 localização");
    const name = (p.name as string | undefined) || `${lat}, ${lng}`;
    return (
      <a
        href={`https://www.google.com/maps?q=${lat},${lng}`}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 rounded-md border bg-background/40 p-2 hover:bg-background/60"
      >
        <MapPin className="h-5 w-5 opacity-80" />
        <span className="text-sm">{name}</span>
      </a>
    );
  }

  if (m.type === "reaction") {
    const emoji = (p.emoji as string | undefined) || "👍";
    return <span className="text-2xl">{emoji}</span>;
  }

  if (m.type === "template") return <span className="italic opacity-80">📋 template ({String(p.name ?? "")})</span>;
  return <span className="italic opacity-60">[{m.type}]</span>;
}

const MEDIA_TYPES = new Set(["image", "audio", "video", "document", "sticker", "location"]);

type Props = {
  messages: MessageRow[];
  searchQuery?: string;
  activeMatchId?: string | null;
};

export function MessageThread({ messages, searchQuery = "", activeMatchId = null }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  useEffect(() => {
    if (!activeMatchId) return;
    const node = itemRefs.current[activeMatchId];
    if (node) node.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeMatchId]);

  return (
    <div
      ref={ref}
      className="flex-1 overflow-y-auto overscroll-contain scrollbar-hide p-4 space-y-1 bg-[#efeae2] dark:bg-[#0b141a]"
    >
      {messages.map((m, idx) => {
        const out = m.direction === "out";
        const prev = messages[idx - 1];
        const grouped = prev && prev.direction === m.direction;
        const isActive = m.id === activeMatchId;
        const isMedia = MEDIA_TYPES.has(m.type);
        const curDate = new Date(m.created_at);
        const showDay = !prev || differenceInCalendarDays(curDate, new Date(prev.created_at)) !== 0;
        return (
          <div key={m.id}>
            {showDay && (
              <div className="flex justify-center my-3">
                <span className="px-2.5 py-0.5 rounded-md bg-white/80 dark:bg-[#202c33]/80 text-[11px] text-[#54656f] dark:text-white/70 shadow-sm">
                  {dayLabel(curDate)}
                </span>
              </div>
            )}
            <div
              ref={(el) => { itemRefs.current[m.id] = el; }}
              className={cn("flex", out ? "justify-end" : "justify-start", grouped && !showDay ? "mt-0.5" : "mt-2")}
            >
              <div
                className={cn(
                  "relative max-w-[75%] rounded-lg text-sm shadow-sm transition-shadow",
                  isMedia ? "p-1.5" : "px-2.5 py-1.5",
                  out
                    ? "bg-[#d9fdd3] text-[#111b21] dark:bg-[#005c4b] dark:text-white"
                    : "bg-white text-[#111b21] dark:bg-[#202c33] dark:text-white",
                  isActive && "ring-2 ring-yellow-400 ring-offset-1"
                )}
              >
                <div className={cn(!isMedia && "pr-14")}>{renderBody(m, searchQuery)}</div>
                <div
                  className={cn(
                    "float-right -mb-0.5 ml-2 mt-1 flex items-center gap-1 text-[10px]",
                    out ? "text-[#667781] dark:text-white/60" : "text-[#667781] dark:text-white/50"
                  )}
                >
                  <span>{format(curDate, "HH:mm")}</span>
                  {out && <StatusIcon status={m.status} />}
                </div>
              </div>
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
  );
}

