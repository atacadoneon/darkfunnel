import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ContactAvatar } from "./ContactAvatar";
import { getAttribution } from "./attribution";
import { EmptyState } from "@/components/EmptyState";

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
    estimateSize: () => 76,
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
          const rawPreview = c.last_message_preview ?? "";
          const previewText = rawPreview.length > 60 ? rawPreview.slice(0, 60) + "…" : rawPreview;

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
              <ContactAvatar contact={c.contacts} size={40} />


              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm truncate">{name}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{time}</span>
                </div>
                {c.open_deals?.[0] && (
                  <div className="text-[11px] font-medium flex items-center gap-1 mt-0.5 truncate">
                    <span className="text-emerald-600">
                      R$ {((c.open_deals[0].value_cents ?? 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                    {c.open_deals[0].pipeline_stages?.name && (
                      <>
                        <span className="text-muted-foreground">·</span>
                        <span
                          className="truncate"
                          style={{ color: c.open_deals[0].pipeline_stages.color ?? undefined }}
                        >
                          {c.open_deals[0].pipeline_stages.name}
                        </span>
                      </>
                    )}
                  </div>
                )}
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
                  {(() => {
                    const attr = getAttribution(c.attribution_source);
                    return attr ? (
                      <Badge variant="outline" className={cn("h-3.5 px-1 text-[9px] font-normal", attr.className)}>
                        {attr.label}
                      </Badge>
                    ) : null;
                  })()}
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
        <EmptyState
          icon={Inbox}
          title="Nenhuma conversa por aqui"
          description="Quando novas mensagens chegarem ou você iniciar uma conversa, ela aparecerá nesta lista."
        />
      )}
    </div>
  );
}
