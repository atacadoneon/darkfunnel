import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TriggerDef = {
  slug: string;
  category: string;
  category_slug: string;
  display_name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  config_schema: any;
  is_active: boolean;
};

export function useTriggerCatalog() {
  return useQuery({
    queryKey: ["flow_trigger_catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flow_trigger_catalog")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TriggerDef[];
    },
    staleTime: 5 * 60_000,
  });
}
