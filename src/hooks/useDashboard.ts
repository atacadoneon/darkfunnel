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

/* ---------- SLA / Atendimento ---------- */
export type SlaBySeller = {
  workspace_id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  conversas: number;
  resolvidas: number;
  avg_response_minutes: number | null;
  pendentes_24h: number;
};

export function useSlaBySeller(_filters: DashboardFilters) {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["dashboard_sla_by_seller", current?.id],
    enabled: !!current?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<SlaBySeller[]> => {
      const { data, error } = await supabase
        .from("dashboard_sla_by_seller" as any)
        .select("*")
        .eq("workspace_id", current!.id);
      if (error) throw error;
      return ((data as any[]) ?? []) as SlaBySeller[];
    },
  });
}

/* ---------- Ads by Campaign ---------- */
export type AdsByCampaign = {
  workspace_id: string;
  campaign: string | null;
  source: string | null;
  medium: string | null;
  attributions: number;
  deals_count: number;
  total_revenue_cents: number;
  invested_cents: number;
  messages_count: number;
};

export function useAdsByCampaign(_filters: DashboardFilters) {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["dashboard_ads_by_campaign", current?.id],
    enabled: !!current?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<AdsByCampaign[]> => {
      const { data, error } = await supabase
        .from("dashboard_ads_by_campaign" as any)
        .select("*")
        .eq("workspace_id", current!.id)
        .order("total_revenue_cents", { ascending: false })
        .limit(10);
      if (error) throw error;
      return ((data as any[]) ?? []) as AdsByCampaign[];
    },
  });
}

/* ---------- Funnel by Stage ---------- */
export type FunnelByStage = {
  workspace_id: string;
  pipeline_id: string;
  stage_id: string;
  stage_name: string;
  color: string | null;
  sort_order: number;
  count: number;
  total_value_cents: number;
  avg_days_in_stage?: number | null;
};

export function useFunnelByStage(_filters: DashboardFilters) {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["dashboard_funnel_by_stage", current?.id],
    enabled: !!current?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<FunnelByStage[]> => {
      const { data, error } = await supabase
        .from("dashboard_funnel_by_stage" as any)
        .select("*")
        .eq("workspace_id", current!.id)
        .order("sort_order");
      if (error) throw error;
      return ((data as any[]) ?? []) as FunnelByStage[];
    },
  });
}

/* ---------- Stuck deals (open, no movement >14d) ---------- */
export function useStuckDeals() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["dashboard_stuck_deals", current?.id],
    enabled: !!current?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const cutoff = new Date(Date.now() - 14 * 86400_000).toISOString();
      const { data, error } = await supabase
        .from("deals")
        .select("id,title,value_cents,updated_at,stage_id,pipeline_id,contact_id,assigned_to")
        .eq("workspace_id", current!.id)
        .eq("status", "open")
        .is("deleted_at", null)
        .lt("updated_at", cutoff)
        .order("updated_at", { ascending: true })
        .limit(20);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });
}

/* ---------- Conversations volume by day (14d) ---------- */
export function useConvVolume14d() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["dashboard_conv_volume_14d", current?.id],
    enabled: !!current?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 14 * 86400_000).toISOString();
      const { data, error } = await supabase
        .from("conversations")
        .select("created_at")
        .eq("workspace_id", current!.id)
        .gte("created_at", since)
        .limit(20000);
      if (error) throw error;
      const map = new Map<string, number>();
      for (let i = 13; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400_000);
        const k = d.toISOString().slice(0, 10);
        map.set(k, 0);
      }
      for (const r of (data as any[]) ?? []) {
        const k = (r.created_at as string).slice(0, 10);
        if (map.has(k)) map.set(k, (map.get(k) ?? 0) + 1);
      }
      return Array.from(map.entries()).map(([day, count]) => ({ day: day.slice(5), count }));
    },
  });
}

/* ---------- Goals progress ---------- */
export type GoalProgress = {
  workspace_id: string;
  goal_id: string;
  name: string;
  scope: "workspace" | "department" | "user" | string;
  scope_label: string | null;
  target_cents: number;
  current_cents: number;
  progress_pct: number;
  period_start: string;
  period_end: string;
  days_remaining: number;
  period_elapsed_pct: number;
  user_id?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
};

export function useGoalsProgress(_filters: DashboardFilters) {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["dashboard_goals_progress", current?.id],
    enabled: !!current?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<GoalProgress[]> => {
      const { data, error } = await supabase
        .from("dashboard_goals_progress" as any)
        .select("*")
        .eq("workspace_id", current!.id);
      if (error) throw error;
      return ((data as any[]) ?? []) as GoalProgress[];
    },
  });
}


/* ---------- Leads daily 30d ---------- */
export type LeadsDaily = { workspace_id: string; day: string; leads_count: number };
export function useLeadsDaily30d(_filters: DashboardFilters) {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["dashboard_leads_daily_30d", current?.id],
    enabled: !!current?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<LeadsDaily[]> => {
      const { data, error } = await supabase
        .from("dashboard_leads_daily_30d" as any)
        .select("*")
        .eq("workspace_id", current!.id)
        .order("day");
      if (error) throw error;
      return ((data as any[]) ?? []) as LeadsDaily[];
    },
  });
}

/* ---------- Chats accumulated 7d ---------- */
export type ChatsAccumulated = { workspace_id: string; day: string; accumulated_count: number };
export function useChatsAccumulated7d(_filters: DashboardFilters) {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["dashboard_chats_accumulated_7d", current?.id],
    enabled: !!current?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<ChatsAccumulated[]> => {
      const { data, error } = await supabase
        .from("dashboard_chats_accumulated_7d" as any)
        .select("*")
        .eq("workspace_id", current!.id)
        .order("day");
      if (error) throw error;
      return ((data as any[]) ?? []) as ChatsAccumulated[];
    },
  });
}

/* ---------- Messages daily 7d ---------- */
export type MessagesDaily = { workspace_id: string; day: string; sent_count: number; received_count: number };
export function useMessagesDaily7d(_filters: DashboardFilters) {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["dashboard_messages_daily_7d", current?.id],
    enabled: !!current?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<MessagesDaily[]> => {
      const { data, error } = await supabase
        .from("dashboard_messages_daily_7d" as any)
        .select("*")
        .eq("workspace_id", current!.id)
        .order("day");
      if (error) throw error;
      return ((data as any[]) ?? []) as MessagesDaily[];
    },
  });
}

/* ---------- Service time 7d ---------- */
export type ServiceTime = {
  workspace_id: string;
  day: string;
  open_avg_minutes: number | null;
  in_progress_avg_hours: number | null;
  waiting_avg_hours: number | null;
  resolved_avg_days: number | null;
};
export function useServiceTime7d(_filters: DashboardFilters) {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["dashboard_service_time_7d", current?.id],
    enabled: !!current?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<ServiceTime[]> => {
      const { data, error } = await supabase
        .from("dashboard_service_time_7d" as any)
        .select("*")
        .eq("workspace_id", current!.id)
        .order("day");
      if (error) throw error;
      return ((data as any[]) ?? []) as ServiceTime[];
    },
  });
}
