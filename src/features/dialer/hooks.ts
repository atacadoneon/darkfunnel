import { useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { toast } from "sonner";

export type CampaignStatus = "draft" | "active" | "paused" | "completed";

export type DialerCampaign = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  pipeline_id: string | null;
  stage_ids: string[] | null;
  filters: any;
  call_timeout_seconds: number | null;
  auto_send_no_answer_msg: boolean | null;
  target_count: number | null;
  completed_count: number | null;
  atendeu_count: number | null;
  nao_atendeu_count: number | null;
  convertido_count: number | null;
  sem_interesse_count?: number | null;
  reagendar_count?: number | null;
  created_at: string;
  created_by: string | null;
  deleted_at: string | null;
};

export type QueueOutcome =
  | "atendeu"
  | "nao_atendeu"
  | "reagendar"
  | "convertido"
  | "sem_interesse"
  | null;

export type DialerQueueItem = {
  id: string;
  campaign_id: string;
  contact_id: string | null;
  deal_id: string | null;
  conversation_id: string | null;
  phone_e164: string | null;
  position: number | null;
  status: "pending" | "calling" | "completed" | string;
  outcome: QueueOutcome;
  notes: string | null;
  call_id: string | null;
  completed_at: string | null;
  created_at: string;
  contact?: { id: string; display_name: string | null; profile_pic_url: string | null; phone_e164: string | null } | null;
  deal?: { id: string; title: string; value_cents: number; stage_id: string | null } | null;
};

/* ============ Campaigns ============ */

export function useCampaigns() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["dialer-campaigns", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<DialerCampaign[]> => {
      const { data, error } = await (supabase as any)
        .from("dialer_campaigns")
        .select("*")
        .eq("workspace_id", current!.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DialerCampaign[];
    },
  });
  useEffect(() => {
    if (!current) return;
    const ch = supabase
      .channel(`dialer-camp:${current.id}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dialer_campaigns", filter: `workspace_id=eq.${current.id}` },
        () => qc.invalidateQueries({ queryKey: ["dialer-campaigns", current.id] }),
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [current, qc]);
  return q;
}

export function useCampaign(id: string | null) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["dialer-campaign", id],
    enabled: !!id,
    queryFn: async (): Promise<DialerCampaign | null> => {
      const { data, error } = await (supabase as any)
        .from("dialer_campaigns").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data as DialerCampaign | null;
    },
  });
  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`dialer-camp-one:${id}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "dialer_campaigns", filter: `id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["dialer-campaign", id] }))
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [id, qc]);
  return q;
}

export function useQueue(campaignId: string | null) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["dialer-queue", campaignId],
    enabled: !!campaignId,
    queryFn: async (): Promise<DialerQueueItem[]> => {
      const { data, error } = await (supabase as any)
        .from("dialer_queue")
        .select("*, contact:contacts(id,display_name,profile_pic_url,phone_e164), deal:deals(id,title,value_cents,stage_id)")
        .eq("campaign_id", campaignId!)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DialerQueueItem[];
    },
  });
  useEffect(() => {
    if (!campaignId) return;
    const ch = supabase
      .channel(`dialer-q:${campaignId}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "dialer_queue", filter: `campaign_id=eq.${campaignId}` },
        () => qc.invalidateQueries({ queryKey: ["dialer-queue", campaignId] }))
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [campaignId, qc]);
  return q;
}

/* ============ Mutations / RPCs ============ */

export function useCreateCampaign() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      name: string;
      description?: string;
      pipeline_id: string | null;
      stage_ids: string[];
      filters?: any;
      call_timeout_seconds?: number;
      auto_send_no_answer_msg?: boolean;
    }) => {
      if (!current) throw new Error("no workspace");
      const insertRow: any = {
        workspace_id: current.id,
        name: v.name,
        description: v.description ?? null,
        pipeline_id: v.pipeline_id,
        stage_ids: v.stage_ids,
        filters: v.filters ?? {},
        call_timeout_seconds: v.call_timeout_seconds ?? 30,
        auto_send_no_answer_msg: v.auto_send_no_answer_msg ?? false,
        status: "draft" as CampaignStatus,
      };
      const { data, error } = await (supabase as any)
        .from("dialer_campaigns").insert(insertRow).select("id").single();
      if (error) throw error;
      const campaignId = (data as any).id as string;
      const { error: rpcErr } = await (supabase as any).rpc("dialer_build_queue", { p_campaign_id: campaignId });
      if (rpcErr) throw rpcErr;
      return campaignId;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dialer-campaigns", current?.id] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSetCampaignStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: CampaignStatus }) => {
      const { error } = await (supabase as any).rpc("dialer_set_status", {
        p_campaign_id: id,
        p_status: status,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["dialer-campaign", vars.id] });
      qc.invalidateQueries({ queryKey: ["dialer-campaigns"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export async function fetchNextLead(campaignId: string): Promise<DialerQueueItem | null> {
  const { data, error } = await (supabase as any).rpc("dialer_next_lead", { p_campaign_id: campaignId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  if ((row as any).done) return null;
  // RPC may wrap as { queue_item: {...} } or return flat row with extras
  const flat: any = (row as any).queue_item ?? row;
  const queueId = flat.id ?? flat.queue_id ?? null;
  if (!queueId) return flat as DialerQueueItem;
  const { data: full } = await (supabase as any)
    .from("dialer_queue")
    .select("*, contact:contacts(id,display_name,profile_pic_url,phone_e164), deal:deals(id,title,value_cents,stage_id)")
    .eq("id", queueId).maybeSingle();
  // Synthesize contact/deal from flat RPC fields when joins are empty
  const contact = (full as any)?.contact ?? (flat.contact_id || flat.display_name || flat.phone_e164 ? {
    id: flat.contact_id,
    display_name: flat.display_name ?? null,
    profile_pic_url: flat.profile_pic_url ?? null,
    phone_e164: flat.phone_e164 ?? null,
  } : null);
  const deal = (full as any)?.deal ?? (flat.deal_id || flat.deal_title ? {
    id: flat.deal_id,
    title: flat.deal_title ?? "",
    value_cents: flat.value_cents ?? 0,
    stage_id: flat.stage_id ?? null,
  } : null);
  return { ...flat, ...(full ?? {}), contact, deal } as DialerQueueItem;
}

export function useSetOutcome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { queue_id: string; outcome: QueueOutcome; notes?: string; call_id?: string | null }) => {
      const { error } = await (supabase as any).rpc("dialer_set_outcome", {
        p_queue_id: v.queue_id,
        p_outcome: v.outcome,
        p_notes: v.notes ?? null,
        p_call_id: v.call_id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dialer-queue"] });
      qc.invalidateQueries({ queryKey: ["dialer-campaign"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export type AiCoach = {
  resumo?: string[];
  abertura?: string;
  perguntas?: string[];
  objecao?: { texto?: string; resposta?: string } | string;
  proximo_passo?: string;
  sentimento?: "positivo" | "neutro" | "negativo" | string;
  objetivo?: string;
  [k: string]: any;
};

export function useAiCoach() {
  return useMutation({
    mutationFn: async (v: { contact_id: string | null; deal_id: string | null; queue_id: string }) => {
      const { data, error } = await supabase.functions.invoke("ai-call-coach", { body: v });
      if (error) throw error;
      const sug = (data as any)?.sugestoes ?? (data as any) ?? {};
      return sug as AiCoach;
    },
  });
}

export async function sendNoAnswerMessage(queueId: string) {
  const { error } = await supabase.functions.invoke("dialer-send-no-answer", { body: { queue_id: queueId } });
  if (error) throw error;
}
