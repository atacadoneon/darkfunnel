import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";

export type Stage = {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  position: number;
  is_won: boolean;
  is_lost: boolean;
};

export type Deal = {
  id: string;
  workspace_id: string;
  stage_id: string;
  contact_id: string | null;
  title: string;
  value_cents: number;
  currency: string;
  position: number;
  assigned_to: string | null;
  notes: string | null;
  expected_close_date: string | null;
  status: "open" | "won" | "lost";
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  archived_at?: string | null;
  contact?: { id: string; display_name: string | null; phone_e164: string | null; profile_pic_url: string | null } | null;
};

export function useStages() {
  const { current } = useWorkspace();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["pipeline_stages", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<Stage[]> => {
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select("*")
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Stage[];
    },
  });

  useEffect(() => {
    if (!current) return;
    const ch = supabase
      .channel(`stages:${current.id}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pipeline_stages", filter: `workspace_id=eq.${current.id}` },
        () => qc.invalidateQueries({ queryKey: ["pipeline_stages", current.id] })
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [current, qc]);

  return q;
}

export function useDeals() {
  const { current } = useWorkspace();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["deals", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<Deal[]> => {
      const { data, error } = await supabase
        .from("deals")
        .select("*, contact:contacts(id,display_name,phone_e164,profile_pic_url)")
        .is("deleted_at", null)
        .is("archived_at", null)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Deal[];
    },
  });

  useEffect(() => {
    if (!current) return;
    const ch = supabase
      .channel(`deals:${current.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deals", filter: `workspace_id=eq.${current.id}` },
        () => qc.invalidateQueries({ queryKey: ["deals", current.id] })
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [current, qc]);

  return q;
}

export function formatMoney(cents: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
}
