import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import type { Task, TaskInput, TaskStatus } from "@/types/task";

export function useTasks() {
  const { current } = useWorkspace();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["tasks", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("workspace_id", current!.id)
        .order("position", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!current) return;
    const ch = supabase
      .channel(`tasks:${current.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `workspace_id=eq.${current.id}` },
        () => qc.invalidateQueries({ queryKey: ["tasks", current.id] })
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [current, qc]);

  return query;
}

export function useTaskMutations() {
  const qc = useQueryClient();
  const { current } = useWorkspace();
  const { user } = useAuth();

  const invalidate = () => qc.invalidateQueries({ queryKey: ["tasks", current?.id] });

  const create = useMutation({
    mutationFn: async (input: TaskInput) => {
      if (!current || !user) throw new Error("Workspace ou usuário não encontrado");
      const payload = {
        workspace_id: current.id,
        created_by: user.id,
        title: input.title ?? "Nova tarefa",
        description: input.description ?? null,
        status: input.status ?? "open",
        priority: input.priority ?? "medium",
        assigned_to: input.assigned_to ?? user.id,
        due_date: input.due_date ?? null,
        tags: input.tags ?? [],
        related_contact_id: input.related_contact_id ?? null,
        related_deal_id: input.related_deal_id ?? null,
        position: input.position ?? 0,
      };
      const { data, error } = await supabase.from("tasks").insert(payload).select("*").single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TaskInput }) => {
      const payload: Record<string, unknown> = { ...patch };
      if (patch.status === "completed" && !("completed_at" in patch)) {
        payload.completed_at = new Date().toISOString();
      }
      if (patch.status && patch.status !== "completed") {
        payload.completed_at = null;
      }
      const { data, error } = await supabase.from("tasks").update(payload).eq("id", id).select("*").single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: invalidate,
  });

  const move = useMutation({
    mutationFn: async ({ id, status, position }: { id: string; status: TaskStatus; position: number }) => {
      const payload: Record<string, unknown> = { status, position };
      if (status === "completed") payload.completed_at = new Date().toISOString();
      else payload.completed_at = null;
      const { error } = await supabase.from("tasks").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, update, move };
}
