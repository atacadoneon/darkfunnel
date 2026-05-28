import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { toast } from "sonner";

export type McpToken = {
  id: string;
  workspace_id: string;
  name: string;
  prefix: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export function useMcpTokens() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["mcp-tokens", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<McpToken[]> => {
      const { data, error } = await supabase
        .from("mcp_api_tokens" as any)
        .select("*")
        .eq("workspace_id", current!.id)
        .is("revoked_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any as McpToken[];
    },
  });
}

export function useCreateMcpToken() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { name: string; scopes: string[]; expires_days?: number | null }): Promise<string> => {
      if (!current) throw new Error("no ws");
      const { data, error } = await supabase.rpc("mcp_create_token" as any, {
        p_workspace_id: current.id,
        p_name: v.name,
        p_scopes: v.scopes,
        p_expires_days: v.expires_days ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mcp-tokens", current?.id] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRevokeMcpToken() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("mcp_revoke_token" as any, { p_token_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Token revogado");
      qc.invalidateQueries({ queryKey: ["mcp-tokens", current?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
