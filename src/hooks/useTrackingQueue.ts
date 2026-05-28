import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { toast } from "sonner";

export type QueueItem = {
  id: string;
  provider: string;
  event_name: string | null;
  value_cents: number | null;
  status: "pending" | "sent" | "failed" | string;
  attempts: number;
  last_error: string | null;
  scheduled_for: string | null;
  sent_at: string | null;
  created_at: string;
};

export function useTrackingQueue(periodStart: Date) {
  const { current } = useWorkspace();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["tracking-queue", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<QueueItem[]> => {
      const { data, error } = await supabase
        .from("tracking_queue" as any)
        .select("id,provider,event_name,value_cents,status,attempts,last_error,scheduled_for,sent_at,created_at")
        .eq("workspace_id", current!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return ((data ?? []) as any) as QueueItem[];
    },
  });

  useEffect(() => {
    if (!current) return;
    const ch = supabase
      .channel(`tracking-queue:${current.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tracking_queue", filter: `workspace_id=eq.${current.id}` },
        () => qc.invalidateQueries({ queryKey: ["tracking-queue", current.id] }),
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [current, qc]);

  return q;
}

export function useReprocessFailed() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!current) throw new Error("no ws");
      const { error } = await supabase
        .from("tracking_queue" as any)
        .update({ status: "pending", next_attempt_at: new Date().toISOString(), last_error: null })
        .eq("workspace_id", current.id)
        .eq("status", "failed");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Falhas reagendadas");
      qc.invalidateQueries({ queryKey: ["tracking-queue"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
