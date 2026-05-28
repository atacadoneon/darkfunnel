import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { toast } from "sonner";

export type InboundEndpoint = {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  description: string | null;
  default_pipeline_id: string | null;
  default_stage_id: string | null;
  default_tag_ids: string[] | null;
  default_owner_id: string | null;
  create_deal: boolean;
  upsert_strategy: string;
  mapping: any;
  active: boolean;
  total_received: number;
  total_success: number;
  total_failed: number;
  last_received_at: string | null;
  created_at: string;
};

export function useInboundEndpoints() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["inbound-endpoints", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<InboundEndpoint[]> => {
      const { data, error } = await supabase
        .from("inbound_webhook_endpoints" as any)
        .select("*")
        .eq("workspace_id", current!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any) as InboundEndpoint[];
    },
  });
}

export function useCreateInboundEndpoint() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      mapping: any;
      default_pipeline_id?: string | null;
      default_stage_id?: string | null;
      default_tag_ids?: string[];
      default_owner_id?: string | null;
      create_deal?: boolean;
      upsert_strategy?: string;
    }) => {
      if (!current) throw new Error("no ws");
      const { data, error } = await supabase.rpc("inbound_webhook_create_endpoint" as any, {
        p_workspace_id: current.id,
        p_name: input.name,
        p_mapping: input.mapping,
        p_default_pipeline_id: input.default_pipeline_id ?? null,
        p_default_stage_id: input.default_stage_id ?? null,
        p_default_tag_ids: input.default_tag_ids ?? [],
        p_default_owner_id: input.default_owner_id ?? null,
        p_create_deal: input.create_deal ?? false,
        p_upsert_strategy: input.upsert_strategy ?? "phone_email",
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inbound-endpoints"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateInboundEndpoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<InboundEndpoint> }) => {
      const { error } = await supabase.from("inbound_webhook_endpoints" as any).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inbound-endpoints"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRotateInboundSecret() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("inbound_webhook_rotate_secret" as any, { p_endpoint_id: id });
      if (error) throw error;
      return data;
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useTestMapping() {
  return useMutation({
    mutationFn: async (input: { mapping: any; sample: any }) => {
      const { data, error } = await supabase.rpc("inbound_webhook_test_mapping" as any, {
        p_mapping: input.mapping,
        p_sample_payload: input.sample,
      });
      if (error) throw error;
      return data;
    },
  });
}

export function useInboundLogs(endpointId: string | null) {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["inbound-logs", endpointId],
    enabled: !!endpointId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inbound_webhook_logs" as any)
        .select("id,status,raw_payload,mapped_data,contact_id,deal_id,error_message,duration_ms,ip_address,received_at")
        .eq("endpoint_id", endpointId!)
        .order("received_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  useEffect(() => {
    if (!current || !endpointId) return;
    const ch = supabase
      .channel(`inbound-logs:${endpointId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "inbound_webhook_logs", filter: `endpoint_id=eq.${endpointId}` },
        () => qc.invalidateQueries({ queryKey: ["inbound-logs", endpointId] }),
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [current, endpointId, qc]);

  return q;
}
