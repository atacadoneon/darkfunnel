import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePlatformAdmin() {
  return useQuery({
    queryKey: ["is_platform_admin"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_platform_admin" as never);
      if (error) return false;
      return !!data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
