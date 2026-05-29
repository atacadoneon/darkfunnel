import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { toast } from "sonner";

/* ============================================================
 * PROFILE (Meu Perfil)
 * ============================================================ */
export type MyProfile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
  client_visible_name: string | null;
};

export function useMyProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<MyProfile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,display_name,avatar_url,email,client_visible_name")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as MyProfile) ?? null;
    },
  });
}

export function useUpdateMyProfile() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { display_name?: string | null; avatar_url?: string | null; client_visible_name?: string | null }) => {
      if (!user) throw new Error("Sem sessão");
      const { error } = await supabase.from("profiles").update(input).eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perfil atualizado");
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      qc.invalidateQueries({ queryKey: ["ws-members"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateUserMetadata() {
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const { error } = await supabase.auth.updateUser({ data });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Preferências salvas"),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdatePassword() {
  return useMutation({
    mutationFn: async (password: string) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Senha alterada"),
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ============================================================
 * WORKSPACE (Empresa)
 * ============================================================ */
export type WorkspaceDetails = {
  id: string;
  name: string;
  slug: string;
  niche: string | null;
  business_email: string | null;
  business_phone_e164: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  country: string | null;
  timezone: string | null;
  brand_logo_url: string | null;
  brand_primary_color: string | null;
  plan: string | null;
};

export function useWorkspaceDetails() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["ws-details", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<WorkspaceDetails | null> => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("id,name,slug,niche,business_email,business_phone_e164,address_street,address_number,address_complement,address_neighborhood,address_city,address_state,address_zip,country,timezone,brand_logo_url,brand_primary_color,plan")
        .eq("id", current!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as WorkspaceDetails) ?? null;
    },
  });
}

export function useUpdateWorkspace() {
  const qc = useQueryClient();
  const { current } = useWorkspace();
  return useMutation({
    mutationFn: async (patch: Partial<WorkspaceDetails>) => {
      if (!current) throw new Error("Sem workspace");
      const { error } = await supabase.from("workspaces").update(patch).eq("id", current.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Empresa atualizada");
      qc.invalidateQueries({ queryKey: ["ws-details"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ============================================================
 * PLANOS / USO
 * ============================================================ */
export type SubscriptionPlan = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  features: string[] | null;
  limits: Record<string, unknown> | null;
  price_monthly_cents: number;
  price_semestral_cents: number | null;
  price_annual_cents: number | null;
  currency: string;
  is_recommended: boolean;
  sort_order: number;
};

export function usePlans() {
  return useQuery({
    queryKey: ["subscription-plans"],
    queryFn: async (): Promise<SubscriptionPlan[]> => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as SubscriptionPlan[];
    },
  });
}

export function useCurrentSubscription() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["ws-subscription", current?.id],
    enabled: !!current,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_subscriptions")
        .select("*")
        .eq("workspace_id", current!.id)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return data ?? null;
    },
  });
}

export type UsageDaily = {
  day: string;
  messages_sent?: number | null;
  calls_made?: number | null;
  automations_run?: number | null;
  mcp_invocations?: number | null;
  storage_bytes?: number | null;
};

export function useUsageDaily() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["ws-usage-daily", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<UsageDaily[]> => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data, error } = await supabase
        .from("workspace_usage_daily")
        .select("*")
        .eq("workspace_id", current!.id)
        .gte("day", since.toISOString().slice(0, 10))
        .order("day");
      if (error && error.code !== "PGRST116") throw error;
      return (data ?? []) as UsageDaily[];
    },
  });
}

/* ============================================================
 * DEPARTAMENTOS
 * ============================================================ */
export type Department = {
  id: string;
  workspace_id: string;
  name: string;
  color: string | null;
  description: string | null;
  sort_order: number;
  created_at: string;
};

export function useDepartments() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["departments", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<Department[]> => {
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .eq("workspace_id", current!.id)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Department[];
    },
  });
}

