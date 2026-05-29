import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useAuth } from "@/features/auth/AuthProvider";

export type Playbook = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  category: string | null;
  color: string | null;
  icon: string | null;
  is_active: boolean;
  created_by: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PlaybookStep = {
  id: string;
  playbook_id: string;
  position: number;
  title: string | null;
  description: string | null;
  action_type: string;
  action_config: Record<string, any> | null;
  message_type: string | null;
  payload: Record<string, any> | null;
  delay_minutes: number | null;
  due_offset_days: number | null;
  due_offset_hours: number | null;
  is_required: boolean;
};

export type PlaybookRun = {
  id: string;
  workspace_id: string;
  playbook_id: string;
  deal_id: string | null;
  contact_id: string | null;
  assigned_user_id: string | null;
  status: "running" | "paused" | "completed" | "abandoned";
  started_at: string;
  completed_at: string | null;
};

export type PlaybookRunStep = {
  id: string;
  run_id: string;
  step_id: string;
  status: "pending" | "done" | "skipped" | "failed";
  due_at: string | null;
  completed_at: string | null;
  completed_by_user_id: string | null;
  notes: string | null;
};

export function usePlaybooksList() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["pb:list", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<Playbook[]> => {
      const { data, error } = await (supabase as any)
        .from("playbooks")
        .select("*")
        .eq("workspace_id", current!.id)
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Playbook[];
    },
  });
}

export function usePlaybook(id: string | undefined) {
  return useQuery({
    queryKey: ["pb:one", id],
    enabled: !!id,
    queryFn: async (): Promise<Playbook | null> => {
      const { data, error } = await (supabase as any)
        .from("playbooks").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data as Playbook | null;
    },
  });
}

export function usePlaybookSteps(playbookId: string | undefined) {
  return useQuery({
    queryKey: ["pb:steps", playbookId],
    enabled: !!playbookId,
    queryFn: async (): Promise<PlaybookStep[]> => {
      const { data, error } = await (supabase as any)
        .from("playbook_steps").select("*")
        .eq("playbook_id", playbookId!).order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PlaybookStep[];
    },
  });
}

export function usePlaybookMutations() {
  const qc = useQueryClient();
  const { current } = useWorkspace();
  const { user } = useAuth();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["pb:list", current?.id] });

  const create = useMutation({
    mutationFn: async (input: Partial<Playbook>) => {
      if (!current || !user) throw new Error("sem workspace");
      const { data, error } = await (supabase as any).from("playbooks").insert({
        workspace_id: current.id,
        created_by: user.id,
        name: input.name ?? "Novo Playbook",
        description: input.description ?? null,
        category: input.category ?? "geral",
        color: input.color ?? "#8b5cf6",
        icon: input.icon ?? "BookOpen",
        is_active: input.is_active ?? true,
      }).select("*").single();
      if (error) throw error;
      return data as Playbook;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Playbook> }) => {
      const { error } = await (supabase as any).from("playbooks").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["pb:one", v.id] });
    },
  });

  const archive = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("playbooks").update({ archived_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const duplicate = useMutation({
    mutationFn: async (pb: Playbook) => {
      if (!current || !user) throw new Error("sem workspace");
      const { data: np, error } = await (supabase as any).from("playbooks").insert({
        workspace_id: current.id,
        created_by: user.id,
        name: `${pb.name} (cópia)`,
        description: pb.description,
        category: pb.category,
        color: pb.color,
        icon: pb.icon,
        is_active: false,
      }).select("*").single();
      if (error) throw error;
      const { data: steps } = await (supabase as any)
        .from("playbook_steps").select("*").eq("playbook_id", pb.id).order("position");
      if (steps?.length) {
        const rows = steps.map((s: PlaybookStep) => ({
          playbook_id: np.id,
          position: s.position,
          title: s.title,
          description: s.description,
          action_type: s.action_type,
          action_config: s.action_config,
          message_type: s.message_type,
          payload: s.payload,
          delay_minutes: s.delay_minutes,
          due_offset_days: s.due_offset_days,
          due_offset_hours: s.due_offset_hours,
          is_required: s.is_required,
        }));
        await (supabase as any).from("playbook_steps").insert(rows);
      }
    },
    onSuccess: invalidate,
  });

  return { create, update, archive, duplicate };
}

export function usePlaybookStepMutations(playbookId: string | undefined) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["pb:steps", playbookId] });

  const upsert = useMutation({
    mutationFn: async (step: Partial<PlaybookStep> & { id?: string }) => {
      if (!playbookId) throw new Error("sem playbook");
      if (step.id) {
        const { id, ...patch } = step;
        const { error } = await (supabase as any).from("playbook_steps").update(patch).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("playbook_steps").insert({
          playbook_id: playbookId,
          position: step.position ?? 0,
          title: step.title ?? "Novo passo",
          description: step.description ?? null,
          action_type: step.action_type ?? "task",
          action_config: step.action_config ?? {},
          due_offset_days: step.due_offset_days ?? 0,
          due_offset_hours: step.due_offset_hours ?? 0,
          is_required: step.is_required ?? false,
        });
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("playbook_steps").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const reorder = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await Promise.all(
        orderedIds.map((id, idx) =>
          (supabase as any).from("playbook_steps").update({ position: idx }).eq("id", id),
        ),
      );
    },
    onSuccess: invalidate,
  });

  return { upsert, remove, reorder };
}

