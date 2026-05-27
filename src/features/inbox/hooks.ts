import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { formatLastMessagePreview, previewBodyFromPayload } from "./messagePreview";
import { mergeWithOptimistic, optimisticStore, useOptimisticMessages } from "./optimisticMessages";




export type ConversationRow = {
  id: string;
  contact_id: string;
  channel_id: string;
  status: string;
  unread_count: number;
  last_message_at: string | null;
  last_inbound_at?: string | null;
  last_outbound_at?: string | null;
  window_expires_at: string | null;
  assigned_user_id: string | null;
  attribution_source?: string | null;


  created_at?: string;
  updated_at?: string;
  last_message_preview?: string | null;
  last_message_direction?: "in" | "out" | null;
  last_message_status?: string | null;
  contacts:
    | {
        display_name: string | null;
        phone_e164: string | null;
        profile_pic_url: string | null;
        profile_pic_preview_url?: string | null;

        bio?: string | null;
        contact_tags?: { tag_id: string }[];
      }
    | null;
  channels: { kind: string; display_name: string } | null;
  open_deals?: Array<{
    id: string;
    value_cents: number | null;
    title: string | null;
    pipeline_stages: { name: string | null; color: string | null } | null;
  }> | null;
};


export function useConversations() {
  const { current } = useWorkspace();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["conversations", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<ConversationRow[]> => {
      const { data, error } = await supabase
        .from("conversations")
        .select(
          "id,contact_id,channel_id,status,unread_count,last_message_at,last_inbound_at,last_outbound_at,window_expires_at,assigned_user_id,attribution_source,created_at,updated_at,contacts(display_name,phone_e164,profile_pic_url,profile_pic_preview_url,contact_tags(tag_id),deals(id,value_cents,title,status,pipeline_stages(name,color))),channels(kind,display_name),messages(direction,type,payload,status,created_at)"
        )
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .order("created_at", { foreignTable: "messages", ascending: false })
        .limit(1, { foreignTable: "messages" })
        .limit(500);
      if (error) throw error;
      const rows = (data ?? []) as unknown as Array<ConversationRow & { messages?: Array<{ direction: "in" | "out"; type: string; payload: Record<string, unknown> | null; status: string; created_at: string }>; contacts: (NonNullable<ConversationRow["contacts"]> & { deals?: Array<{ id: string; value_cents: number | null; title: string | null; status: string | null; pipeline_stages: { name: string | null; color: string | null } | null }> }) | null }>;
      for (const r of rows) {
        const m = r.messages?.[0];
        r.last_message_preview = m ? formatLastMessagePreview(m.direction, m.type, m.payload) : null;
        r.last_message_direction = m?.direction ?? null;
        r.last_message_status = m?.status ?? null;
        const openDeals = (r.contacts?.deals ?? []).filter((d) => d.status === "open");
        r.open_deals = openDeals.length ? openDeals.map((d) => ({ id: d.id, value_cents: d.value_cents, title: d.title, pipeline_stages: d.pipeline_stages })) : null;
      }

      return rows;

    },

    staleTime: 30_000,
  });

  // Realtime
  useEffect(() => {
    if (!current) return;
    const ch = supabase
      .channel(`conv:${current.id}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations", filter: `workspace_id=eq.${current.id}` },
        (payload: { eventType?: string; new?: Partial<ConversationRow> & { id?: string } }) => {
          // Optimistic patch: aplica imediatamente os campos voláteis (ex.: unread_count)
          // pra que badges (lista + sino) reflitam o UPDATE sem esperar refetch.
          const next = payload?.new;
          if (next?.id && (payload.eventType === "UPDATE" || payload.eventType === "INSERT")) {
            qc.setQueryData<ConversationRow[] | undefined>(
              ["conversations", current.id],
              (prev) => {
                if (!prev) return prev;
                let found = false;
                const updated = prev.map((c) => {
                  if (c.id !== next.id) return c;
                  found = true;
                  return { ...c, ...next } as ConversationRow;
                });
                return found ? updated : prev;
              },
            );
            // sino global: invalida soma
            qc.invalidateQueries({ queryKey: ["unread-total", current.id] });
          }
          qc.invalidateQueries({ queryKey: ["conversations", current.id] });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `workspace_id=eq.${current.id}` },
        () => qc.invalidateQueries({ queryKey: ["conversations", current.id] })
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `workspace_id=eq.${current.id}` },
        () => qc.invalidateQueries({ queryKey: ["conversations", current.id] })
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "contacts", filter: `workspace_id=eq.${current.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["conversations", current.id] });
          qc.invalidateQueries({ queryKey: ["contacts", current.id] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contact_tags" },
        () => qc.invalidateQueries({ queryKey: ["conversations", current.id] })
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [current, qc]);

  return query;
}

export type MessageRow = {
  id: string;
  conversation_id: string;
  direction: "in" | "out";
  type: string;
  payload: Record<string, unknown>;
  status: string;
  created_at: string;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
};

export function useMessages(conversationId: string | null) {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const optimistic = useOptimisticMessages(conversationId);

  const query = useQuery({
    queryKey: ["messages", conversationId],
    enabled: !!conversationId,
    queryFn: async (): Promise<MessageRow[]> => {
      const { data, error } = await supabase
        .from("messages")
        .select("id,conversation_id,direction,type,payload,status,created_at,sent_at,delivered_at,read_at")
        .eq("conversation_id", conversationId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return ((data ?? []) as unknown as MessageRow[]).reverse();
    },
    staleTime: 2_000,
  });

  // Reconcile optimistic store with server data: drop any optimistic that has matched
  useEffect(() => {
    if (!conversationId) return;
    const server = query.data ?? [];
    const current = optimisticStore.get(conversationId);
    if (!current.length) return;
    for (const o of current) {
      const oBody = (o.payload as Record<string, unknown> | null)?.body ?? null;
      const oExt = o._externalId ?? null;
      const matched = server.some((s) => {
        const sPayload = (s.payload ?? {}) as Record<string, unknown>;
        if (oExt && sPayload.external_id === oExt) return true;
        if (s.direction !== "out") return false;
        if (s.type !== o.type) return false;
        if ((sPayload.body ?? "") !== (oBody ?? "")) return false;
        const dt = Math.abs(+new Date(s.created_at) - +new Date(o.created_at));
        return dt < 30_000;
      });
      if (matched) optimisticStore.remove(conversationId, o.id);
    }
  }, [conversationId, query.data]);

  useEffect(() => {
    if (!conversationId || !current) return;
    const ch = supabase
      .channel(`msg:${conversationId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        () => qc.invalidateQueries({ queryKey: ["messages", conversationId] })
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [conversationId, current, qc]);

  const merged = useMemo(
    () => mergeWithOptimistic(query.data ?? [], optimistic),
    [query.data, optimistic]
  );

  return { ...query, data: merged } as typeof query;
}


export type LastMessagePreview = {
  conversation_id: string;
  direction: "in" | "out";
  type: string;
  body: string;
  created_at: string;
};


export function useLastMessagesByConversation(conversationIds: string[]) {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const ids = useMemo(() => [...conversationIds].sort(), [conversationIds]);
  const key = ids.join(",");

  const query = useQuery({
    queryKey: ["last-messages", current?.id, key],
    enabled: !!current && ids.length > 0,
    queryFn: async (): Promise<Record<string, LastMessagePreview>> => {
      const map: Record<string, LastMessagePreview> = {};
      const chunkSize = 100;
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from("messages")
          .select("conversation_id,direction,type,payload,created_at")
          .in("conversation_id", chunk)
          .order("created_at", { ascending: false })
          .limit(chunk.length * 8);
        if (error) throw error;
        for (const r of (data ?? []) as Array<{
          conversation_id: string;
          direction: "in" | "out";
          type: string;
          payload: Record<string, unknown> | null;
          created_at: string;
        }>) {
          if (map[r.conversation_id]) continue;
          map[r.conversation_id] = {
            conversation_id: r.conversation_id,
            direction: r.direction,
            type: r.type,
            body: previewBodyFromPayload(r.type, r.payload),
            created_at: r.created_at,
          };
        }
      }
      return map;
    },
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!current) return;
    const ch = supabase
      .channel(`last-msg:${current.id}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `workspace_id=eq.${current.id}` },
        () => qc.invalidateQueries({ queryKey: ["last-messages", current.id] })
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [current, qc]);

  return query;
}

