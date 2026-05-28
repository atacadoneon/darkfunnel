import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useAuth } from "@/features/auth/AuthProvider";

export type Flow = {
  id: string;
  workspace_id: string;
  group_id: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
  is_template: boolean;
  template_slug: string | null;
  trigger_type: string | null;
  trigger_config: any;
  viewport: { x: number; y: number; zoom: number } | null;
  total_runs: number;
  total_success: number;
  total_warnings: number;
  total_errors: number;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
};

export function useFlows() {
  const { current } = useWorkspace();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["flows", current?.id],
    enabled: !!current,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flows")
        .select("*")
        .eq("workspace_id", current!.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Flow[];
    },
  });

  useEffect(() => {
    if (!current) return;
    const ch = supabase
      .channel(`flows:${current.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "flows", filter: `workspace_id=eq.${current.id}` },
        () => qc.invalidateQueries({ queryKey: ["flows", current.id] }),
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [current, qc]);

  return q;
}

export function useFlow(flowId: string | undefined) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["flow", flowId],
    enabled: !!flowId,
    queryFn: async () => {
      const { data, error } = await supabase.from("flows").select("*").eq("id", flowId!).maybeSingle();
      if (error) throw error;
      return data as Flow | null;
    },
  });

  useEffect(() => {
    if (!flowId) return;
    const ch = supabase
      .channel(`flow:${flowId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "flows", filter: `id=eq.${flowId}` },
        () => qc.invalidateQueries({ queryKey: ["flow", flowId] }),
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [flowId, qc]);

  return q;
}

export function useFlowMutations() {
  const qc = useQueryClient();
  const { current } = useWorkspace();
  const { user } = useAuth();

  const create = useMutation({
    mutationFn: async (input: { name: string; description?: string; group_id?: string | null; template_slug?: string | null; flow_json?: any }) => {
      if (!current || !user) throw new Error("sem workspace");
      const { data: flow, error } = await supabase
        .from("flows")
        .insert({
          workspace_id: current.id,
          group_id: input.group_id ?? null,
          name: input.name,
          description: input.description ?? null,
          is_active: false,
          template_slug: input.template_slug ?? null,
          trigger_type: input.flow_json?.trigger?.type ?? null,
          trigger_config: input.flow_json?.trigger?.config ?? {},
          viewport: { x: 0, y: 0, zoom: 1 },
          created_by: user.id,
        })
        .select("*")
        .single();
      if (error) throw error;

      if (input.flow_json?.nodes?.length) {
        const nodeRows = input.flow_json.nodes.map((n: any) => ({
          workspace_id: current.id,
          flow_id: flow.id,
          node_id: n.node_id ?? n.id,
          node_type: n.node_type ?? n.type,
          position_x: n.position_x ?? n.position?.x ?? 0,
          position_y: n.position_y ?? n.position?.y ?? 0,
          config: n.config ?? {},
        }));
        const { error: ne } = await supabase.from("flow_nodes").insert(nodeRows);
        if (ne) throw ne;
      } else {
        await supabase.from("flow_nodes").insert({
          workspace_id: current.id,
          flow_id: flow.id,
          node_id: "start",
          node_type: "start",
          position_x: 100,
          position_y: 200,
          config: {},
        });
      }

      if (input.flow_json?.edges?.length) {
        const edgeRows = input.flow_json.edges.map((e: any) => ({
          workspace_id: current.id,
          flow_id: flow.id,
          edge_id: e.edge_id ?? e.id,
          source_node_id: e.source_node_id ?? e.source,
          source_handle: e.source_handle ?? null,
          target_node_id: e.target_node_id ?? e.target,
          target_handle: e.target_handle ?? null,
          config: e.config ?? {},
        }));
        await supabase.from("flow_edges").insert(edgeRows);
      }
      return flow as Flow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["flows", current?.id] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Flow> }) => {
      const { error } = await supabase.from("flows").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["flows", current?.id] });
      qc.invalidateQueries({ queryKey: ["flow", v.id] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("flows").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["flows", current?.id] }),
  });

  return { create, update, remove };
}

export function useAutomationGroups() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["automation_groups", current?.id],
    enabled: !!current,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_groups")
        .select("*")
        .eq("workspace_id", current!.id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async (name: string) => {
      if (!current) throw new Error("sem workspace");
      const { data, error } = await supabase
        .from("automation_groups")
        .insert({ workspace_id: current.id, name, sort_order: (q.data?.length ?? 0) })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation_groups", current?.id] }),
  });

  return { ...q, create };
}
