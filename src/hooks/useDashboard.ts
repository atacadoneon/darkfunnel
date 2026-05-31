import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import type { DashboardFilters } from "@/contexts/DashboardFiltersContext";

export type CommercialSummary = {
  workspace_id: string;
  leads_entrada_30d: number;
  leads_meio_funil_30d: number;
  vendas_30d: number;
  valor_vendas_cents_30d: number;
  conversas_30d?: number;
  mensagens_in_30d?: number;
  mensagens_out_30d?: number;
};

export type AdsRoi = {
  workspace_id: string;
  invested_cents_30d: number;
  propostas_30d: number;
  attributed_deals_30d: number;
  attributed_revenue_cents_30d: number;
};

export function useCommercialSummary(_filters: DashboardFilters) {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["dashboard_commercial_summary", current?.id],
    enabled: !!current?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<CommercialSummary | null> => {
      const { data, error } = await supabase
        .from("dashboard_commercial_summary" as any)
        .select("*")
        .eq("workspace_id", current!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as any) ?? null;
    },
  });
}

export function useAdsRoi(_filters: DashboardFilters) {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["dashboard_ads_roi", current?.id],
    enabled: !!current?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<AdsRoi | null> => {
      const { data, error } = await supabase
        .from("dashboard_ads_roi" as any)
        .select("*")
        .eq("workspace_id", current!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as any) ?? null;
    },
  });
}
