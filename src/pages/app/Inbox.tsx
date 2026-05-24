import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useConversations, useMessages } from "@/features/inbox/hooks";
import { useConversationIdsByMessageSearch } from "@/features/inbox/filterHooks";
import {
  InboxFilters,
  DEFAULT_FILTERS,
  type InboxFilters as InboxFiltersType,
  type SortKey,
} from "@/features/inbox/InboxFilters";
import { ConversationList } from "@/features/inbox/ConversationList";
import { MessageThread } from "@/features/inbox/MessageThread";
import { Composer } from "@/features/inbox/Composer";
import { ContactPanel } from "@/features/inbox/ContactPanel";
import { ConversationHeader } from "@/features/inbox/ConversationHeader";
import { MessageSearchBar } from "@/features/inbox/MessageSearchBar";
import { NewConversationDialog } from "@/features/inbox/NewConversationDialog";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw } from "lucide-react";
import { useChannels } from "@/features/channels/hooks";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";

function sortConvs<T extends {
  last_message_at: string | null;
  last_inbound_at?: string | null;
  last_outbound_at?: string | null;
  unread_count: number;
}>(arr: T[], sort: SortKey): T[] {
  const t = (v: string | null | undefined) => (v ? new Date(v).getTime() : 0);
  const cp = [...arr];
  switch (sort) {
    case "recent":
      cp.sort((a, b) => t(b.last_message_at) - t(a.last_message_at));
      break;
    case "awaiting":
      cp.sort((a, b) => t(b.last_inbound_at) - t(a.last_inbound_at));
      break;
    case "unread_first":
      cp.sort((a, b) => (b.unread_count - a.unread_count) || (t(b.last_message_at) - t(a.last_message_at)));
      break;
  }
  return cp;
}


