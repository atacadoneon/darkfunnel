import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";

export type DashboardRange = { from: Date; to: Date };

export type ConvRow = {
  id: string;
  contact_id: string | null;
  assigned_user_id: string | null;
  status: string;
  unread_count: number;
  attribution_source: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  first_inbound_at: string | null;
  first_outbound_at: string | null;
  created_at: string;
};

export type DealRow = {
  id: string;
  pipeline_id: string | null;
  stage_id: string | null;
  contact_id: string | null;
  assigned_to: string | null;
  value_cents: number | null;
  status: "open" | "won" | "lost";
  loss_reason_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ContactRow = { id: string; created_at: string };
export type StageRow = { id: string; pipeline_id: string | null; name: string; position: number; is_won: boolean; is_lost: boolean; color: string };
export type MsgAggRow = { conversation_id: string; direction: "in" | "out"; created_at: string };
export type LossReasonRow = { id: string; name: string };
export type ProfileRow = { id: string; display_name: string | null; email: string | null; avatar_url: string | null };

function inRange(iso: string | null | undefined, from: Date, to: Date) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= from.getTime() && t <= to.getTime();
}

export function useDashboardConversations() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["dash-conversations", current?.id],
    enabled: !!current,
    staleTime: 30_000,
    queryFn: async (): Promise<ConvRow[]> => {
      const { data, error } = await supabase
        .from("conversations")
        .select("id,contact_id,assigned_user_id,status,unread_count,attribution_source,last_inbound_at,last_outbound_at,first_inbound_at,first_outbound_at,created_at")
        .eq("workspace_id", current!.id)
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as unknown as ConvRow[];
    },
  });
  useEffect(() => {
    if (!current) return;
    const ch = supabase
      .channel(`dash-conv:${current.id}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations", filter: `workspace_id=eq.${current.id}` },
        () => qc.invalidateQueries({ queryKey: ["dash-conversations", current.id] }))
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [current, qc]);
  return q;
}

export function useDashboardDeals() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["dash-deals", current?.id],
    enabled: !!current,
    staleTime: 30_000,
    queryFn: async (): Promise<DealRow[]> => {
      const { data, error } = await supabase
        .from("deals")
        .select("id,pipeline_id,stage_id,contact_id,assigned_to,value_cents,status,loss_reason_id,created_at,updated_at")
        .eq("workspace_id", current!.id)
        .is("deleted_at", null)
        .limit(10000);
      if (error) throw error;
      return (data ?? []) as unknown as DealRow[];
    },
  });
  useEffect(() => {
    if (!current) return;
    const ch = supabase
      .channel(`dash-deals:${current.id}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "deals", filter: `workspace_id=eq.${current.id}` },
        () => qc.invalidateQueries({ queryKey: ["dash-deals", current.id] }))
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [current, qc]);
  return q;
}

export function useDashboardContacts() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["dash-contacts", current?.id],
    enabled: !!current,
    staleTime: 60_000,
    queryFn: async (): Promise<ContactRow[]> => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id,created_at")
        .eq("workspace_id", current!.id)
        .limit(20000);
      if (error) throw error;
      return (data ?? []) as ContactRow[];
    },
  });
}

export function useDashboardStages() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["dash-stages", current?.id],
    enabled: !!current,
    staleTime: 60_000,
    queryFn: async (): Promise<StageRow[]> => {
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select("id,pipeline_id,name,position,is_won,is_lost,color")
        .eq("workspace_id", current!.id)
        .order("position");
      if (error) throw error;
      return (data ?? []) as unknown as StageRow[];
    },
  });
}

export function useDashboardLossReasons() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["dash-loss-reasons", current?.id],
    enabled: !!current,
    staleTime: 60_000,
    queryFn: async (): Promise<LossReasonRow[]> => {
      const { data, error } = await supabase
        .from("loss_reasons")
        .select("id,name")
        .eq("workspace_id", current!.id);
      if (error) throw error;
      return (data ?? []) as LossReasonRow[];
    },
  });
}

