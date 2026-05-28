import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { nanoid } from "nanoid";

export type FlowNode = {
  id: string;
  workspace_id: string;
  flow_id: string;
  node_id: string;
  node_type: "start" | "message" | "action" | "condition" | "wait" | "random" | "api" | "fields" | "ai" | "javascript";
  position_x: number;
  position_y: number;
  config: any;
  success_count: number;
  warning_count: number;
  error_count: number;
  last_run_at: string | null;
};

export type FlowEdge = {
  id: string;
  workspace_id: string;
  flow_id: string;
  edge_id: string;
  source_node_id: string;
  source_handle: string | null;
  target_node_id: string;
  target_handle: string | null;
  config: any;
};

export function useFlowNodes(flowId: string | undefined) {
  const qc = useQueryClient();

  const nodesQ = useQuery({
    queryKey: ["flow_nodes", flowId],
    enabled: !!flowId,
    queryFn: async () => {
      const { data, error } = await supabase.from("flow_nodes").select("*").eq("flow_id", flowId!);
      if (error) throw error;
      return (data ?? []) as FlowNode[];
    },
  });

  const edgesQ = useQuery({
    queryKey: ["flow_edges", flowId],
    enabled: !!flowId,
    queryFn: async () => {
      const { data, error } = await supabase.from("flow_edges").select("*").eq("flow_id", flowId!);
      if (error) throw error;
      return (data ?? []) as FlowEdge[];
    },
  });

  useEffect(() => {
    if (!flowId) return;
    const suf = Math.random().toString(36).slice(2, 8);
    const chN = supabase.channel(`flow_nodes:${flowId}:${suf}`);
    chN.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "flow_nodes", filter: `flow_id=eq.${flowId}` },
      () => qc.invalidateQueries({ queryKey: ["flow_nodes", flowId] }),
    ).subscribe();
    const chE = supabase.channel(`flow_edges:${flowId}:${suf}`);
    chE.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "flow_edges", filter: `flow_id=eq.${flowId}` },
      () => qc.invalidateQueries({ queryKey: ["flow_edges", flowId] }),
    ).subscribe();
    return () => {
      void supabase.removeChannel(chN);
      void supabase.removeChannel(chE);
    };
  }, [flowId, qc]);


  return { nodes: nodesQ.data ?? [], edges: edgesQ.data ?? [], isLoading: nodesQ.isLoading || edgesQ.isLoading };
}

export function useFlowNodeMutations(flowId: string | undefined) {
  const qc = useQueryClient();
  const { current } = useWorkspace();
  const invN = () => qc.invalidateQueries({ queryKey: ["flow_nodes", flowId] });
  const invE = () => qc.invalidateQueries({ queryKey: ["flow_edges", flowId] });

  const createNode = useMutation({
    mutationFn: async (input: { node_type: FlowNode["node_type"]; position_x: number; position_y: number; config?: any }) => {
      if (!current || !flowId) throw new Error("sem flow");
      const { data, error } = await supabase
        .from("flow_nodes")
        .insert({
          workspace_id: current.id,
          flow_id: flowId,
          node_id: nanoid(10),
          node_type: input.node_type,
          position_x: input.position_x,
          position_y: input.position_y,
          config: input.config ?? {},
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as FlowNode;
    },
    onSuccess: invN,
  });

  const updateNode = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<FlowNode> }) => {
      const { error } = await supabase.from("flow_nodes").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invN,
  });

  const deleteNode = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("flow_nodes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invN(); invE(); },
  });

  const createEdge = useMutation({
    mutationFn: async (input: { source_node_id: string; target_node_id: string; source_handle?: string | null; target_handle?: string | null }) => {
      if (!current || !flowId) throw new Error("sem flow");
      const { data, error } = await supabase
        .from("flow_edges")
        .insert({
          workspace_id: current.id,
          flow_id: flowId,
          edge_id: nanoid(10),
          source_node_id: input.source_node_id,
          source_handle: input.source_handle ?? null,
          target_node_id: input.target_node_id,
          target_handle: input.target_handle ?? null,
          config: {},
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as FlowEdge;
    },
    onSuccess: invE,
  });

  const deleteEdge = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("flow_edges").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invE,
  });

  return { createNode, updateNode, deleteNode, createEdge, deleteEdge };
}