export function useUpsertDepartment() {
  const qc = useQueryClient();
  const { current } = useWorkspace();
  return useMutation({
    mutationFn: async (input: { id?: string; name: string; color?: string | null; description?: string | null; sort_order?: number }) => {
      if (!current) throw new Error("Sem workspace");
      const payload = { ...input, workspace_id: current.id };
      const { error } = input.id
        ? await supabase.from("departments").update(payload).eq("id", input.id)
        : await supabase.from("departments").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Departamento salvo");
      qc.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("departments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Departamento removido");
      qc.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ============================================================
 * BUSINESS HOURS
 * ============================================================ */
export type BusinessHour = {
  id: string;
  workspace_id: string;
  day_of_week: number; // 0 = domingo .. 6 = sábado
  opens_at: string; // "HH:mm:ss"
  closes_at: string;
  is_closed: boolean;
};

export function useBusinessHours() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["business-hours", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<BusinessHour[]> => {
      const { data, error } = await supabase
        .from("business_hours")
        .select("*")
        .eq("workspace_id", current!.id)
        .order("day_of_week");
      if (error) throw error;
      return (data ?? []) as BusinessHour[];
    },
  });
}

export function useUpsertBusinessHours() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: Array<Pick<BusinessHour, "id" | "opens_at" | "closes_at" | "is_closed">>) => {
      for (const r of rows) {
        const { error } = await supabase
          .from("business_hours")
          .update({ opens_at: r.opens_at, closes_at: r.closes_at, is_closed: r.is_closed })
          .eq("id", r.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Horários salvos");
      qc.invalidateQueries({ queryKey: ["business-hours"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ============================================================
 * INTEGRAÇÕES
 * ============================================================ */
export type IntegrationCatalogItem = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string | null;
  icon_url: string | null;
  credentials_schema_jsonb: Record<string, unknown> | null;
  sort_order: number;
};

export type IntegrationConnection = {
  id: string;
  workspace_id: string;
  integration_id: string;
  status: string;
  credentials_jsonb?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

export function useIntegrationsCatalog() {
  return useQuery({
    queryKey: ["integrations-catalog"],
    queryFn: async (): Promise<IntegrationCatalogItem[]> => {
      const { data, error } = await supabase
        .from("integrations_catalog")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as IntegrationCatalogItem[];
    },
  });
}

export function useIntegrationConnections() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["integration-connections", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<IntegrationConnection[]> => {
      const { data, error } = await supabase
        .from("integration_connections")
        .select("*")
        .eq("workspace_id", current!.id);
      if (error && error.code !== "PGRST116") throw error;
      return (data ?? []) as IntegrationConnection[];
    },
  });
}

export function useConnectIntegration() {
  const qc = useQueryClient();
  const { current } = useWorkspace();
  return useMutation({
    mutationFn: async (input: { integration_id: string; credentials_jsonb: Record<string, unknown> }) => {
      if (!current) throw new Error("Sem workspace");
      const { error } = await supabase.from("integration_connections").upsert({
        workspace_id: current.id,
        integration_id: input.integration_id,
        credentials_jsonb: input.credentials_jsonb,
        status: "active",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Integração conectada");
      qc.invalidateQueries({ queryKey: ["integration-connections"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDisconnectIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("integration_connections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Integração desconectada");
      qc.invalidateQueries({ queryKey: ["integration-connections"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ============================================================
 * STORAGE
 * ============================================================ */
export type StorageSummary = {
  total_bytes: number;
  files_count: number;
  by_kind: Record<string, { bytes: number; count: number }> | null;
};

export function useStorageSummary() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["storage-summary", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<StorageSummary> => {
      const { data, error } = await supabase
        .from("storage_usage_summary")
        .select("*")
        .eq("workspace_id", current!.id)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      const row = (data ?? null) as { total_bytes?: number; files_count?: number; by_kind?: StorageSummary["by_kind"] } | null;
      return {
        total_bytes: row?.total_bytes ?? 0,
        files_count: row?.files_count ?? 0,
        by_kind: row?.by_kind ?? null,
      };
    },
  });
}

export type RecentFile = {
  name: string;
  size: number;
  created_at: string;
  mime_type: string | null;
  path: string;
};

export function useRecentFiles() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["storage-recent-files", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<RecentFile[]> => {
      const prefix = current!.id;
      const { data, error } = await supabase.storage
        .from("darkfunnel-media")
        .list(prefix, { limit: 50, sortBy: { column: "created_at", order: "desc" } });
      if (error) return [];
      return (data ?? [])
        .filter((o) => o.name && o.metadata)
        .map((o) => ({
          name: o.name,
          size: (o.metadata?.size as number) ?? 0,
          created_at: o.created_at ?? "",
          mime_type: (o.metadata?.mimetype as string) ?? null,
          path: `${prefix}/${o.name}`,
        }));
    },
  });
}

export function useDeleteStorageFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (path: string) => {
      const { error } = await supabase.storage.from("darkfunnel-media").remove([path]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Arquivo removido");
      qc.invalidateQueries({ queryKey: ["storage-recent-files"] });
      qc.invalidateQueries({ queryKey: ["storage-summary"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
