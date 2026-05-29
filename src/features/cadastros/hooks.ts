import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { toast } from "sonner";

// ============ Lists ============
export type ListRow = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  filter_query: unknown;
  is_dynamic: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ListWithCount = ListRow & { member_count: number };

export function useLists() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["cadastros:lists", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<ListWithCount[]> => {
      const { data, error } = await supabase
        .from("lists")
        .select("*, list_members(count)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        member_count: r.list_members?.[0]?.count ?? 0,
      })) as ListWithCount[];
    },
  });
}

export function useUpsertList() {
  const qc = useQueryClient();
  const { current } = useWorkspace();
  return useMutation({
    mutationFn: async (input: { id?: string; name: string; description?: string | null; is_dynamic: boolean }) => {
      if (!current) throw new Error("Workspace não selecionado");
      if (input.id) {
        const { error } = await supabase
          .from("lists")
          .update({
            name: input.name,
            description: input.description ?? null,
            is_dynamic: input.is_dynamic,
            updated_at: new Date().toISOString(),
          })
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { data: userRes } = await supabase.auth.getUser();
        const { error } = await supabase.from("lists").insert({
          workspace_id: current.id,
          name: input.name,
          description: input.description ?? null,
          is_dynamic: input.is_dynamic,
          created_by: userRes.user?.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Lista salva");
      qc.invalidateQueries({ queryKey: ["cadastros:lists"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("lists")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lista excluída");
      qc.invalidateQueries({ queryKey: ["cadastros:lists"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ============ List Members ============
export type ListMemberRow = {
  contact_id: string;
  added_at: string;
  contacts: { id: string; name: string | null; phone: string | null; email: string | null } | null;
};

export function useListMembers(listId: string | null) {
  return useQuery({
    queryKey: ["cadastros:list-members", listId],
    enabled: !!listId,
    queryFn: async (): Promise<ListMemberRow[]> => {
      const { data, error } = await supabase
        .from("list_members")
        .select("contact_id, added_at, contacts(id, name, phone, email)")
        .eq("list_id", listId!)
        .order("added_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ListMemberRow[];
    },
  });
}

export function useAddListMember() {
  const qc = useQueryClient();
  const { current } = useWorkspace();
  return useMutation({
    mutationFn: async ({ listId, contactId }: { listId: string; contactId: string }) => {
      if (!current) throw new Error("Workspace não selecionado");
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from("list_members").insert({
        list_id: listId,
        contact_id: contactId,
        workspace_id: current.id,
        added_by: userRes.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success("Contato adicionado");
      qc.invalidateQueries({ queryKey: ["cadastros:list-members", v.listId] });
      qc.invalidateQueries({ queryKey: ["cadastros:lists"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRemoveListMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ listId, contactId }: { listId: string; contactId: string }) => {
      const { error } = await supabase
        .from("list_members")
        .delete()
        .eq("list_id", listId)
        .eq("contact_id", contactId);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["cadastros:list-members", v.listId] });
      qc.invalidateQueries({ queryKey: ["cadastros:lists"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useContactsLite(search: string) {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["cadastros:contacts-lite", current?.id, search],
    enabled: !!current,
    queryFn: async () => {
      let q = supabase
        .from("contacts")
        .select("id, name, phone, email")
        .eq("workspace_id", current!.id)
        .order("name", { ascending: true })
        .limit(50);
      if (search.trim()) {
        q = q.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as { id: string; name: string | null; phone: string | null; email: string | null }[];
    },
  });
}

// ============ Loss Reasons (deal_lost_reasons) ============
export type LostReasonRow = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  color: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export function useLostReasons() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["cadastros:lost-reasons", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<LostReasonRow[]> => {
      const { data, error } = await supabase
        .from("deal_lost_reasons")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as LostReasonRow[];
    },
  });
}

export function useUpsertLostReason() {
  const qc = useQueryClient();
  const { current } = useWorkspace();
  return useMutation({
    mutationFn: async (input: { id?: string; name: string; description?: string | null; color: string; is_active: boolean; sort_order?: number }) => {
      if (!current) throw new Error("Workspace não selecionado");
      if (input.id) {
        const { error } = await supabase
          .from("deal_lost_reasons")
          .update({
            name: input.name,
            description: input.description ?? null,
            color: input.color,
            is_active: input.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { data: userRes } = await supabase.auth.getUser();
        const { error } = await supabase.from("deal_lost_reasons").insert({
          workspace_id: current.id,
          name: input.name,
          description: input.description ?? null,
          color: input.color,
          is_active: input.is_active,
          sort_order: input.sort_order ?? 0,
          created_by: userRes.user?.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Motivo salvo");
      qc.invalidateQueries({ queryKey: ["cadastros:lost-reasons"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateLostReasonOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: { id: string; sort_order: number }[]) => {
      await Promise.all(
        rows.map((r) =>
          supabase.from("deal_lost_reasons").update({ sort_order: r.sort_order }).eq("id", r.id),
        ),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cadastros:lost-reasons"] }),
  });
}

export function useDeleteLostReason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("deal_lost_reasons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Motivo excluído");
      qc.invalidateQueries({ queryKey: ["cadastros:lost-reasons"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export async function countDealsForLostReason(id: string): Promise<number> {
  const { count, error } = await supabase
    .from("deals")
    .select("id", { count: "exact", head: true })
    .eq("lost_reason_id", id);
  if (error) return 0;
  return count ?? 0;
}

// ============ Activity Types ============
export type ActivityTypeRow = {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  icon: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export function useActivityTypes() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["cadastros:activity-types", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<ActivityTypeRow[]> => {
      const { data, error } = await supabase
        .from("activity_types")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ActivityTypeRow[];
    },
  });
}

export function useUpsertActivityType() {
  const qc = useQueryClient();
  const { current } = useWorkspace();
  return useMutation({
    mutationFn: async (input: { id?: string; name: string; icon: string; color: string; is_active: boolean }) => {
      if (!current) throw new Error("Workspace não selecionado");
      if (input.id) {
        const { error } = await supabase
          .from("activity_types")
          .update({
            name: input.name,
            icon: input.icon,
            color: input.color,
            is_active: input.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { data: userRes } = await supabase.auth.getUser();
        const { error } = await supabase.from("activity_types").insert({
          workspace_id: current.id,
          name: input.name,
          icon: input.icon,
          color: input.color,
          is_active: input.is_active,
          created_by: userRes.user?.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Tipo salvo");
      qc.invalidateQueries({ queryKey: ["cadastros:activity-types"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteActivityType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("activity_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tipo excluído");
      qc.invalidateQueries({ queryKey: ["cadastros:activity-types"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ============ Tags (new schema) ============
export type TagRow = {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  color: string;
  kind: string | null;
  description: string | null;
  entity_types: string[];
  created_at: string;
  updated_at: string;
};

export type TagWithUsage = TagRow & { usage_count: number };

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

export function useCadastrosTags() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["cadastros:tags", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<TagWithUsage[]> => {
      const { data, error } = await supabase
        .from("tags")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as TagRow[];
      // count usage across 3 pivots
      const ids = rows.map((r) => r.id);
      if (ids.length === 0) return rows.map((r) => ({ ...r, usage_count: 0 }));
      const [c, l, d] = await Promise.all([
        supabase.from("contact_tags").select("tag_id").in("tag_id", ids),
        supabase.from("lead_tags").select("tag_id").in("tag_id", ids),
        supabase.from("deal_tags").select("tag_id").in("tag_id", ids),
      ]);
      const counts: Record<string, number> = {};
      for (const arr of [c.data, l.data, d.data]) {
        for (const r of (arr ?? []) as { tag_id: string }[]) {
          counts[r.tag_id] = (counts[r.tag_id] ?? 0) + 1;
        }
      }
      return rows.map((r) => ({ ...r, usage_count: counts[r.id] ?? 0 }));
    },
  });
}

export function useUpsertTag() {
  const qc = useQueryClient();
  const { current } = useWorkspace();
  return useMutation({
    mutationFn: async (input: { id?: string; name: string; color: string; entity_types: string[]; description?: string | null }) => {
      if (!current) throw new Error("Workspace não selecionado");
      const slug = slugify(input.name);
      if (input.id) {
        const { error } = await supabase
          .from("tags")
          .update({
            name: input.name,
            slug,
            color: input.color,
            entity_types: input.entity_types,
            description: input.description ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tags").insert({
          workspace_id: current.id,
          name: input.name,
          slug,
          color: input.color,
          entity_types: input.entity_types,
          description: input.description ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Tag salva");
      qc.invalidateQueries({ queryKey: ["cadastros:tags"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tags").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tag excluída");
      qc.invalidateQueries({ queryKey: ["cadastros:tags"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