export default function Inbox() {
  const { data: conversations = [], isLoading } = useConversations();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<InboxFiltersType>(DEFAULT_FILTERS);
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    const c = params.get("conversation");
    if (c && c !== selectedId) {
      setSelectedId(c);
      const next = new URLSearchParams(params);
      next.delete("conversation");
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const { data: msgMatchIds } = useConversationIdsByMessageSearch(filters.message);

  const [tab, setTab] = useState<"open" | "closed">("open");
  const [quickChips, setQuickChips] = useState<{ unread: boolean; noReply: boolean }>({ unread: false, noReply: false });

  const matchesChips = (c: typeof conversations[number]) => {
    if (quickChips.unread && !(c.unread_count > 0)) return false;
    if (quickChips.noReply) {
      const inAt = c.last_inbound_at ? new Date(c.last_inbound_at).getTime() : 0;
      const outAt = c.last_outbound_at ? new Date(c.last_outbound_at).getTime() : 0;
      if (!inAt) return false;
      if (outAt && outAt >= inAt) return false;
    }
    return true;
  };


  const filtered = useMemo(() => {
    const q = filters.text.trim().toLowerCase();
    let arr = conversations.filter((c) => {
      if (tab === "open") {
        if (c.status !== "open") return false;
      } else {
        if (c.status !== "resolved" && c.status !== "archived") return false;
      }
      if (q) {
        const n = (c.contacts?.display_name ?? "").toLowerCase();
        const p = (c.contacts?.phone_e164 ?? "").toLowerCase();
        if (!n.includes(q) && !p.includes(q)) return false;
      }
      if (filters.channelId && c.channel_id !== filters.channelId) return false;
      if (filters.assignee) {
        if (filters.assignee === "unassigned") {
          if (c.assigned_user_id) return false;
        } else if (c.assigned_user_id !== filters.assignee) return false;
      }
      if (filters.status && c.status !== filters.status) return false;
      if (filters.tagId) {
        const tagIds = c.contacts?.contact_tags?.map((t) => t.tag_id) ?? [];
        if (filters.tagId === "none") {
          if (tagIds.length > 0) return false;
        } else if (!tagIds.includes(filters.tagId)) return false;
      }
      if (filters.message.trim().length >= 2) {
        if (!msgMatchIds || !msgMatchIds.has(c.id)) return false;
      }
      if (!matchesChips(c)) return false;
      return true;
    });
    arr = sortConvs(arr, filters.sort);
    return arr;
  }, [conversations, filters, msgMatchIds, tab, quickChips]);

  // counts dos chips dentro do tab atual (sem aplicar os chips para não zerar)
  const inTab = useMemo(
    () => conversations.filter((c) => (tab === "open" ? c.status === "open" : c.status === "resolved" || c.status === "archived")),
    [conversations, tab]
  );
  const unreadChipCount = useMemo(() => inTab.filter((c) => c.unread_count > 0).length, [inTab]);
  const noReplyChipCount = useMemo(
    () =>
      inTab.filter((c) => {
        const inAt = c.last_inbound_at ? new Date(c.last_inbound_at).getTime() : 0;
        const outAt = c.last_outbound_at ? new Date(c.last_outbound_at).getTime() : 0;
        return inAt > 0 && (!outAt || outAt < inAt);
      }).length,
    [inTab]
  );


  const openTotal = useMemo(() => conversations.filter((c) => c.status === "open").length, [conversations]);
  const closedTotal = useMemo(
    () => conversations.filter((c) => c.status === "resolved" || c.status === "archived").length,
    [conversations]
  );



  const selected = filtered.find((c) => c.id === selectedId) ?? null;

  const { data: messages = [] } = useMessages(selected?.id ?? null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMatchIdx, setActiveMatchIdx] = useState(0);

  useEffect(() => { setSearchOpen(false); setSearchQuery(""); setActiveMatchIdx(0); }, [selectedId]);

  const matchIds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return messages
      .filter((m) => {
        const body = (m.payload as { body?: string })?.body;
        return typeof body === "string" && body.toLowerCase().includes(q);
      })
      .map((m) => m.id);
  }, [messages, searchQuery]);

  useEffect(() => { setActiveMatchIdx(0); }, [searchQuery]);

  const [newConvOpen, setNewConvOpen] = useState(false);

  const openCount = filtered.filter((c) => c.status === "open" || c.status === "in_progress").length;
  const unreadCount = filtered.reduce((acc, c) => acc + (c.unread_count || 0), 0);

  const { data: channels = [] } = useChannels();
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const [refreshingNames, setRefreshingNames] = useState(false);

  const onRefreshNames = async () => {
    const targets = channels.filter((c) => c.kind === "uazapi" && c.status === "connected");
    if (targets.length === 0) {
      toast.error("Nenhum canal WhatsApp conectado");
      return;
    }
    setRefreshingNames(true);
    let total = 0, updated = 0;
    try {
      for (const c of targets) {
        const { data, error } = await supabase.functions.invoke("uazapi-instance", {
          body: { channel_id: c.id, action: "refresh_contacts" },
        });
        if (error) { toast.error(`${c.display_name}: ${error.message}`); continue; }
        if (data?.error) { toast.error(`${c.display_name}: ${data.error}`); continue; }
        total += data?.contacts_total ?? 0;
        updated += data?.contacts_updated ?? 0;
      }
      toast.success(`Nomes atualizados: ${updated} de ${total} contatos`);
      qc.invalidateQueries({ queryKey: ["conversations", current?.id] });
      qc.invalidateQueries({ queryKey: ["contacts", current?.id] });
    } finally {
      setRefreshingNames(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <div className="w-80 shrink-0 border-r flex min-h-0 flex-col overflow-hidden">
        <div className="p-3 border-b">
          <div className="flex items-center justify-between gap-2 mb-2 px-0.5">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span><span className="font-semibold text-foreground">{openCount}</span> abertas</span>
              <span className="opacity-50">·</span>
              <span><span className="font-semibold text-foreground">{unreadCount}</span> não lidas</span>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => setNewConvOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Nova
              </Button>
            </div>
          </div>
          <InboxFilters filters={filters} onChange={setFilters} resultCount={filtered.length} />
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {([
              { id: "unread" as const, label: "Não lidas", count: unreadChipCount },
              { id: "noReply" as const, label: "Sem resposta", count: noReplyChipCount },
            ]).map((chip) => {
              const active = quickChips[chip.id];
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setQuickChips((p) => ({ ...p, [chip.id]: !p[chip.id] }))}
                  className={`inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] border transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-input hover:bg-muted"
                  }`}
                >
                  {chip.label}
                  <span className={`px-1 rounded-full text-[10px] ${
                    active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-foreground"
                  }`}>
                    {chip.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex border-b text-xs">
          {([
            { id: "open" as const, label: "Abertas", count: openTotal },
            { id: "closed" as const, label: "Fechadas", count: closedTotal },
          ]).map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                qc.invalidateQueries({ queryKey: ["conversations", current?.id] });
              }}
              className={`flex-1 px-3 py-2 flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                tab === t.id
                  ? "border-primary text-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              <span className={`px-1.5 rounded-full text-[10px] ${
                tab === t.id ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
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

      <div className="flex-1 flex min-h-0 flex-col min-w-0 overflow-hidden">
        {selected ? (
          <>
            <ConversationHeader
              conversation={selected}
              searchActive={searchOpen}
              onToggleSearch={() => setSearchOpen((v) => !v)}
            />
            {searchOpen && (
              <MessageSearchBar
                query={searchQuery}
                onQueryChange={setSearchQuery}
                matches={matchIds}
                activeIndex={activeMatchIdx}
                onActiveIndexChange={setActiveMatchIdx}
                onClose={() => { setSearchOpen(false); setSearchQuery(""); }}
              />
            )}
            <MessageThread
              messages={messages}
              searchQuery={searchOpen ? searchQuery : ""}
              activeMatchId={searchOpen ? matchIds[activeMatchIdx] ?? null : null}
            />
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

      <NewConversationDialog
        open={newConvOpen}
        onOpenChange={setNewConvOpen}
        onCreated={(id) => setSelectedId(id)}
      />
    </div>
  );
}
