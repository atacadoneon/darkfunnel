import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";

export type PermissionCatalogRow = {
  slug: string;
  module: string;
  action: string;
  label: string;
  description: string | null;
  default_proprietario: string;
  default_gerente: string;
  default_vendedor: string;
  default_colaborador: string;
  sort_order: number;
};

export type UserPermissionRow = {
  workspace_id: string;
  user_id: string;
  permission_slug: string;
  allow: boolean;
  scope: "all" | "own" | "assigned" | "none";
};

const sb = supabase as any;

export function usePermissionCatalog() {
  return useQuery({
    queryKey: ["permission-catalog"],
    queryFn: async (): Promise<PermissionCatalogRow[]> => {
      const { data, error } = await sb
        .from("permission_catalog")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PermissionCatalogRow[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUserPermissions(userId: string | null | undefined) {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["user-permissions", current?.id, userId],
    enabled: !!current && !!userId,
    queryFn: async (): Promise<UserPermissionRow[]> => {
      const { data, error } = await sb
        .from("user_permissions")
        .select("*")
        .eq("workspace_id", current!.id)
        .eq("user_id", userId);
      if (error) throw error;
      return (data ?? []) as UserPermissionRow[];
    },
  });
}

export function useUpsertUserPermission() {
  const qc = useQueryClient();
  const { current } = useWorkspace();
  return useMutation({
    mutationFn: async (args: {
      userId: string;
      permissionSlug: string;
      scope: "all" | "own" | "assigned" | "none";
    }) => {
      if (!current) throw new Error("Workspace ausente");
      const { error } = await sb.rpc("upsert_user_permission", {
        p_workspace_id: current.id,
        p_user_id: args.userId,
        p_permission_id: args.permissionSlug,
        p_scope: args.scope,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["user-permissions", current?.id, vars.userId] });
      qc.invalidateQueries({ queryKey: ["my-permission"] });
    },
  });
}

export function useDeleteUserPermission() {
  const qc = useQueryClient();
  const { current } = useWorkspace();
  return useMutation({
    mutationFn: async (args: { userId: string; permissionSlug: string }) => {
      if (!current) throw new Error("Workspace ausente");
      const { error } = await sb.rpc("delete_user_permission", {
        p_workspace_id: current.id,
        p_user_id: args.userId,
        p_permission_id: args.permissionSlug,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["user-permissions", current?.id, vars.userId] });
      qc.invalidateQueries({ queryKey: ["my-permission"] });
    },
  });
}

export function useResetUserPermissions() {
  const qc = useQueryClient();
  const { current } = useWorkspace();
  return useMutation({
    mutationFn: async (userId: string) => {
      if (!current) throw new Error("Workspace ausente");
      const { error } = await sb.rpc("reset_user_permissions", {
        p_workspace_id: current.id,
        p_user_id: userId,
      });
      if (error) throw error;
    },
    onSuccess: (_d, userId) => {
      qc.invalidateQueries({ queryKey: ["user-permissions", current?.id, userId] });
      qc.invalidateQueries({ queryKey: ["my-permission"] });
    },
  });
}

export function usePermission(slug: string) {
  const { data } = useQuery({
    queryKey: ["my-permission", slug],
    queryFn: async () => {
      const { data, error } = await sb.rpc("has_permission", { p_permission: slug });
      if (error) throw error;
      return !!data;
    },
    staleTime: 60 * 1000,
  });
  return data ?? false;
}
