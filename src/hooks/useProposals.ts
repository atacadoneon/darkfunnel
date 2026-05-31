import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useAuth } from "@/features/auth/AuthProvider";

export type ProposalStatus =
  | "rascunho"
  | "em_aberto"
  | "aguardando"
  | "aprovada"
  | "nao_aprovada"
  | "concluida"
  | "cancelada"
  | "modelo";

export type Proposal = {
  id: string;
  workspace_id: string;
  number: number;
  series: string | null;
  status: ProposalStatus | string;
  customer_name: string | null;
  customer_email: string | null;
  customer_document: string | null;
  total_cents: number | null;
  subtotal_cents: number | null;
  discount_cents: number | null;
  contact_id: string | null;
  deal_id: string | null;
  owner_user_id: string | null;
  issue_date: string | null;
  next_contact_date: string | null;
  valid_until: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export function useProposals() {
  const { current } = useWorkspace();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["proposals", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<Proposal[]> => {
      const { data, error } = await supabase
        .from("proposals")
        .select("*")
        .eq("workspace_id", current!.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Proposal[];
    },
  });

  useEffect(() => {
    if (!current) return;
    const ch = supabase
      .channel(`proposals:${current.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "proposals",
          filter: `workspace_id=eq.${current.id}`,
        },
        () => qc.invalidateQueries({ queryKey: ["proposals", current.id] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [current, qc]);

  return q;
}

export function useProposalMutations() {
  const qc = useQueryClient();
  const { current } = useWorkspace();
  const { user } = useAuth();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["proposals", current?.id] });

  const create = useMutation({
    mutationFn: async (input?: Partial<Proposal>) => {
      if (!current || !user) throw new Error("sem workspace");
      const { data: maxRow } = await supabase
        .from("proposals")
        .select("number")
        .eq("workspace_id", current.id)
        .order("number", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextNumber = ((maxRow?.number as number | undefined) ?? 0) + 1;
      const payload: Record<string, unknown> = {
        workspace_id: current.id,
        created_by_user_id: user.id,
        owner_user_id: user.id,
        number: nextNumber,
        series: "P",
        status: "rascunho",
        customer_type: "pj",
        ...input,
      };
      const { data, error } = await supabase
        .from("proposals")
        .insert(payload)
        .select("*")
        .single();
      if (error) throw error;
      return data as Proposal;
    },
    onSuccess: invalidate,
  });

  const updateStatus = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: ProposalStatus;
    }) => {
      const patch: Record<string, unknown> = { status };
      const now = new Date().toISOString();
      if (status === "aprovada") patch.approved_at = now;
      if (status === "nao_aprovada") patch.rejected_at = now;
      const { error } = await supabase
        .from("proposals")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const bulkUpdate = useMutation({
    mutationFn: async ({
      ids,
      patch,
    }: {
      ids: string[];
      patch: Record<string, unknown>;
    }) => {
      if (!ids.length) return;
      const { error } = await supabase
        .from("proposals")
        .update(patch)
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const bulkSoftDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length) return;
      const { error } = await supabase
        .from("proposals")
        .update({ deleted_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, updateStatus, bulkUpdate, bulkSoftDelete };
}

// ----- Proposal tags -----
export type ProposalTag = {
  id: string;
  name: string;
  color: string | null;
  entity_types: string[] | null;
};

export function useTagsProposal() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["tags-proposal", current?.id],
    enabled: !!current,
    staleTime: 60_000,
    queryFn: async (): Promise<ProposalTag[]> => {
      const { data, error } = await supabase
        .from("tags")
        .select("id,name,color,entity_types")
        .eq("workspace_id", current!.id)
        .contains("entity_types", ["proposal"])
        .order("name");
      if (error) throw error;
      return (data ?? []) as ProposalTag[];
    },
  });
}

export function useProposalTagsFor(proposalIds: string[]) {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["proposal-tags-for", current?.id, [...proposalIds].sort().join(",")],
    enabled: !!current && proposalIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposal_tags" as any)
        .select("proposal_id,tag_id")
        .in("proposal_id", proposalIds);
      if (error) throw error;
      return (data ?? []) as { proposal_id: string; tag_id: string }[];
    },
  });
}

export function useProposalTagMutations() {
  const qc = useQueryClient();
  const { current } = useWorkspace();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["proposal-tags-for"] });
    qc.invalidateQueries({ queryKey: ["proposals", current?.id] });
  };

  const addTags = useMutation({
    mutationFn: async ({
      proposalIds,
      tagIds,
    }: {
      proposalIds: string[];
      tagIds: string[];
    }) => {
      if (!current) throw new Error("sem workspace");
      const rows: any[] = [];
      for (const pid of proposalIds) {
        for (const tid of tagIds) {
          rows.push({ proposal_id: pid, tag_id: tid, workspace_id: current.id });
        }
      }
      if (!rows.length) return;
      const { error } = await supabase
        .from("proposal_tags" as any)
        .upsert(rows, { onConflict: "proposal_id,tag_id" });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const removeTags = useMutation({
    mutationFn: async ({
      proposalIds,
      tagIds,
    }: {
      proposalIds: string[];
      tagIds: string[];
    }) => {
      if (!proposalIds.length || !tagIds.length) return;
      const { error } = await supabase
        .from("proposal_tags" as any)
        .delete()
        .in("proposal_id", proposalIds)
        .in("tag_id", tagIds);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { addTags, removeTags };
}
