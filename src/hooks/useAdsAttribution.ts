import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";

export type AttributionRow = {
  source: string | null;
  campaign: string | null;
  medium: string | null;
  landing_page: string | null;
  gclid: string | null;
  fbclid: string | null;
  attributed_at: string;
  deal_id: string;
  deals: {
    title?: string | null;
    value_cents: number | null;
    status: string | null;
    won_at?: string | null;
    created_at?: string;
  } | null;
};

export function useAdsAttribution(periodStart: Date, periodEnd: Date, channel: "all" | "meta" | "google" = "all") {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["ads-attribution", current?.id, periodStart.toISOString(), periodEnd.toISOString(), channel],
    enabled: !!current,
    queryFn: async (): Promise<AttributionRow[]> => {
      let q = supabase
        .from("deal_ads_attribution" as any)
        .select("source,campaign,medium,landing_page,gclid,fbclid,attributed_at,deal_id,deals(title,value_cents,status,won_at,created_at)")
        .eq("workspace_id", current!.id)
        .gte("attributed_at", periodStart.toISOString())
        .lte("attributed_at", periodEnd.toISOString())
        .order("attributed_at", { ascending: false });
      if (channel === "meta") q = q.in("source", ["meta", "facebook", "instagram", "fb"]);
      if (channel === "google") q = q.in("source", ["google", "google_ads", "adwords"]);
      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as any) as AttributionRow[];
    },
  });
}
