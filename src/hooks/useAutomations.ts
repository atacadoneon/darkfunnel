import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import type { Automation, AutomationInput } from "@/types/automation";

export function useAutomations() {
  const { current } = useWorkspace();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["automations", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<Automation[]> => {
      const { data, error } = await supabase
        .from("automations")
        .select("*")
        .eq("workspace_id", current!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Automation[];
    },
  });

  useEffect(() => {
    if (!current) return;
    const ch = supabase
      .channel(`automations:${current.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "automations", filter: `workspace_id=eq.${current.id}` },
        () => qc.invalidateQueries({ queryKey: ["automations", current.id] }),
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [current, qc]);

  return q;
}

export function useAutomationMutations() {
  const qc = useQueryClient();
  const { current } = useWorkspace();
  const { user } = useAuth();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["automations", current?.id] });

  const create = useMutation({
    mutationFn: async (input: AutomationInput) => {
      if (!current || !user) throw new Error("sem workspace");
      const payload: Record<string, unknown> = {
        workspace_id: current.id,
        created_by: user.id,
        name: input.name ?? "Nova automação",
        description: input.description ?? null,
        active: input.active ?? true,
        category: input.category ?? "other",
        pipeline_id: input.pipeline_id ?? null,
        channel_id: input.channel_id ?? null,
        trigger: input.trigger ?? { event: "lead_created" },
        conditions: input.conditions ?? [],
        actions: input.actions ?? [],
      };
      const { data, error } = await supabase.from("automations").insert(payload).select("*").single();
      if (error) throw error;
      return data as Automation;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: AutomationInput }) => {
      const { error } = await supabase.from("automations").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("automations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const duplicate = useMutation({
    mutationFn: async (a: Automation) => {
      if (!current || !user) throw new Error("sem workspace");
      const { id, created_at, updated_at, run_count, last_run_at, ...rest } = a;
      const { error } = await supabase.from("automations").insert({
        ...rest,
        name: `${a.name} (cópia)`,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, update, remove, duplicate };
}
