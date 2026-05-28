import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { toast } from "sonner";

export type TrackingConfig = {
  id?: string;
  workspace_id: string;
  meta_pixel_id?: string | null;
  meta_status?: string | null;
  google_customer_id?: string | null;
  google_status?: string | null;
  lp_send_lead_to_meta?: boolean | null;
  lp_send_lead_to_google?: boolean | null;
};

export function useTrackingConfig() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["tracking-config", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<TrackingConfig | null> => {
      const { data, error } = await supabase
        .from("tracking_configs" as any)
        .select("*")
        .eq("workspace_id", current!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as any) ?? null;
    },
  });
}

export function useUpsertTrackingConfig() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<TrackingConfig>) => {
      if (!current) throw new Error("no ws");
      const { error } = await supabase
        .from("tracking_configs" as any)
        .upsert({ workspace_id: current.id, ...patch, updated_at: new Date().toISOString() }, { onConflict: "workspace_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configurações salvas");
      qc.invalidateQueries({ queryKey: ["tracking-config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