export function usePlaybookRuns(filters?: { status?: string; playbookId?: string; userId?: string }) {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["pb:runs", current?.id, filters],
    enabled: !!current,
    queryFn: async () => {
      let q = (supabase as any)
        .from("playbook_runs")
        .select("*, playbooks(name,color), deals(title), contacts(name)")
        .eq("workspace_id", current!.id)
        .order("started_at", { ascending: false })
        .limit(200);
      if (filters?.status) q = q.eq("status", filters.status);
      if (filters?.playbookId) q = q.eq("playbook_id", filters.playbookId);
      if (filters?.userId) q = q.eq("assigned_user_id", filters.userId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function useRunSteps(runId: string | undefined) {
  return useQuery({
    queryKey: ["pb:run-steps", runId],
    enabled: !!runId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("playbook_run_steps")
        .select("*, playbook_steps(title,action_type,position)")
        .eq("run_id", runId!)
        .order("due_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function useStartPlaybookRun() {
  const qc = useQueryClient();
  const { current } = useWorkspace();
  return useMutation({
    mutationFn: async (v: { playbook_id: string; deal_id?: string | null; contact_id?: string | null; assigned_user_id?: string | null }) => {
      const { data, error } = await (supabase as any).rpc("start_playbook_run", {
        p_playbook_id: v.playbook_id,
        p_deal_id: v.deal_id ?? null,
        p_contact_id: v.contact_id ?? null,
        p_assigned_user_id: v.assigned_user_id ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pb:runs", current?.id] }),
  });
}

export function useUpdateRun() {
  const qc = useQueryClient();
  const { current } = useWorkspace();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<PlaybookRun> }) => {
      const { error } = await (supabase as any).from("playbook_runs").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pb:runs", current?.id] }),
  });
}

export function useUpdateRunStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch, runId }: { id: string; patch: Partial<PlaybookRunStep>; runId: string }) => {
      const { error } = await (supabase as any).from("playbook_run_steps").update(patch).eq("id", id);
      if (error) throw error;
      return runId;
    },
    onSuccess: (runId) => qc.invalidateQueries({ queryKey: ["pb:run-steps", runId] }),
  });
}

export const ACTION_TYPES: { value: string; label: string }[] = [
  { value: "call", label: "Ligação" },
  { value: "whatsapp_message", label: "WhatsApp (mensagem)" },
  { value: "whatsapp_template", label: "WhatsApp (template)" },
  { value: "email", label: "E-mail" },
  { value: "email_template", label: "E-mail (template)" },
  { value: "task", label: "Tarefa" },
  { value: "note", label: "Nota" },
  { value: "wait", label: "Esperar" },
  { value: "mark_won", label: "Marcar como ganho" },
  { value: "mark_lost", label: "Marcar como perdido" },
  { value: "custom", label: "Personalizado" },
];

export const CATEGORIES = ["geral", "inbound", "outbound", "pos_venda", "reativacao", "qualificacao"];
