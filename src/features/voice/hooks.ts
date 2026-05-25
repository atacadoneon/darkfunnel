import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";

export type CallRow = {
  id: string;
  workspace_id: string;
  user_id: string | null;
  contact_id: string | null;
  conversation_id: string | null;
  deal_id: string | null;
  from_number: string | null;
  to_number: string | null;
  direction: "inbound" | "outbound" | null;
  channel: "pstn" | "whatsapp" | null;
  status: string | null;
  outcome: string | null;
  duration_seconds: number | null;
  cost_cents: number | null;
  consumes_credit: boolean | null;
  initiated_at: string | null;
  twilio_sid: string | null;
  contact?: { display_name: string | null; phone_e164: string | null; profile_pic_preview_url: string | null } | null;
  user?: { display_name: string | null; avatar_url: string | null } | null;
  recordings?: Array<{ id: string; storage_path: string | null; duration_seconds: number | null; status: string | null }>;
  transcript?: Array<{ id: string; summary: string | null; sentiment: string | null; key_topics: any; action_items: any; segments: any; translated_text: string | null; status: string | null }>;
};

const SELECT = `
  *,
  contact:contacts(display_name, phone_e164, profile_pic_preview_url),
  recordings:call_recordings(id, storage_path, duration_seconds, status),
  transcript:call_transcripts(id, summary, sentiment, key_topics, action_items, segments, translated_text, status)
`;

export function useActiveCalls() {
  const { current } = useWorkspace();
  const wsId = current?.id;
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["calls-active", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calls")
        .select(SELECT)
        .eq("workspace_id", wsId)
        .in("status", ["initiated", "ringing", "in_progress"])
        .order("initiated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CallRow[];
    },
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (!wsId) return;
    let ch: any;
    try {
      ch = supabase
        .channel(`calls-active:${wsId}:${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "calls", filter: `workspace_id=eq.${wsId}` }, () => {
          qc.invalidateQueries({ queryKey: ["calls-active", wsId] });
          qc.invalidateQueries({ queryKey: ["calls-list", wsId] });
        })
        .subscribe();
    } catch (e) { console.error("[calls-active realtime]", e); }
    return () => { if (ch) try { supabase.removeChannel(ch); } catch {} };
  }, [wsId, qc]);

  return q;
}

export type CallFilters = {
  from?: string; to?: string;
  userId?: string; outcome?: string;
  direction?: string; channel?: string;
  minDuration?: number;
};

export function useCallsList(filters: CallFilters) {
  const { current } = useWorkspace();
  const wsId = current?.id;
  const qc = useQueryClient();

  useEffect(() => {
    if (!wsId) return;
    const channels: any[] = [];
    try {
      const rnd = Math.random().toString(36).slice(2);
      channels.push(
        supabase.channel(`calls-list-rt:${wsId}:${rnd}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "calls", filter: `workspace_id=eq.${wsId}` }, () => {
            qc.invalidateQueries({ queryKey: ["calls-list", wsId] });
          }).subscribe(),
        supabase.channel(`call-rec-rt:${wsId}:${rnd}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "call_recordings" }, () => {
            qc.invalidateQueries({ queryKey: ["calls-list", wsId] });
          }).subscribe(),
        supabase.channel(`call-trs-rt:${wsId}:${rnd}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "call_transcripts" }, () => {
            qc.invalidateQueries({ queryKey: ["calls-list", wsId] });
          }).subscribe(),
      );
    } catch (e) { console.error("[calls-list realtime]", e); }
    return () => { channels.forEach(c => { try { supabase.removeChannel(c); } catch {} }); };
  }, [wsId, qc]);

  return useQuery({
    queryKey: ["calls-list", wsId, filters],
    enabled: !!wsId,
    queryFn: async () => {
      let q = supabase.from("calls").select(SELECT).eq("workspace_id", wsId);
      if (filters.from) q = q.gte("initiated_at", filters.from);
      if (filters.to) q = q.lte("initiated_at", filters.to);
      if (filters.userId) q = q.eq("user_id", filters.userId);
      if (filters.outcome) q = q.eq("outcome", filters.outcome);
      if (filters.direction) q = q.eq("direction", filters.direction);
      if (filters.channel) q = q.eq("channel", filters.channel);
      if (filters.minDuration) q = q.gte("duration_seconds", filters.minDuration);
      q = q.order("initiated_at", { ascending: false }).limit(500);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CallRow[];
    },
  });
}

export function formatDuration(secs: number | null | undefined): string {
  const s = Math.max(0, Math.floor(secs ?? 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}