/** Messages aggregated for the period - small payload. */
export function useDashboardMessages(range: DashboardRange) {
  const { current } = useWorkspace();
  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();
  return useQuery({
    queryKey: ["dash-messages", current?.id, fromIso, toIso],
    enabled: !!current,
    staleTime: 30_000,
    queryFn: async (): Promise<MsgAggRow[]> => {
      const { data, error } = await supabase
        .from("messages")
        .select("conversation_id,direction,created_at")
        .eq("workspace_id", current!.id)
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .limit(20000);
      if (error) throw error;
      return (data ?? []) as MsgAggRow[];
    },
  });
}

export function useDashboardProfiles(ids: string[]) {
  const sorted = useMemo(() => [...new Set(ids)].sort(), [ids]);
  const key = sorted.join(",");
  return useQuery({
    queryKey: ["dash-profiles", key],
    enabled: sorted.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Record<string, ProfileRow>> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,display_name,email,avatar_url")
        .in("id", sorted);
      if (error) throw error;
      const map: Record<string, ProfileRow> = {};
      for (const p of (data ?? []) as ProfileRow[]) map[p.id] = p;
      return map;
    },
  });
}

/* ============== Selectors / metric builders ============== */

export function filterDealsByPipeline(deals: DealRow[], pipelineId: string) {
  if (pipelineId === "all") return deals;
  return deals.filter((d) => d.pipeline_id === pipelineId);
}

export function buildAtendimentoMetrics(conversations: ConvRow[], deals: DealRow[], messages: MsgAggRow[], contacts: ContactRow[], range: DashboardRange) {
  // Conversations created in period
  const convPeriod = conversations.filter((c) => inRange(c.created_at, range.from, range.to));

  // First response times for conversations in period
  const responseMinutes: number[] = [];
  for (const c of convPeriod) {
    if (c.first_inbound_at && c.first_outbound_at) {
      const diff = (new Date(c.first_outbound_at).getTime() - new Date(c.first_inbound_at).getTime()) / 60000;
      if (diff >= 0) responseMinutes.push(diff);
    }
  }
  const avgResp = responseMinutes.length ? responseMinutes.reduce((a, b) => a + b, 0) / responseMinutes.length : 0;
  const under5 = responseMinutes.filter((m) => m < 5).length;
  const under15 = responseMinutes.filter((m) => m < 15).length;

  // Aguardando resposta — global current state
  const awaiting = conversations.filter((c) => c.status === "open" && c.unread_count > 0);

  // Global median (all-time)
  const allResp: number[] = [];
  for (const c of conversations) {
    if (c.first_inbound_at && c.first_outbound_at) {
      const d = (new Date(c.first_outbound_at).getTime() - new Date(c.first_inbound_at).getTime()) / 60000;
      if (d >= 0) allResp.push(d);
    }
  }
  const sortedResp = [...allResp].sort((a, b) => a - b);
  const median = sortedResp.length
    ? sortedResp.length % 2 === 0
      ? (sortedResp[sortedResp.length / 2 - 1] + sortedResp[sortedResp.length / 2]) / 2
      : sortedResp[Math.floor(sortedResp.length / 2)]
    : 0;

  // Sem resposta %
  const semResposta = conversations.filter((c) => c.last_inbound_at && (!c.last_outbound_at || new Date(c.last_outbound_at) < new Date(c.last_inbound_at))).length;
  const semRespPct = conversations.length ? (semResposta / conversations.length) * 100 : 0;

  // SLA histórico (<15min)
  const slaHist = allResp.length ? (allResp.filter((m) => m < 15).length / allResp.length) * 100 : 0;
  const slaUnder5Hist = allResp.length ? (allResp.filter((m) => m < 5).length / allResp.length) * 100 : 0;

  // Taxa resolução do período
  const resolved = convPeriod.filter((c) => c.status === "resolved" || c.status === "archived" || c.status === "closed").length;
  const resolPct = convPeriod.length ? (resolved / convPeriod.length) * 100 : 0;

  // Conversão média - dias entre contact.created_at e deal.updated_at (won) no período
  const wonInPeriod = deals.filter((d) => d.status === "won" && inRange(d.updated_at, range.from, range.to));
  const contactMap = new Map(contacts.map((c) => [c.id, c.created_at]));
  const cycleDays: number[] = [];
  for (const d of wonInPeriod) {
    const cAt = d.contact_id ? contactMap.get(d.contact_id) : null;
    if (cAt) {
      const days = (new Date(d.updated_at).getTime() - new Date(cAt).getTime()) / 86400000;
      if (days >= 0) cycleDays.push(days);
    }
  }
  const avgCycle = cycleDays.length ? cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length : 0;

  // Leads perdidos
  const lostInPeriod = deals.filter((d) => d.status === "lost" && inRange(d.updated_at, range.from, range.to));

  // SLA buckets (aguardando)
  const now = Date.now();
  const buckets = { "<5min": 0, "5-15min": 0, "15-60min": 0, ">1h": 0 };
  for (const c of awaiting) {
    if (!c.last_inbound_at) continue;
    const mins = (now - new Date(c.last_inbound_at).getTime()) / 60000;
    if (mins < 5) buckets["<5min"]++;
    else if (mins < 15) buckets["5-15min"]++;
    else if (mins < 60) buckets["15-60min"]++;
    else buckets[">1h"]++;
  }

  // Histogram of hours from inbound messages in period
  const hours = new Array(24).fill(0);
  for (const m of messages) if (m.direction === "in") hours[new Date(m.created_at).getHours()]++;

  return {
    avgResp,
    convPeriodCount: convPeriod.length,
    under5,
    awaiting,
    awaitingCount: awaiting.length,
    median,
    medianPairs: allResp.length,
    semRespPct,
    semResposta,
    slaHist,
    slaUnder5Hist,
    resolPct,
    resolved,
    avgCycle,
    wonCount: wonInPeriod.length,
    lostCount: lostInPeriod.length,
    buckets,
    hours,
    wonInPeriod,
    lostInPeriod,
  };
}

