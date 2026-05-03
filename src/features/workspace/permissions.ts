import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "./WorkspaceProvider";
import { useAuth } from "@/features/auth/AuthProvider";

export type WorkspaceRole = "owner" | "admin" | "member";

export type WorkspaceMember = {
  user_id: string;
  role: WorkspaceRole;
  email?: string | null;
  display_name?: string | null;
};

export function useMyRole() {
  const { current } = useWorkspace();
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-ws-role", current?.id, user?.id],
    enabled: !!current && !!user,
    queryFn: async (): Promise<WorkspaceRole> => {
      const { data, error } = await supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", current!.id)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.role as WorkspaceRole) ?? "member";
    },
  });
}

export function useIsAdmin() {
  const { data: role } = useMyRole();
  return role === "owner" || role === "admin";
}

export function useWorkspaceMembers() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["ws-members", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<WorkspaceMember[]> => {
      const { data, error } = await supabase
        .from("workspace_members")
        .select("user_id, role")
        .eq("workspace_id", current!.id);
      if (error) throw error;
      return (data ?? []) as WorkspaceMember[];
    },
  });
}

export function useDealCollaborators(dealId: string | null | undefined) {
  const qc = useQueryClient();
  const { current } = useWorkspace();
  const q = useQuery({
    queryKey: ["deal-collabs", dealId],
    enabled: !!dealId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("deal_collaborators")
        .select("user_id")
        .eq("deal_id", dealId!);
      if (error) throw error;
      return (data ?? []).map((r: { user_id: string }) => r.user_id);
    },
  });

  useEffect(() => {
    if (!current || !dealId) return;
    const ch = supabase
      .channel(`dc:${dealId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deal_collaborators", filter: `deal_id=eq.${dealId}` },
        () => qc.invalidateQueries({ queryKey: ["deal-collabs", dealId] })
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [current, dealId, qc]);

  return q;
}
