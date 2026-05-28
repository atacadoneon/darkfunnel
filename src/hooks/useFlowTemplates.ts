import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FlowTemplate = {
  slug: string;
  name: string;
  description: string | null;
  group_name: string | null;
  icon: string | null;
  flow_json: any;
};

export function useFlowTemplates() {
  return useQuery({
    queryKey: ["flow_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flow_templates")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FlowTemplate[];
    },
    staleTime: 5 * 60_000,
  });
}
