import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { toast } from "sonner";

export type IntegrationConnection = {
  id: string;
  workspace_id: string;
  integration_slug: string;
  status: string;
  provider_version?: string | null;
  credentials_jsonb?: Record<string, any> | null;
  sync_config_jsonb?: Record<string, any> | null;
  auto_sync_enabled?: boolean | null;
  last_sync_at?: string | null;
};

export type SyncJob = {
  id: string;
  workspace_id: string;
  integration_slug: string;
  job_type: string;
  status: "pending" | "running" | "completed" | "failed" | string;
  total_items: number | null;
  processed_items: number | null;
  succeeded_items: number | null;
  failed_items: number | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  params_jsonb?: Record<string, any> | null;
};

export type SyncLog = {
  id: string;
  job_id: string;
  external_id: string | null;
  status: string;
  action: string | null;
  error_message: string | null;
  created_at: string;
};

export function useIntegrationConnection(slug: string) {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["integration-connection", current?.id, slug],
    enabled: !!current,
    queryFn: async (): Promise<IntegrationConnection | null> => {
      const { data, error } = await (supabase as any)
        .from("integration_connections")
        .select("*")
        .eq("workspace_id", current!.id)
        .eq("integration_slug", slug)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return (data as IntegrationConnection) ?? null;
    },
  });
}

export function useUpsertIntegrationConnection() {
  const qc = useQueryClient();
  const { current } = useWorkspace();
  return useMutation({
    mutationFn: async (input: Partial<IntegrationConnection> & { integration_slug: string }) => {
      if (!current) throw new Error("Sem workspace");
      const payload: any = {
        workspace_id: current.id,
        status: "active",
        ...input,
      };
      const { data, error } = await (supabase as any)
        .from("integration_connections")
        .upsert(payload, { onConflict: "workspace_id,integration_slug" })
        .select()
        .maybeSingle();
      if (error) throw error;
      return data as IntegrationConnection;
    },
    onSuccess: () => {
      toast.success("Configurações salvas");
      qc.invalidateQueries({ queryKey: ["integration-connection"] });
      qc.invalidateQueries({ queryKey: ["integration-connections"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateSyncJob() {
  return useMutation({
    mutationFn: async (input: { slug: string; job_type: string; params?: Record<string, any> }) => {
      const { data, error } = await (supabase as any).rpc("create_sync_job", {
        p_integration_slug: input.slug,
        p_job_type: input.job_type,
        p_params: input.params ?? {},
      });
      if (error) throw error;
      // RPC may return job id (uuid) or object
      return typeof data === "string" ? data : (data?.id ?? data?.job_id ?? data);
    },
  });
}

export function useTriggerTinyImport() {
  return useMutation({
    mutationFn: async (input: { job_id: string; entity: "products" | "contacts" }) => {
      const { data, error } = await supabase.functions.invoke("tiny-v2-import", {
        body: input,
      });
      if (error) throw error;
      return data;
    },
  });
}

export function useSyncJob(jobId: string | null) {
  return useQuery({
    queryKey: ["sync-job", jobId],
    enabled: !!jobId,
    refetchInterval: (q) => {
      const j = q.state.data as SyncJob | undefined;
      if (!j) return 3000;
      return j.status === "pending" || j.status === "running" ? 3000 : false;
    },
    queryFn: async (): Promise<SyncJob | null> => {
      const { data, error } = await (supabase as any)
        .from("integration_sync_jobs")
        .select("*")
        .eq("id", jobId)
        .maybeSingle();
      if (error) throw error;
      return (data as SyncJob) ?? null;
    },
  });
}

export function useSyncJobs(slug: string) {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["sync-jobs", current?.id, slug],
    enabled: !!current,
    queryFn: async (): Promise<SyncJob[]> => {
      const { data, error } = await (supabase as any)
        .from("integration_sync_jobs")
        .select("*")
        .eq("workspace_id", current!.id)
        .eq("integration_slug", slug)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as SyncJob[];
    },
  });
}

export function useSyncLogs(jobId: string | null) {
  return useQuery({
    queryKey: ["sync-logs", jobId],
    enabled: !!jobId,
    queryFn: async (): Promise<SyncLog[]> => {
      const { data, error } = await (supabase as any)
        .from("integration_sync_logs")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as SyncLog[];
    },
  });
}