export function buildRankingAtendentes(conversations: ConvRow[], messages: MsgAggRow[], range: DashboardRange) {
  // First response time per agent in period
  const convPeriod = conversations.filter((c) => inRange(c.created_at, range.from, range.to));
  const byUser = new Map<string, { times: number[]; convs: number; msgs: number }>();
  const convToUser = new Map<string, string>();

  for (const c of convPeriod) {
    if (!c.assigned_user_id) continue;
    convToUser.set(c.id, c.assigned_user_id);
    const e = byUser.get(c.assigned_user_id) ?? { times: [], convs: 0, msgs: 0 };
    e.convs += 1;
    if (c.first_inbound_at && c.first_outbound_at) {
      const d = (new Date(c.first_outbound_at).getTime() - new Date(c.first_inbound_at).getTime()) / 60000;
      if (d >= 0) e.times.push(d);
    }
    byUser.set(c.assigned_user_id, e);
  }
  for (const m of messages) {
    const uid = convToUser.get(m.conversation_id);
    if (!uid) continue;
    const e = byUser.get(uid);
    if (e) e.msgs += 1;
  }
  return Array.from(byUser.entries()).map(([user_id, v]) => ({
    user_id,
    convs: v.convs,
    msgs: v.msgs,
    avgTime: v.times.length ? v.times.reduce((a, b) => a + b, 0) / v.times.length : 0,
  }));
}

export function buildPerformanceMetrics(deals: DealRow[], range: DashboardRange) {
  const won = deals.filter((d) => d.status === "won" && inRange(d.updated_at, range.from, range.to));
  const lost = deals.filter((d) => d.status === "lost" && inRange(d.updated_at, range.from, range.to));
  const closedTotal = won.length + lost.length;
  const conv = closedTotal ? (won.length / closedTotal) * 100 : 0;
  const revenueCents = won.reduce((s, d) => s + (d.value_cents ?? 0), 0);
  const ticketCents = won.length ? revenueCents / won.length : 0;
  const cycles = won
    .map((d) => (new Date(d.updated_at).getTime() - new Date(d.created_at).getTime()) / 86400000)
    .filter((n) => n >= 0);
  const avgCycle = cycles.length ? cycles.reduce((a, b) => a + b, 0) / cycles.length : 0;
  return { won, lost, conv, revenueCents, ticketCents, avgCycle };
}

