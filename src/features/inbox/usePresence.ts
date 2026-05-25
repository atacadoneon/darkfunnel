import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";

export type PresenceStatus = "online" | "away" | "busy" | "offline";

export type PresenceRow = {
  user_id: string;
  status: PresenceStatus;
  last_seen_at: string | null;
};

/**
 * Lê tabela `user_presence` (se existir). Se a tabela não existir, retorna {}
 * sem quebrar a UI — todos os responsáveis aparecem como offline.
 */
export function usePresenceMap() {
  const { current } = useWorkspace();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["user-presence", current?.id],
    enabled: !!current,
    staleTime: 15_000,
    queryFn: async (): Promise<Record<string, PresenceRow>> => {
      try {
        const { data, error } = await supabase
          .from("user_presence" as never)
          .select("user_id,status,last_seen_at")
          .eq("workspace_id", current!.id);
        if (error) return {};
        const map: Record<string, PresenceRow> = {};
        for (const r of (data ?? []) as PresenceRow[]) {
          map[r.user_id] = r;
        }
        return map;
      } catch {
        return {};
      }
    },
  });

  useEffect(() => {
    if (!current) return;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    try {
      ch = supabase
        .channel(`presence:${current.id}:${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes" as never,
          { event: "*", schema: "public", table: "user_presence", filter: `workspace_id=eq.${current.id}` },
          () => qc.invalidateQueries({ queryKey: ["user-presence", current.id] })
        )
        .subscribe();
    } catch {
      /* table may not exist; ignore */
    }
    return () => {
      if (ch) void supabase.removeChannel(ch);
    };
  }, [current, qc]);

  return query;
}
