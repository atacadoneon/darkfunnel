import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { toast } from "sonner";

export type LandingPage = {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  whatsapp_number: string | null;
  prefilled_message: string | null;
  source: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  clicks_count: number;
  conversations_count: number;
  conversions_count: number;
  revenue_cents: number;
  created_at: string;
  deleted_at?: string | null;
};

export function useLandingPages() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["landing-pages", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<LandingPage[]> => {
      const { data, error } = await supabase
        .from("landing_pages" as any)
        .select("*")
        .eq("workspace_id", current!.id)
        .is("deleted_at", null)
        .order("clicks_count", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any as LandingPage[];
    },
  });
}

export function useCreateLandingPage() {
  const { current } = useWorkspace();
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<LandingPage>) => {
      if (!current || !user) throw new Error("no ws");
      const { error } = await supabase.from("landing_pages" as any).insert({
        workspace_id: current.id,
        created_by_user_id: user.id,
        ...input,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Landing page criada");
      qc.invalidateQueries({ queryKey: ["landing-pages"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useLandingPageClicks(lpId: string | null) {
  return useQuery({
    queryKey: ["lp-clicks", lpId],
    enabled: !!lpId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_page_clicks" as any)
        .select("*")
        .eq("landing_page_id", lpId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}
