import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";

export type IdentityKind = "whatsapp" | "instagram" | "email";

export type ContactIdentity = {
  id: string;
  workspace_id: string;
  contact_id: string;
  kind: IdentityKind;
  value: string;
  is_primary: boolean;
  created_at: string;
};

export type Contact = {
  id: string;
  workspace_id: string;
  display_name: string | null;
  phone_e164: string | null;
  profile_pic_url: string | null;
  created_at: string;
  archived_at?: string | null;
  identities?: ContactIdentity[];
};

export function useContacts(search: string = "", includeArchived: boolean = false) {
  const { current } = useWorkspace();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["contacts", current?.id, search, includeArchived],
    enabled: !!current,
    queryFn: async (): Promise<Contact[]> => {
      let query = supabase
        .from("contacts")
        .select(
          "id,workspace_id,display_name,phone_e164,profile_pic_url,created_at,archived_at,identities:contact_identities(id,workspace_id,contact_id,kind,value,is_primary,created_at)"
        )
        .order("created_at", { ascending: false })
        .limit(500);
      if (!includeArchived) query = query.is("archived_at", null);
      if (search.trim()) {
        const s = `%${search.trim()}%`;
        query = query.or(`display_name.ilike.${s},phone_e164.ilike.${s}`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as Contact[];
    },
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!current) return;
    const ch = supabase
      .channel(`contacts:${current.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contacts", filter: `workspace_id=eq.${current.id}` },
        () => qc.invalidateQueries({ queryKey: ["contacts", current.id] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contact_identities", filter: `workspace_id=eq.${current.id}` },
        () => qc.invalidateQueries({ queryKey: ["contacts", current.id] })
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [current, qc]);

  return q;
}

export const IDENTITY_LABELS: Record<IdentityKind, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  email: "E-mail",
};
