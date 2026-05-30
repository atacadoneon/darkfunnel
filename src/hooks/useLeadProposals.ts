import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";

export type LeadPurchase = {
  id: string;
  deal_id: string;
  product_name: string;
  description: string | null;
  value_cents: number;
  purchased_at: string;
  source_proposal_id: string | null;
};

export type LeadProposal = {
  id: string;
  number: number | null;
  series: string | null;
  status: string;
  customer_name: string | null;
  total_cents: number | null;
  created_at: string;
};

export function useLeadPurchases(leadId: string | null | undefined) {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["lead-purchases", current?.id, leadId],
    enabled: !!current && !!leadId,
    queryFn: async (): Promise<LeadPurchase[]> => {
      const { data: deals, error: de } = await supabase
        .from("deals").select("id").eq("contact_id", leadId!);
      if (de) throw de;
      const ids = (deals ?? []).map((d) => d.id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("deal_purchases")
        .select("id,deal_id,product_name,description,value_cents,purchased_at,source_proposal_id")
        .in("deal_id", ids)
        .order("purchased_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LeadPurchase[];
    },
  });
}

export function useLeadProposals(leadId: string | null | undefined) {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["lead-proposals", current?.id, leadId],
    enabled: !!current && !!leadId,
    queryFn: async (): Promise<LeadProposal[]> => {
      const { data, error } = await supabase
        .from("proposals")
        .select("id,number,series,status,customer_name,total_cents,created_at")
        .eq("contact_id", leadId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LeadProposal[];
    },
  });
}

export function useQuickProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      leadId: string;
      productName: string;
      totalCents: number;
      dealId?: string | null;
    }) => {
      const { data, error } = await supabase.rpc("create_quick_proposal", {
        p_lead_id: v.leadId,
        p_product_name: v.productName,
        p_total_amount_cents: v.totalCents,
        p_deal_id: v.dealId ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["lead-proposals"] });
      qc.invalidateQueries({ queryKey: ["lead-purchases"] });
      qc.invalidateQueries({ queryKey: ["proposals"] });
    },
  });
}
