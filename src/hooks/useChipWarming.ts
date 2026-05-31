import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";

export type WarmingStatus = "warming" | "warm" | "paused" | "disabled";

export type WarmingPoolRow = {
  id: string;
  workspace_id: string;
  channel_id: string;
  opt_in: boolean;
  daily_message_limit: number;
  current_day_sent: number;
  current_day_received: number;
  warm_score: number;
  status: WarmingStatus;
  created_at: string;
  updated_at: string;
};

export type WarmingPoolStats = {
  total_opt_in: number;
  messages_last_24h: number;
};

export function useWarmingPool() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["chip_warming_pool", current?.id],
    enabled: !!current,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chip_warming_pool" as any)
        .select("*")
        .eq("workspace_id", current!.id);
      if (error) throw error;
      return (data ?? []) as unknown as WarmingPoolRow[];
    },
  });

  useEffect(() => {
    if (!current) return;
    const ch = supabase
      .channel(`chip_warming_pool:${current.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chip_warming_pool", filter: `workspace_id=eq.${current.id}` },
        () => qc.invalidateQueries({ queryKey: ["chip_warming_pool", current.id] }),
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [current, qc]);

  return q;
}

export function useUpdateWarmingPool() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { channel_id: string; patch: Partial<WarmingPoolRow> }) => {
      if (!current) throw new Error("Sem workspace");
      const { data, error } = await supabase
        .from("chip_warming_pool" as any)
        .upsert(
          {
            workspace_id: current.id,
            channel_id: input.channel_id,
            ...input.patch,
          },
          { onConflict: "workspace_id,channel_id" },
        )
        .select("*")
        .single();
      if (error) throw error;
      return data as unknown as WarmingPoolRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chip_warming_pool", current?.id] });
    },
  });
}

export function useWarmingPoolStats() {
  return useQuery({
    queryKey: ["chip_warming_pool_stats"],
    staleTime: 60_000,
    queryFn: async (): Promise<WarmingPoolStats> => {
      const [{ count: totalOptIn }, sinceIso] = await Promise.all([
        supabase
          .from("chip_warming_pool" as any)
          .select("id", { count: "exact", head: true })
          .eq("opt_in", true),
        Promise.resolve(new Date(Date.now() - 24 * 60 * 60_000).toISOString()),
      ]);
      const { count: msgs24h } = await supabase
        .from("chip_warming_messages" as any)
        .select("id", { count: "exact", head: true })
        .gt("created_at", sinceIso);

      return {
        total_opt_in: totalOptIn ?? 0,
        messages_last_24h: msgs24h ?? 0,
      };
    },
  });
}