export function buildSellerRanking(deals: DealRow[], range: DashboardRange) {
  const map = new Map<string, { won: number; lost: number; revenueCents: number }>();
  for (const d of deals) {
    if (!d.assigned_to) continue;
    if (!inRange(d.updated_at, range.from, range.to)) continue;
    const e = map.get(d.assigned_to) ?? { won: 0, lost: 0, revenueCents: 0 };
    if (d.status === "won") { e.won += 1; e.revenueCents += d.value_cents ?? 0; }
    else if (d.status === "lost") e.lost += 1;
    map.set(d.assigned_to, e);
  }
  return Array.from(map.entries()).map(([user_id, v]) => {
    const total = v.won + v.lost;
    return { user_id, ...v, taxa: total ? (v.won / total) * 100 : 0 };
  });
}

export function buildConversoesMetrics(contacts: ContactRow[], deals: DealRow[], conversations: ConvRow[], range: DashboardRange) {
  const contactsPeriod = contacts.filter((c) => inRange(c.created_at, range.from, range.to));
  const wonInPeriod = deals.filter((d) => d.status === "won" && inRange(d.updated_at, range.from, range.to));
  const convertedContactIds = new Set(wonInPeriod.map((d) => d.contact_id).filter(Boolean) as string[]);
  const revenueCents = wonInPeriod.reduce((s, d) => s + (d.value_cents ?? 0), 0);
  const taxa = contactsPeriod.length ? (convertedContactIds.size / contactsPeriod.length) * 100 : 0;

  // Origin breakdown using conversations of period
  const convByContact = new Map<string, string>();
  for (const c of conversations) {
    if (!c.contact_id) continue;
    if (!convByContact.has(c.contact_id)) convByContact.set(c.contact_id, c.attribution_source ?? "Sem Origem");
  }
  const originAgg = new Map<string, { contacts: number; won: number }>();
  for (const ct of contactsPeriod) {
    const origin = convByContact.get(ct.id) ?? "Sem Origem";
    const e = originAgg.get(origin) ?? { contacts: 0, won: 0 };
    e.contacts += 1;
    if (convertedContactIds.has(ct.id)) e.won += 1;
    originAgg.set(origin, e);
  }
  const origins = Array.from(originAgg.entries()).map(([name, v]) => ({ name, ...v }));
  return { contactsCount: contactsPeriod.length, convertedCount: convertedContactIds.size, revenueCents, taxa, origins };
}

export function buildAdsMetrics(contacts: ContactRow[], deals: DealRow[], conversations: ConvRow[], range: DashboardRange) {
  const adContactIds = new Set<string>();
  const sourceByContact = new Map<string, string>();
  for (const c of conversations) {
    if (c.contact_id && c.attribution_source) {
      adContactIds.add(c.contact_id);
      if (!sourceByContact.has(c.contact_id)) sourceByContact.set(c.contact_id, c.attribution_source);
    }
  }
  const adContactsInPeriod = contacts.filter((c) => adContactIds.has(c.id) && inRange(c.created_at, range.from, range.to));
  const adContactIdsInPeriod = new Set(adContactsInPeriod.map((c) => c.id));
  const wonAds = deals.filter((d) => d.status === "won" && d.contact_id && adContactIdsInPeriod.has(d.contact_id) && inRange(d.updated_at, range.from, range.to));
  const revenueCents = wonAds.reduce((s, d) => s + (d.value_cents ?? 0), 0);
  const ticketCents = wonAds.length ? revenueCents / wonAds.length : 0;

  const sourceAgg = new Map<string, { contacts: number; won: number; revenueCents: number }>();
  for (const c of adContactsInPeriod) {
    const src = sourceByContact.get(c.id) ?? "outros";
    const e = sourceAgg.get(src) ?? { contacts: 0, won: 0, revenueCents: 0 };
    e.contacts += 1;
    sourceAgg.set(src, e);
  }
  for (const d of wonAds) {
    const src = d.contact_id ? sourceByContact.get(d.contact_id) ?? "outros" : "outros";
    const e = sourceAgg.get(src);
    if (e) { e.won += 1; e.revenueCents += d.value_cents ?? 0; }
  }
  const platforms = Array.from(sourceAgg.entries()).map(([name, v]) => ({ name, ...v }));
  return {
    leadsCount: adContactsInPeriod.length,
    convCount: wonAds.length,
    revenueCents,
    ticketCents,
    platforms,
  };
}
