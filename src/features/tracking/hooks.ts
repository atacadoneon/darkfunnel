import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { toast } from "sonner";

/* ============== tracking_configs ============== */
export type TrackingConfig = {
  id: string;
  workspace_id: string;
  meta_pixel_id: string | null;
  meta_access_token_encrypted: string | null;
  meta_test_event_code: string | null;
  meta_status: "not_configured" | "configured" | "error" | null;
  meta_configured_at: string | null;
  google_customer_id: string | null;
  google_conversion_action_id: string | null;
  google_status: "not_configured" | "configured" | "error" | null;
  google_configured_at: string | null;
  lp_send_lead_to_meta: boolean | null;
  lp_send_lead_to_google: boolean | null;
};

export function useTrackingConfig() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["tracking_configs", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<TrackingConfig | null> => {
      const { data, error } = await supabase
        .from("tracking_configs")
        .select("*")
        .eq("workspace_id", current!.id)
        .maybeSingle();
      if (error && (error as any).code !== "PGRST116") throw error;
      return (data as any) ?? null;
    },
  });
  useEffect(() => {
    if (!current) return;
    const ch = supabase
      .channel(`tcfg:${current.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tracking_configs", filter: `workspace_id=eq.${current.id}` },
        () => qc.invalidateQueries({ queryKey: ["tracking_configs", current.id] }))
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [current, qc]);
  return q;
}

export function useUpsertTrackingConfig() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<TrackingConfig>) => {
      if (!current) throw new Error("no ws");
      const row = { workspace_id: current.id, ...patch };
      const { error } = await supabase
        .from("tracking_configs")
        .upsert(row as any, { onConflict: "workspace_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configuração salva");
      qc.invalidateQueries({ queryKey: ["tracking_configs", current?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ============== stage_event_mappings ============== */
export type StageEventMapping = {
  id: string;
  workspace_id: string;
  stage_id: string;
  provider: "meta" | "google";
  event_name: string | null;
  value_mode: "none" | "deal" | "fixed" | null;
  fixed_value_cents: number | null;
  active: boolean;
};

export function useStageEventMappings(provider: "meta" | "google") {
  const { current } = useWorkspace();
  const q = useQuery({
    queryKey: ["stage_event_mappings", current?.id, provider],
    enabled: !!current,
    queryFn: async (): Promise<StageEventMapping[]> => {
      const { data, error } = await supabase
        .from("stage_event_mappings")
        .select("*")
        .eq("workspace_id", current!.id)
        .eq("provider", provider);
      if (error) throw error;
      return (data ?? []) as any;
    },
  });
  return q;
}

export function useUpsertStageMapping() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: Partial<StageEventMapping> & { stage_id: string; provider: "meta" | "google" }) => {
      if (!current) throw new Error("no ws");
      const row = {
        workspace_id: current.id,
        stage_id: v.stage_id,
        provider: v.provider,
        event_name: v.event_name ?? null,
        value_mode: v.value_mode ?? "none",
        fixed_value_cents: v.fixed_value_cents ?? null,
        active: v.active ?? true,
      };
      const { error } = await supabase
        .from("stage_event_mappings")
        .upsert(row as any, { onConflict: "workspace_id,stage_id,provider" });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["stage_event_mappings", current?.id, v.provider] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ============== tracking_queue ============== */
export type QueueItem = {
  id: string;
  workspace_id: string;
  provider: "meta" | "google";
  event_name: string | null;
  status: "pending" | "sent" | "failed";
  attempt_count: number | null;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
};

export function useQueueStats() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["tracking_queue_stats", current?.id],
    enabled: !!current,
    queryFn: async () => {
      const wsId = current!.id;
      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const [pending, sent, failed] = await Promise.all([
        supabase.from("tracking_queue").select("id", { count: "exact", head: true }).eq("workspace_id", wsId).eq("status", "pending"),
        supabase.from("tracking_queue").select("id", { count: "exact", head: true }).eq("workspace_id", wsId).eq("status", "sent").gte("sent_at", since),
        supabase.from("tracking_queue").select("id", { count: "exact", head: true }).eq("workspace_id", wsId).eq("status", "failed").gte("created_at", since),
      ]);
      return {
        pending: pending.count ?? 0,
        sent: sent.count ?? 0,
        failed: failed.count ?? 0,
      };
    },
  });
  useEffect(() => {
    if (!current) return;
    const ch = supabase
      .channel(`tqstats:${current.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tracking_queue", filter: `workspace_id=eq.${current.id}` },
        () => qc.invalidateQueries({ queryKey: ["tracking_queue_stats", current.id] }))
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [current, qc]);
  return q;
}

export function useQueueList(limit = 100) {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["tracking_queue_list", current?.id, limit],
    enabled: !!current,
    queryFn: async (): Promise<QueueItem[]> => {
      const { data, error } = await supabase
        .from("tracking_queue")
        .select("*")
        .eq("workspace_id", current!.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as any;
    },
  });
}

