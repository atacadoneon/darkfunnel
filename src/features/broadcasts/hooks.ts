import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";

export type BroadcastStatus = "draft" | "scheduled" | "running" | "completed" | "cancelled" | "failed";

export type Broadcast = {
  id: string;
  workspace_id: string;
  name: string;
  status: BroadcastStatus;
  channel_id: string | null;
  filters: any;
  message_template: string | null;
  media_url: string | null;
  media_kind: string | null;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  scheduled_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  rate_per_minute: number | null;
  create_task: boolean;
  task_template: string | null;
  task_offset_days: number | null;
  invoke_flow_id: string | null;
  created_at: string;
  updated_at: string;
};

export function useBroadcasts() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["broadcasts", current?.id],
    enabled: !!current,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("broadcasts" as any)
        .select("*")
        .eq("workspace_id", current!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Broadcast[];
    },
  });

  useEffect(() => {
    if (!current) return;
    const ch = supabase
      .channel(`broadcasts:${current.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "broadcasts", filter: `workspace_id=eq.${current.id}` },
        () => qc.invalidateQueries({ queryKey: ["broadcasts", current.id] }),
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [current, qc]);

  return q;
}

export function useBroadcast(id: string | undefined) {
  return useQuery({
    queryKey: ["broadcast", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("broadcasts" as any)
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Broadcast | null;
    },
  });
}

export function useUpsertBroadcast() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Broadcast> & { id?: string }) => {
      if (!current) throw new Error("Sem workspace");
      const payload: any = { ...input, workspace_id: current.id };
      if (input.id) {
        const { id, ...rest } = payload;
        const { data, error } = await supabase
          .from("broadcasts" as any)
          .update(rest)
          .eq("id", id)
          .select("*")
          .single();
        if (error) throw error;
        return data as unknown as Broadcast;
      }
      const { data, error } = await supabase
        .from("broadcasts" as any)
        .insert(payload)
        .select("*")
        .single();
      if (error) throw error;
      return data as unknown as Broadcast;
    },
    onSuccess: (b) => {
      qc.invalidateQueries({ queryKey: ["broadcasts", current?.id] });
      if (b?.id) qc.invalidateQueries({ queryKey: ["broadcast", b.id] });
    },
  });
}

export type RecipientPreview = {
  total: number;
  sample: Array<{
    contact_id: string;
    display_name: string | null;
    phone_e164: string | null;
    avatar_url?: string | null;
  }>;
};

export function usePreviewRecipients() {
  return useMutation({
    mutationFn: async (filters: any): Promise<RecipientPreview> => {
      const { data, error } = await supabase.rpc("preview_broadcast_recipients" as any, {
        p_filters: filters,
      });
      if (error) throw error;
      // Backend pode retornar { total, sample } ou array — normalizamos
      if (Array.isArray(data)) {
        return { total: data.length, sample: data.slice(0, 20) as any };
      }
      const d = (data ?? {}) as any;
      return {
        total: Number(d.total ?? 0),
        sample: (d.sample ?? []) as any,
      };
    },
  });
}

export function statusMeta(s: BroadcastStatus) {
  const map: Record<BroadcastStatus, { label: string; cls: string }> = {
    draft:     { label: "Rascunho",   cls: "bg-muted text-muted-foreground" },
    scheduled: { label: "Agendado",   cls: "bg-blue-500/15 text-blue-600 dark:text-blue-300" },
    running:   { label: "Em execução",cls: "bg-amber-500/15 text-amber-600 dark:text-amber-300" },
    completed: { label: "Concluído",  cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" },
    cancelled: { label: "Cancelado",  cls: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-300" },
    failed:    { label: "Falhou",     cls: "bg-red-500/15 text-red-600 dark:text-red-300" },
  };
  return map[s] ?? map.draft;
}
