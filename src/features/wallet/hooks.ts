import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";

export type Wallet = {
  workspace_id: string;
  balance_cents: number;
  low_balance_alert_cents?: number | null;
  auto_recharge?: boolean | null;
  auto_recharge_threshold_cents?: number | null;
  auto_recharge_amount_cents?: number | null;
};

export type WalletTx = {
  id: string;
  workspace_id: string;
  type: string;
  description: string | null;
  amount_cents: number;
  balance_after_cents: number | null;
  created_at: string;
};

export function useWallet() {
  const { current } = useWorkspace();
  const wsId = current?.id;
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["wallet", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallets")
        .select("*")
        .eq("workspace_id", wsId)
        .maybeSingle();
      if (error) throw error;
      return data as Wallet | null;
    },
  });

  useEffect(() => {
    if (!wsId) return;
    const ch = supabase
      .channel(`wallet:${wsId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wallets", filter: `workspace_id=eq.${wsId}` }, () => {
        qc.invalidateQueries({ queryKey: ["wallet", wsId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "wallet_transactions", filter: `workspace_id=eq.${wsId}` }, () => {
        qc.invalidateQueries({ queryKey: ["wallet-tx", wsId] });
        qc.invalidateQueries({ queryKey: ["wallet", wsId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [wsId, qc]);

  return q;
}

export function useWalletTransactions(limit = 100) {
  const { current } = useWorkspace();
  const wsId = current?.id;
  return useQuery({
    queryKey: ["wallet-tx", wsId, limit],
    enabled: !!wsId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("workspace_id", wsId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as WalletTx[];
    },
  });
}

export function usePhoneNumbers() {
  const { current } = useWorkspace();
  const wsId = current?.id;
  return useQuery({
    queryKey: ["phone-numbers", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("phone_numbers")
        .select("*")
        .eq("workspace_id", wsId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useVoicePricing() {
  return useQuery({
    queryKey: ["voice-pricing"],
    queryFn: async () => {
      const { data, error } = await supabase.from("voice_pricing").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function formatBRL(cents: number | null | undefined): string {
  const v = (cents ?? 0) / 100;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
