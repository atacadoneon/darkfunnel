import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ClvStat = {
  contact_id: string;
  total_revenue_cents: number;
  purchases_count: number;
  avg_purchase_cycle_days: number;
  days_since_last_purchase: number | null;
  last_purchase_at: string | null;
};

export function useClvStats(contactIds: string[]) {
  const key = [...contactIds].sort().join(",");
  return useQuery({
    queryKey: ["clv-stats", key],
    enabled: contactIds.length > 0,
    queryFn: async (): Promise<Record<string, ClvStat>> => {
      const { data, error } = await supabase
        .from("contact_clv_stats" as any)
        .select("*")
        .in("contact_id", contactIds);
      if (error) throw error;
      const out: Record<string, ClvStat> = {};
      for (const r of (data ?? []) as any[]) out[r.contact_id] = r as ClvStat;
      return out;
    },
  });
}
