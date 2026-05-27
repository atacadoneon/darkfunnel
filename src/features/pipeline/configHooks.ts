import { useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { toast } from "sonner";

/* ---------------- Lead Origins ---------------- */
export type LeadOrigin = {
  id: string;
  workspace_id: string | null;
  name: string;
  slug: string;
  color: string;
  icon: string | null;
  is_system: boolean;
  active: boolean;
  position: number;
};

export function useLeadOrigins() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["lead-origins", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<LeadOrigin[]> => {
      const { data, error } = await supabase
        .from("lead_origins")
        .select("*")
        .or(`is_system.eq.true,workspace_id.eq.${current!.id}`)
        .order("is_system", { ascending: false })
        .order("position");
      if (error) throw error;
      return (data ?? []) as LeadOrigin[];
    },
  });
  useEffect(() => {
    if (!current) return;
    const ch = supabase
      .channel(`origins:${current.id}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_origins" },
        () => qc.invalidateQueries({ queryKey: ["lead-origins", current.id] }))
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [current, qc]);
  return q;
}

export function useCreateOrigin() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { name: string; color: string }) => {
      if (!current) throw new Error("no ws");
      const slug = v.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      const { error } = await supabase.from("lead_origins").insert({
        workspace_id: current.id, name: v.name, slug, color: v.color, is_system: false,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Canal criado"); qc.invalidateQueries({ queryKey: ["lead-origins", current?.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteOrigin() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lead_origins").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead-origins", current?.id] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ---------------- Lead Automations ---------------- */
export type LeadAutomations = {
  workspace_id: string;
  auto_loss_enabled: boolean;
  auto_loss_days: number;
  archive_lost_after_days: number;
  archive_won_after_days: number;
  archive_inactive_after_days: number;
};

export function useLeadAutomations() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["lead-automations", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<LeadAutomations | null> => {
      const { data, error } = await supabase.from("lead_automations").select("*")
        .eq("workspace_id", current!.id).maybeSingle();
      if (error) throw error;
      return data as LeadAutomations | null;
    },
  });
}

export function useSaveAutomations() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: Partial<LeadAutomations>) => {
      if (!current) throw new Error("no ws");
      const { error } = await supabase.from("lead_automations").upsert({
        workspace_id: current.id,
        auto_loss_enabled: v.auto_loss_enabled ?? false,
        auto_loss_days: v.auto_loss_days ?? 30,
        archive_lost_after_days: v.archive_lost_after_days ?? 30,
        archive_won_after_days: v.archive_won_after_days ?? 30,
        archive_inactive_after_days: v.archive_inactive_after_days ?? 30,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Automações salvas"); qc.invalidateQueries({ queryKey: ["lead-automations", current?.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ---------------- Lead Capture Webhooks ---------------- */
export type CaptureWebhook = {
  id: string;
  name: string;
  pipeline_id: string | null;
  stage_id: string | null;
  origin_id: string | null;
  default_assignee: string | null;
  token: string;
  active: boolean;
  field_mapping: Record<string, string>;
  auto_tags: string[];
  leads_count: number;
  last_lead_at: string | null;
  created_at: string;
};

export function useCaptureWebhooks() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["capture-webhooks", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<CaptureWebhook[]> => {
      const { data, error } = await supabase.from("lead_capture_webhooks").select("*")
        .eq("workspace_id", current!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CaptureWebhook[];
    },
  });
  useEffect(() => {
    if (!current) return;
    const ch = supabase.channel(`wh:${current.id}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_capture_webhooks", filter: `workspace_id=eq.${current.id}` },
        () => qc.invalidateQueries({ queryKey: ["capture-webhooks", current.id] }))
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [current, qc]);
  return q;
}

export function useUpsertWebhook() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: Partial<CaptureWebhook> & { name: string }) => {
      if (!current) throw new Error("no ws");
      const row = {
        workspace_id: current.id,
        name: v.name,
        pipeline_id: v.pipeline_id ?? null,
        stage_id: v.stage_id ?? null,
        origin_id: v.origin_id ?? null,
        default_assignee: v.default_assignee ?? null,
        active: v.active ?? true,
        field_mapping: v.field_mapping ?? {},
        auto_tags: v.auto_tags ?? [],
      };
      if (v.id) {
        const { error } = await supabase.from("lead_capture_webhooks").update(row).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("lead_capture_webhooks").insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Webhook salvo"); qc.invalidateQueries({ queryKey: ["capture-webhooks", current?.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteWebhook() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lead_capture_webhooks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["capture-webhooks", current?.id] }),
  });
}

/* ---------------- Stage CRUD ---------------- */
export function useCreateStage() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { name: string; type: "normal" | "won" | "lost"; pipeline_id?: string | null }) => {
      if (!current) throw new Error("no ws");
      const { data: maxRow } = await supabase.from("pipeline_stages").select("position")
        .eq("workspace_id", current.id).order("position", { ascending: false }).limit(1).maybeSingle();
      const pos = (maxRow?.position ?? 0) + 1;
      const { error } = await supabase.from("pipeline_stages").insert({
        workspace_id: current.id,
        pipeline_id: v.pipeline_id ?? null,
        name: v.name,
        position: pos,
        is_won: v.type === "won",
        is_lost: v.type === "lost",
        color: v.type === "won" ? "#22c55e" : v.type === "lost" ? "#ef4444" : "#6366f1",
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Etapa criada"); qc.invalidateQueries({ queryKey: ["pipeline_stages", current?.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateStage() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; name?: string; color?: string; default_objective?: string | null; auto_no_answer_message?: string | null }) => {
      const { id, ...patch } = v;
      const { error } = await supabase.from("pipeline_stages").update(patch as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline_stages", current?.id] }),
  });
}

export function useDeleteStage() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pipeline_stages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Etapa removida"); qc.invalidateQueries({ queryKey: ["pipeline_stages", current?.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });
}
