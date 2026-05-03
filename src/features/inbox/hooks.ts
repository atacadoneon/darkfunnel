import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";

export type ConversationRow = {
  id: string;
  contact_id: string;
  channel_id: string;
  status: string;
  unread_count: number;
  last_message_at: string | null;
  window_expires_at: string | null;
  assigned_user_id: string | null;
  created_at?: string;
  updated_at?: string;
  last_message_preview?: string | null;
  contacts:
    | {
        display_name: string | null;
        phone_e164: string | null;
        profile_pic_url: string | null;
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
          "id,contact_id,channel_id,status,unread_count,last_message_at,window_expires_at,assigned_user_id,created_at,updated_at,contacts(display_name,phone_e164,profile_pic_url,contact_tags(tag_id)),channels(kind,display_name)"
        )
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as ConversationRow[];
    },
    staleTime: 30_000,
  });

  // Realtime
  useEffect(() => {
    if (!current) return;
    const ch = supabase
      .channel(`conv:${current.id}`)
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
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as MessageRow[];
    },
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!conversationId || !current) return;
    const ch = supabase
      .channel(`msg:${conversationId}`)
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
