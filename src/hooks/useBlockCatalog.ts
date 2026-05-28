import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BlockDef = {
  slug: string;
  display_name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  config_schema: any;
};

export function useBlockCatalog() {
  return useQuery({
    queryKey: ["flow_block_catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flow_block_catalog")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BlockDef[];
    },
    staleTime: 5 * 60_000,
  });
}
