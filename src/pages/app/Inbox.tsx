import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { useConversations, useMessages } from "@/features/inbox/hooks";
import { ConversationList } from "@/features/inbox/ConversationList";
import { MessageThread } from "@/features/inbox/MessageThread";
import { Composer } from "@/features/inbox/Composer";
import { ContactPanel } from "@/features/inbox/ContactPanel";
import { Search } from "lucide-react";

export default function Inbox() {
  const { data: conversations = [], isLoading } = useConversations();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    if (!filter.trim()) return conversations;
    const q = filter.toLowerCase();
    return conversations.filter((c) => {
      const n = (c.contacts?.display_name ?? "").toLowerCase();
      const p = (c.contacts?.phone_e164 ?? "").toLowerCase();
      return n.includes(q) || p.includes(q);
    });
  }, [conversations, filter]);

  const selected = filtered.find((c) => c.id === selectedId) ?? null;
  const { data: messages = [] } = useMessages(selected?.id ?? null);

  return (
    <div className="flex h-full">
      {/* Lista */}
      <div className="w-80 border-r flex flex-col">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>
        <div className="flex-1 min-h-0">
          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Carregando...</div>
          ) : (
            <ConversationList
              conversations={filtered}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
        </div>
      </div>

      {/* Thread */}
      <div className="flex-1 flex flex-col min-w-0">
        {selected ? (
          <>
            <div className="h-14 border-b flex items-center px-4 gap-2">
              <div className="font-semibold">
                {selected.contacts?.display_name ?? selected.contacts?.phone_e164 ?? "Sem nome"}
              </div>
              <span className="text-xs text-muted-foreground">{selected.contacts?.phone_e164}</span>
            </div>
            <MessageThread messages={messages} />
            <Composer conversation={selected} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Selecione uma conversa
          </div>
        )}
      </div>

      {/* Painel direito */}
      {selected && <ContactPanel conversation={selected} />}
    </div>
  );
}
