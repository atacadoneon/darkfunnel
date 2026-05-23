import { useEffect, useRef } from "react";
import { format } from "date-fns";
import { Check, CheckCheck, Clock, FileText, Download, MapPin, Image as ImageIcon, Music, Video as VideoIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MessageRow } from "./hooks";

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
        <a href={mediaUrl} target="_blank" rel="noreferrer">
          <img src={mediaUrl} loading="lazy" className="max-h-80 w-full rounded object-cover" alt={caption || "imagem"} />
        </a>
        {caption && <div className="px-1 text-sm whitespace-pre-wrap break-words">{highlight(caption, query)}</div>}
      </div>
    );
  }

  if (m.type === "audio") {
    if (!mediaUrl) return unavailable(Music, "🎙 áudio");
    const seconds = p.seconds as number | undefined;
    return (
      <div className="space-y-1">
        <audio controls preload="metadata" src={mediaUrl} className="h-10 w-full max-w-[280px]" />
        <div className="px-1 text-xs opacity-70">🎙 áudio{seconds ? ` · ${seconds}s` : ""}</div>
      </div>
    );
  }

  if (m.type === "video") {
    if (!mediaUrl) return unavailable(VideoIcon, "🎬 vídeo");
    return (
      <div className="space-y-1">
        <video controls preload="metadata" src={mediaUrl} className="max-h-80 w-full max-w-[320px] rounded" />
        {caption && <div className="px-1 text-sm whitespace-pre-wrap break-words">{highlight(caption, query)}</div>}
      </div>
    );
  }

  if (m.type === "document") {
    if (!mediaUrl) return unavailable(FileText, "📎 documento");
    const filename = (p.filename as string | undefined) || "arquivo";
    const mime = (p.mime as string | undefined) || "";
    return (
      <a
        href={mediaUrl}
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
    );
  }

  if (m.type === "sticker") {
    if (!mediaUrl) return unavailable(ImageIcon, "sticker");
    return <img src={mediaUrl} className="h-32 w-32 rounded object-contain" alt="sticker" />;
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
      className="flex-1 overflow-y-auto p-4 space-y-1 bg-[#efeae2] dark:bg-[#0b141a]"
    >
      {messages.map((m, idx) => {
        const out = m.direction === "out";
        const prev = messages[idx - 1];
        const grouped = prev && prev.direction === m.direction;
        const isActive = m.id === activeMatchId;
        return (
          <div
            key={m.id}
            ref={(el) => { itemRefs.current[m.id] = el; }}
            className={cn("flex", out ? "justify-end" : "justify-start", grouped ? "mt-0.5" : "mt-2")}
          >
            <div
              className={cn(
                "relative max-w-[75%] rounded-lg px-2.5 py-1.5 text-sm shadow-sm transition-shadow",
                out
                  ? "bg-[#d9fdd3] text-[#111b21] dark:bg-[#005c4b] dark:text-white"
                  : "bg-white text-[#111b21] dark:bg-[#202c33] dark:text-white",
                isActive && "ring-2 ring-yellow-400 ring-offset-1"
              )}
            >
              <div className="pr-14">{renderBody(m, searchQuery)}</div>
              <div
                className={cn(
                  "float-right -mb-0.5 ml-2 mt-1 flex items-center gap-1 text-[10px]",
                  out ? "text-[#667781] dark:text-white/60" : "text-[#667781] dark:text-white/50"
                )}
              >
                <span>{format(new Date(m.created_at), "HH:mm")}</span>
                {out && <StatusIcon status={m.status} />}
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
