import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useAuth } from "@/features/auth/AuthProvider";

export type ProposalStatus =
  | "rascunho"
  | "enviada"
  | "vista"
  | "aprovada"
  | "rejeitada";

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
      if (status === "enviada") patch.sent_at = now;
      if (status === "vista") patch.viewed_at = now;
      if (status === "aprovada") patch.approved_at = now;
      if (status === "rejeitada") patch.rejected_at = now;
      const { error } = await supabase
        .from("proposals")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, updateStatus };
}
