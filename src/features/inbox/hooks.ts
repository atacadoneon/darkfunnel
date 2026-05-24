import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { formatLastMessagePreview, previewBodyFromPayload } from "./messagePreview";



export type ConversationRow = {
  id: string;
  contact_id: string;
  channel_id: string;
  status: string;
  unread_count: number;
  last_message_at: string | null;
  window_expires_at: string | null;
  assigned_user_id: string | null;
  attribution_source?: string | null;

  created_at?: string;
  updated_at?: string;
  last_message_preview?: string | null;
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
          "id,contact_id,channel_id,status,unread_count,last_message_at,window_expires_at,assigned_user_id,created_at,updated_at,contacts(display_name,phone_e164,profile_pic_url,profile_pic_preview_url,contact_tags(tag_id)),channels(kind,display_name),messages(direction,type,payload,created_at)"
        )
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .order("created_at", { foreignTable: "messages", ascending: false })
        .limit(1, { foreignTable: "messages" })
        .limit(500);
      if (error) throw error;
      const rows = (data ?? []) as unknown as Array<ConversationRow & { messages?: Array<{ direction: "in" | "out"; type: string; payload: Record<string, unknown> | null; created_at: string }> }>;
      for (const r of rows) {
        const m = r.messages?.[0];
        r.last_message_preview = m ? formatLastMessagePreview(m.direction, m.type, m.payload) : null;
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
        () => qc.invalidateQueries({ queryKey: ["conversations", current.id] })
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `workspace_id=eq.${current.id}` },
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
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });

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

  return query;
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

