import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import type { Goal, GoalDailyActual, GoalScope } from "@/types/goal";

export function useGoal(year: number, month: number, scope: GoalScope = "workspace", scopeRefId: string | null = null) {
  const { current } = useWorkspace();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["goal", current?.id, year, month, scope, scopeRefId],
    enabled: !!current,
    queryFn: async (): Promise<Goal | null> => {
      let qb = supabase
        .from("goals")
        .select("*")
        .eq("workspace_id", current!.id)
        .eq("year", year)
        .eq("month", month)
        .eq("scope", scope);
      qb = scopeRefId ? qb.eq("scope_ref_id", scopeRefId) : qb.is("scope_ref_id", null);
      const { data, error } = await qb.maybeSingle();
      if (error) throw error;
      return (data as Goal) ?? null;
    },
  });

  useEffect(() => {
    if (!current) return;
    const ch = supabase
      .channel(`goals:${current.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "goals", filter: `workspace_id=eq.${current.id}` },
        () => qc.invalidateQueries({ queryKey: ["goal", current.id] }),
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [current, qc]);

  return q;
}

export function useGoalActuals(goalId: string | null) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["goal-actuals", goalId],
    enabled: !!goalId,
    queryFn: async (): Promise<GoalDailyActual[]> => {
      const { data, error } = await supabase
        .from("goals_daily_actuals")
        .select("*")
        .eq("goal_id", goalId!)
        .order("date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as GoalDailyActual[];
    },
  });

  useEffect(() => {
    if (!goalId) return;
    const ch = supabase
      .channel(`goal-actuals:${goalId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "goals_daily_actuals", filter: `goal_id=eq.${goalId}` },
        () => qc.invalidateQueries({ queryKey: ["goal-actuals", goalId] }),
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [goalId, qc]);

  return q;
}

export function useGoalMutations() {
  const qc = useQueryClient();
  const { current } = useWorkspace();

  const upsertGoal = useMutation({
    mutationFn: async (input: {
      year: number; month: number; scope: GoalScope; scope_ref_id?: string | null;
      target_amount: number; working_days_mask: number; holidays: string[];
    }) => {
      if (!current) throw new Error("sem workspace");
      const payload = {
        workspace_id: current.id,
        year: input.year,
        month: input.month,
        scope: input.scope,
        scope_ref_id: input.scope_ref_id ?? null,
        target_amount: input.target_amount,
        working_days_mask: input.working_days_mask,
        holidays: input.holidays,
      };
      const { data, error } = await supabase
        .from("goals")
        .upsert(payload, { onConflict: "workspace_id,year,month,scope,scope_ref_id" })
        .select("*")
        .single();
      if (error) throw error;
      return data as Goal;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goal", current?.id] }),
  });

  const upsertActual = useMutation({
    mutationFn: async ({ goal_id, date, amount }: { goal_id: string; date: string; amount: number }) => {
      const { error } = await supabase
        .from("goals_daily_actuals")
        .upsert({ goal_id, date, amount }, { onConflict: "goal_id,date" });
      if (error) throw error;
    },
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["goal-actuals", vars.goal_id] }),
  });

  return { upsertGoal, upsertActual };
}
