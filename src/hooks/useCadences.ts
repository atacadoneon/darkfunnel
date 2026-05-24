import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import type { Cadence, CadenceStep, CadenceTriggerType, CadenceStepType } from "@/types/cadence";

export function useCadences() {
  const { current } = useWorkspace();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["cadences", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<Cadence[]> => {
      const { data, error } = await supabase
        .from("cadences")
        .select("*")
        .eq("workspace_id", current!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Cadence[];
    },
  });

  useEffect(() => {
    if (!current) return;
    const ch = supabase
      .channel(`cadences:${current.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cadences", filter: `workspace_id=eq.${current.id}` },
        () => qc.invalidateQueries({ queryKey: ["cadences", current.id] }),
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [current, qc]);

  return q;
}

export function useCadenceSteps(cadenceId: string | null) {
  return useQuery({
    queryKey: ["cadence-steps", cadenceId],
    enabled: !!cadenceId,
    queryFn: async (): Promise<CadenceStep[]> => {
      const { data, error } = await supabase
        .from("cadence_steps")
        .select("*")
        .eq("cadence_id", cadenceId!)
        .order("order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CadenceStep[];
    },
  });
}

export type NewCadenceInput = {
  name: string;
  description?: string;
  channel_id?: string | null;
  trigger_type: CadenceTriggerType;
  enabled?: boolean;
  steps: { type: CadenceStepType; content: Record<string, unknown>; delay_minutes: number }[];
};

export function useCadenceMutations() {
  const qc = useQueryClient();
  const { current } = useWorkspace();
  const { user } = useAuth();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["cadences", current?.id] });

  const create = useMutation({
    mutationFn: async (input: NewCadenceInput) => {
      if (!current || !user) throw new Error("sem workspace");
      const { data: cad, error } = await supabase
        .from("cadences")
        .insert({
          workspace_id: current.id,
          created_by: user.id,
          name: input.name,
          description: input.description ?? null,
          channel_id: input.channel_id ?? null,
          trigger_type: input.trigger_type,
          enabled: input.enabled ?? true,
        })
        .select("*")
        .single();
      if (error) throw error;
      if (input.steps.length > 0) {
        const rows = input.steps.map((s, i) => ({
          cadence_id: (cad as Cadence).id,
          order: i,
          type: s.type,
          content: s.content,
          delay_minutes: s.delay_minutes,
        }));
        const { error: e2 } = await supabase.from("cadence_steps").insert(rows);
        if (e2) throw e2;
      }
      return cad as Cadence;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Cadence> }) => {
      const { error } = await supabase.from("cadences").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cadences").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
