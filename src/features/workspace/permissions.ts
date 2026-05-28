import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "./WorkspaceProvider";
import { useAuth } from "@/features/auth/AuthProvider";

export type WorkspaceRole = "colaborador" | "vendedor" | "gerente" | "proprietario" | "platform_admin";

const ADMIN_ROLES: WorkspaceRole[] = ["gerente", "proprietario", "platform_admin"];
const OWNER_ROLES: WorkspaceRole[] = ["proprietario", "platform_admin"];

export type WorkspaceMember = {
  user_id: string;
  role: WorkspaceRole;
  email?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
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
      return (data?.role as WorkspaceRole) ?? "vendedor";
    },
  });
}

export function useIsAdmin() {
  const { data: role } = useMyRole();
  return !!role && OWNER_ROLES.includes(role);
}

export function useIsManagerOrAdmin() {
  const { data: role } = useMyRole();
  return !!role && ADMIN_ROLES.includes(role);
}

/** true se o usuário só vê o que é dele (vendedor comum). */
export function useIsSeller() {
  const { data: role } = useMyRole();
  return role === "vendedor" || role === "colaborador";
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
      const rows = (data ?? []) as { user_id: string; role: WorkspaceRole }[];
      const ids = rows.map((r) => r.user_id);
      let profiles: Record<string, { display_name: string | null; email: string | null; avatar_url: string | null }> = {};
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,display_name,email,avatar_url")
          .in("id", ids);
        for (const p of profs ?? []) {
          profiles[p.id] = { display_name: p.display_name, email: p.email, avatar_url: p.avatar_url };
        }
      }
      return rows.map((r) => ({
        user_id: r.user_id,
        role: r.role,
        display_name: profiles[r.user_id]?.display_name ?? null,
        email: profiles[r.user_id]?.email ?? null,
        avatar_url: profiles[r.user_id]?.avatar_url ?? null,
      }));
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
