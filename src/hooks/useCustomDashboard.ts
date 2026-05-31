import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { toast } from "sonner";

export type WidgetCatalog = {
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  icon: string | null;
  default_w: number;
  default_h: number;
  min_w?: number | null;
  min_h?: number | null;
  is_active: boolean;
};

export type UserWidget = {
  id?: string;
  slug: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  config?: Record<string, any> | null;
};

export function useWidgetCatalog() {
  return useQuery({
    queryKey: ["dashboard_widget_catalog"],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<WidgetCatalog[]> => {
      const { data, error } = await supabase
        .from("dashboard_widget_catalog" as any)
        .select("*")
        .eq("is_active", true)
        .order("category")
        .order("name");
      if (error) throw error;
      return ((data as any[]) ?? []) as WidgetCatalog[];
    },
  });
}

export function useUserWidgets() {
  const { current } = useWorkspace();
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user_dashboard_widgets", current?.id, user?.id],
    enabled: !!current?.id && !!user?.id,
    queryFn: async (): Promise<UserWidget[]> => {
      const { data, error } = await supabase
        .from("user_dashboard_widgets" as any)
        .select("*")
        .eq("workspace_id", current!.id)
        .eq("user_id", user!.id)
        .order("position_y")
        .order("position_x");
      if (error) throw error;
      return ((data as any[]) ?? []) as UserWidget[];
    },
  });
}

export function useSaveLayout() {
  const qc = useQueryClient();
  const { current } = useWorkspace();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (widgets: UserWidget[]) => {
      const payload = widgets.map((w, i) => ({
        slug: w.slug,
        position_x: w.position_x,
        position_y: w.position_y ?? i,
        width: w.width,
        height: w.height,
        config: w.config ?? {},
      }));
      const { error } = await supabase.rpc("save_user_dashboard_layout" as any, { p_widgets: payload });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Layout salvo");
      qc.invalidateQueries({ queryKey: ["user_dashboard_widgets", current?.id, user?.id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar layout"),
  });
}

export function useResetLayout() {
  const qc = useQueryClient();
  const { current } = useWorkspace();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("user_dashboard_widgets" as any)
        .delete()
        .eq("workspace_id", current!.id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Layout resetado");
      qc.invalidateQueries({ queryKey: ["user_dashboard_widgets", current?.id, user?.id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao resetar"),
  });
}
