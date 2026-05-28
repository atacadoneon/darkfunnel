import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { toast } from "sonner";

export type McpTool = {
  slug: string;
  display_name: string;
  description: string | null;
  category: string;
  risk_level: "low" | "medium" | "high";
  is_destructive: boolean;
  default_enabled: boolean;
};

export type McpToolOverride = {
  workspace_id: string;
  tool_slug: string;
  enabled: boolean;
};

export type McpSettings = {
  workspace_id: string;
  server_enabled: boolean;
};

export function useMcpCatalog() {
  return useQuery({
    queryKey: ["mcp-catalog"],
    queryFn: async (): Promise<McpTool[]> => {
      const { data, error } = await supabase
        .from("mcp_tool_catalog" as any)
        .select("*")
        .order("category")
        .order("display_name");
      if (error) throw error;
      return (data ?? []) as any as McpTool[];
    },
  });
}

export function useMcpOverrides() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["mcp-overrides", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<McpToolOverride[]> => {
      const { data, error } = await supabase
        .from("workspace_mcp_tool_overrides" as any)
        .select("*")
        .eq("workspace_id", current!.id);
      if (error) throw error;
      return (data ?? []) as any as McpToolOverride[];
    },
  });
}

export function useMcpSettings() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["mcp-settings", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<McpSettings | null> => {
      const { data, error } = await supabase
        .from("workspace_mcp_settings" as any)
        .select("*")
        .eq("workspace_id", current!.id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as any as McpSettings | null;
    },
  });
  const set = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!current) throw new Error("no ws");
      const { error } = await supabase
        .from("workspace_mcp_settings" as any)
        .upsert(
          { workspace_id: current.id, server_enabled: enabled, updated_at: new Date().toISOString() },
          { onConflict: "workspace_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mcp-settings", current?.id] }),
    onError: (e: Error) => toast.error(e.message),
  });
  return { ...q, setEnabled: set };
}

export function useToggleMcpTool() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ slug, enabled }: { slug: string; enabled: boolean }) => {
      if (!current) throw new Error("no ws");
      const { error } = await supabase
        .from("workspace_mcp_tool_overrides" as any)
        .upsert(
          { workspace_id: current.id, tool_slug: slug, enabled, updated_at: new Date().toISOString() },
          { onConflict: "workspace_id,tool_slug" }
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mcp-overrides", current?.id] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useBulkToggleMcpTools() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ slugs, enabled }: { slugs: string[]; enabled: boolean }) => {
      if (!current) throw new Error("no ws");
      const rows = slugs.map((slug) => ({
        workspace_id: current.id,
        tool_slug: slug,
        enabled,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase
        .from("workspace_mcp_tool_overrides" as any)
        .upsert(rows, { onConflict: "workspace_id,tool_slug" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mcp-overrides", current?.id] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useMcpInvocations(limit = 50) {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["mcp-invocations", current?.id, limit],
    enabled: !!current,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mcp_tool_invocations" as any)
        .select("*")
        .eq("workspace_id", current!.id)
        .order("invoked_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}
