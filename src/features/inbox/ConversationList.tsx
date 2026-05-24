import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { ConversationRow, LastMessagePreview } from "./hooks";

type Props = {
  conversations: ConversationRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  lastMessages?: Record<string, LastMessagePreview>;
};


export function ConversationList({ conversations, selectedId, onSelect, lastMessages }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const v = useVirtualizer({
    count: conversations.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 84,
    overscan: 8,
  });


  return (
    <div ref={parentRef} className="h-full overflow-y-auto overscroll-contain scrollbar-hide">
      <div style={{ height: v.getTotalSize(), position: "relative" }}>
        {v.getVirtualItems().map((vi) => {
          const c = conversations[vi.index];
          const name = c.contacts?.display_name ?? c.contacts?.phone_e164 ?? "Sem nome";
          const time = c.last_message_at
            ? formatDistanceToNowStrict(new Date(c.last_message_at), { locale: ptBR, addSuffix: false })
            : "";
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={cn(
                "absolute left-0 right-0 px-3 py-2 flex gap-3 items-center text-left border-b hover:bg-muted/50 transition-colors",
                selectedId === c.id && "bg-muted"
              )}
              style={{ top: vi.start, height: vi.size }}
            >
              <div className="h-9 w-9 rounded-full bg-muted shrink-0 flex items-center justify-center text-sm font-medium">
                {name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm truncate">{name}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{time}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="h-4 px-1 text-[9px] font-normal">
                    {c.channels?.kind === "whatsapp_cloud" ? "Cloud" : "UAZAPI"}
                  </Badge>
                  {c.unread_count > 0 && (
                    <Badge className="h-4 px-1.5 text-[10px]">{c.unread_count}</Badge>
                  )}
                  <span className="text-xs text-muted-foreground truncate">
                    {c.contacts?.phone_e164 ?? ""}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {conversations.length === 0 && (
        <div className="p-8 text-center text-sm text-muted-foreground">
          Nenhuma conversa ainda.
        </div>
      )}
    </div>
  );
}
