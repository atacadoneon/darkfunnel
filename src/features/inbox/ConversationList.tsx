import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ContactAvatar } from "./ContactAvatar";
import type { ConversationRow } from "./hooks";



type Props = {
  conversations: ConversationRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};


export function ConversationList({ conversations, selectedId, onSelect }: Props) {

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
          const previewText = c.last_message_preview ?? "";

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
              <Avatar className="h-10 w-10 shrink-0">
                {c.contacts?.profile_pic_url && (
                  <AvatarImage src={c.contacts.profile_pic_url} alt={name} />
                )}
                <AvatarFallback className="text-sm font-medium">
                  {name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm truncate">{name}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{time}</span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className={cn(
                    "text-xs truncate flex-1 min-w-0",
                    c.unread_count > 0 ? "text-foreground font-medium" : "text-muted-foreground"
                  )}>
                    {previewText ? previewText : <span className="italic opacity-60">Sem mensagens</span>}
                  </span>
                  {c.unread_count > 0 && (
                    <Badge className="h-4 px-1.5 text-[10px] shrink-0">{c.unread_count}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant="outline" className="h-3.5 px-1 text-[9px] font-normal">
                    {c.channels?.kind === "whatsapp_cloud" ? "Cloud" : "UAZAPI"}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground truncate">
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
