import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";

export type Tag = {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  created_at: string;
};

export function useTags() {
  const { current } = useWorkspace();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["tags", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<Tag[]> => {
      const { data, error } = await supabase
        .from("workspace_tags")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Tag[];
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!current) return;
    const ch = supabase
      .channel(`tags:${current.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workspace_tags", filter: `workspace_id=eq.${current.id}` },
        () => qc.invalidateQueries({ queryKey: ["tags", current.id] })
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [current, qc]);

  return q;
}

/** Busca conversas cujas mensagens contenham determinado texto (payload->>body). */
export function useConversationIdsByMessageSearch(text: string) {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["msg-search", current?.id, text],
    enabled: !!current && text.trim().length >= 2,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from("messages")
        .select("conversation_id, payload")
        .eq("type", "text")
        .ilike("payload->>body", `%${text.trim()}%`)
        .limit(500);
      if (error) throw error;
      const set = new Set<string>();
      (data ?? []).forEach((r: { conversation_id: string }) => set.add(r.conversation_id));
      return set;
    },
    staleTime: 10_000,
  });
}
