import { Pin, X } from "lucide-react";
import { useState, useMemo } from "react";
import { isPinned, isDeletedForAll } from "./MessageActions";
import type { MessageRow } from "./hooks";

function preview(m: MessageRow): string {
  const p = (m.payload ?? {}) as Record<string, unknown>;
  const body = (p.body as string | undefined) || (p.caption as string | undefined);
  if (body) return body;
  switch (m.type) {
    case "image": return "📷 Foto";
    case "video": return "🎬 Vídeo";
    case "audio": return "🎙 Áudio";
    case "document": return "📄 Documento";
    case "sticker": return "💟 Figurinha";
    case "location": return "📍 Localização";
    case "contact": return "👤 Contato";
    default: return "Mensagem";
  }
}

export function PinnedMessagesBar({
  messages,
  onJump,
}: {
  messages: MessageRow[];
  onJump: (id: string) => void;
}) {
  const pinned = useMemo(
    () => messages.filter((m) => isPinned(m) && !isDeletedForAll(m)).slice(-3).reverse(),
    [messages],
  );
  const [idx, setIdx] = useState(0);
  if (pinned.length === 0) return null;
  const cur = pinned[idx % pinned.length];
  const handleClick = () => {
    onJump(cur.id);
    if (pinned.length > 1) setIdx((i) => (i + 1) % pinned.length);
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full flex items-center gap-2 bg-[#f5f6f6] dark:bg-[#1f2c33] border-b border-l-[3px] border-l-[#06cf9c] px-4 py-2 text-left hover:bg-[#eef0f1] dark:hover:bg-[#243239] transition-colors"
      title="Ir para mensagem fixada"
    >
      <Pin className="h-3 w-3 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-[#06cf9c] font-medium">
          Mensagem fixada{pinned.length > 1 ? ` (${(idx % pinned.length) + 1}/${pinned.length})` : ""}
        </div>
        <div className="text-[13.5px] truncate text-foreground/80">{preview(cur)}</div>
      </div>
      <X className="h-3 w-3 text-muted-foreground shrink-0 opacity-0" />
    </button>
  );
}