export function useProcessQueue() {
  const qc = useQueryClient();
  const { current } = useWorkspace();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("tracking-process-queue", {
        body: { workspace_id: current?.id },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fila processada");
      qc.invalidateQueries({ queryKey: ["tracking_queue_stats", current?.id] });
      qc.invalidateQueries({ queryKey: ["tracking_queue_list", current?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useTestMetaConnection() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("meta-test-connection", {});
      if (error) throw error;
      return data;
    },
    onSuccess: () => toast.success("Conexão Meta validada"),
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ============== Overview metrics ============== */
export function useTrackingOverview(days = 30) {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["tracking_overview", current?.id, days],
    enabled: !!current,
    queryFn: async () => {
      const wsId = current!.id;
      const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
      const [contactsRes, dealsRes] = await Promise.all([
        supabase.from("contacts").select("id,created_at,attribution_source,last_attribution_clid,utm_campaign")
          .eq("workspace_id", wsId).gte("created_at", since),
        supabase.from("deals").select("id,value_cents,status,contact_id,created_at")
          .eq("workspace_id", wsId).gte("created_at", since),
      ]);
      const contacts = contactsRes.data ?? [];
      const deals = dealsRes.data ?? [];
      const won = deals.filter((d: any) => d.status === "won");
      const revenue = won.reduce((s: number, d: any) => s + (d.value_cents ?? 0), 0) / 100;
      const conversionRate = contacts.length ? (won.length / contacts.length) * 100 : 0;
      const ticket = won.length ? revenue / won.length : 0;
      const meta = contacts.filter((c: any) => c.attribution_source === "meta_ctwa" || c.attribution_source === "meta_link");
      // Daily series
      const byDay: Record<string, Record<string, number>> = {};
      contacts.forEach((c: any) => {
        const day = (c.created_at ?? "").slice(0, 10);
        if (!day) return;
        const src = bucketSource(c.attribution_source);
        byDay[day] = byDay[day] || { google: 0, meta: 0, organico: 0, outros: 0 };
        byDay[day][src] = (byDay[day][src] ?? 0) + 1;
      });
      const series = Object.entries(byDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, vals]) => ({ day: day.slice(5).replace("-", "/"), ...vals }));
      // Campaign perf
      const wonByContact = new Map<string, number>();
      won.forEach((d: any) => {
        if (!d.contact_id) return;
        wonByContact.set(d.contact_id, (wonByContact.get(d.contact_id) ?? 0) + (d.value_cents ?? 0));
      });
      const camp = new Map<string, { campaign: string; source: string; leads: number; conv: number; rev: number }>();
      contacts.forEach((c: any) => {
        const k = `${c.utm_campaign ?? "—"}|${c.attribution_source ?? "organico"}`;
        const row = camp.get(k) ?? { campaign: c.utm_campaign ?? "Sem campanha", source: prettySource(c.attribution_source), leads: 0, conv: 0, rev: 0 };
        row.leads += 1;
        if (wonByContact.has(c.id)) {
          row.conv += 1;
          row.rev += wonByContact.get(c.id) ?? 0;
        }
        camp.set(k, row);
      });
      return {
        leads: contacts.length,
        conversions: won.length,
        conversionRate,
        revenue,
        ticket,
        metaLeads: meta.length,
        metaConv: meta.filter((c: any) => wonByContact.has(c.id)).length,
        series,
        campaigns: Array.from(camp.values()).sort((a, b) => b.leads - a.leads),
      };
    },
  });
}

function bucketSource(src: string | null): "google" | "meta" | "organico" | "outros" {
  if (!src) return "organico";
  if (src.startsWith("google")) return "google";
  if (src.startsWith("meta")) return "meta";
  if (src === "organic" || src === "site") return "organico";
  return "outros";
}
function prettySource(src: string | null): string {
  if (!src) return "Orgânico";
  if (src.startsWith("google")) return "Google";
  if (src.startsWith("meta")) return "Meta";
  return src;
}

/* ============== landing_pages ============== */
export type LandingPage = {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  whatsapp_phone: string;
  message: string | null;
  campaign_name: string | null;
  traffic_source: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  custom_params: Record<string, string> | null;
  active: boolean;
  created_at: string;
  clicks_count?: number | null;
  conversations_count?: number | null;
  conversions_count?: number | null;
  revenue_cents?: number | null;
};

export function useLandingPages() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["landing_pages", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<LandingPage[]> => {
      const { data, error } = await supabase
        .from("landing_pages")
        .select("*")
        .eq("workspace_id", current!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any;
    },
  });
  useEffect(() => {
    if (!current) return;
    const ch = supabase
      .channel(`lps:${current.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "landing_pages", filter: `workspace_id=eq.${current.id}` },
        () => qc.invalidateQueries({ queryKey: ["landing_pages", current.id] }))
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [current, qc]);
  return q;
}

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || `lp-${Date.now().toString(36)}`;
}

export function useCreateLandingPage() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: Partial<LandingPage> & { name: string; whatsapp_phone: string }) => {
      if (!current) throw new Error("no ws");
      const slug = `${slugify(v.name)}-${Math.random().toString(36).slice(2, 6)}`;
      const row = {
        workspace_id: current.id,
        name: v.name,
        slug,
        whatsapp_phone: v.whatsapp_phone,
        message: v.message ?? null,
        campaign_name: v.campaign_name ?? null,
        traffic_source: v.traffic_source ?? null,
        utm_source: v.utm_source ?? null,
        utm_medium: v.utm_medium ?? null,
        utm_campaign: v.utm_campaign ?? null,
        utm_content: v.utm_content ?? null,
        utm_term: v.utm_term ?? null,
        custom_params: v.custom_params ?? {},
        active: true,
      };
      const { data, error } = await supabase.from("landing_pages").insert(row).select().single();
      if (error) throw error;
      return data as any;
    },
    onSuccess: () => {
      toast.success("Link de rastreamento criado");
      qc.invalidateQueries({ queryKey: ["landing_pages", current?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateLandingPage() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string } & Partial<LandingPage>) => {
      const { id, ...patch } = v;
      const { error } = await supabase.from("landing_pages").update(patch as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["landing_pages", current?.id] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteLandingPage() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("landing_pages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Link removido");
      qc.invalidateQueries({ queryKey: ["landing_pages", current?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ============== Google tracked count ============== */
export function useGoogleTrackedStats() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["google_tracked_stats", current?.id],
    enabled: !!current,
    queryFn: async () => {
      const wsId = current!.id;
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const [tot, recent] = await Promise.all([
        supabase.from("contacts").select("id", { count: "exact", head: true })
          .eq("workspace_id", wsId).not("gclid", "is", null),
        supabase.from("contacts").select("id", { count: "exact", head: true })
          .eq("workspace_id", wsId).not("gclid", "is", null).gte("created_at", since),
      ]);
      return { total: tot.count ?? 0, recent: recent.count ?? 0 };
    },
  });
}
