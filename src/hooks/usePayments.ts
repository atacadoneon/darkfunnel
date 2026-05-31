import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";

export type PaymentRow = {
  id: string;
  workspace_id: string;
  assigned_user_id: string | null;
  contact_id: string | null;
  deal_id: string | null;
  proposal_id: string | null;
  gateway: string | null;
  method: string | null;
  installments: number | null;
  status: string;
  status_reason: string | null;
  amount_cents: number;
  paid_amount_cents: number | null;
  fee_cents: number | null;
  net_amount_cents: number | null;
  due_date: string | null;
  paid_at: string | null;
  next_retry_at: string | null;
  last_webhook_at: string | null;
  webhook_count: number | null;
  external_id: string | null;
  pix_qr_code: string | null;
  pix_qr_image_url: string | null;
  boleto_url: string | null;
  boleto_barcode: string | null;
  payment_url: string | null;
  description: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_document: string | null;
  created_at: string;
  seller_name?: string | null;
};

export type PaymentFilters = {
  status?: string;
  search?: string;
  gateways?: string[];
  methods?: string[];
  sellers?: string[];
  minCents?: number;
  maxCents?: number;
  from?: string;
  to?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
};

export function usePaymentsKpis() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["payments_kpis", current?.id],
    enabled: !!current?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments_financial_kpis" as any)
        .select("*")
        .eq("workspace_id", current!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as any) ?? {
        paid_count_month: 0, paid_cents_month: 0,
        pending_count: 0, pending_cents: 0,
        overdue_count: 0, overdue_cents: 0,
        avg_ticket_cents_30d: 0, approval_rate_30d: 0,
      };
    },
  });
}

export function usePaymentsForecast() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["payments_forecast", current?.id],
    enabled: !!current?.id,
    queryFn: async () => {
      const end = new Date(); end.setDate(end.getDate() + 30);
      const { data, error } = await supabase
        .from("payments_forecast_daily" as any)
        .select("*")
        .eq("workspace_id", current!.id)
        .lte("due_date", end.toISOString().slice(0, 10))
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });
}

export function usePaymentsCommissions() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["payments_commissions", current?.id],
    enabled: !!current?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments_commissions_30d" as any)
        .select("*")
        .eq("workspace_id", current!.id)
        .order("total_paid_cents", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });
}

export function usePaymentsStatusCounts() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["payments_status_counts", current?.id],
    enabled: !!current?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_links" as any)
        .select("status")
        .eq("workspace_id", current!.id);
      if (error) throw error;
      const counts: Record<string, number> = { all: 0 };
      for (const r of (data as any[]) ?? []) {
        counts.all++;
        counts[r.status] = (counts[r.status] ?? 0) + 1;
      }
      return counts;
    },
  });
}

export function usePayments(filters: PaymentFilters = {}) {
  const { current } = useWorkspace();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["payments_list", current?.id, filters],
    enabled: !!current?.id,
    queryFn: async (): Promise<PaymentRow[]> => {
      let q = supabase
        .from("payment_links" as any)
        .select("*")
        .eq("workspace_id", current!.id)
        .limit(500);
      if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
      if (filters.gateways?.length) q = q.in("gateway", filters.gateways);
      if (filters.methods?.length) q = q.in("method", filters.methods);
      if (filters.sellers?.length) q = q.in("assigned_user_id", filters.sellers);
      if (typeof filters.minCents === "number") q = q.gte("amount_cents", filters.minCents);
      if (typeof filters.maxCents === "number") q = q.lte("amount_cents", filters.maxCents);
      if (filters.from) q = q.gte("created_at", filters.from);
      if (filters.to) q = q.lte("created_at", filters.to);
      if (filters.search) {
        const s = filters.search.replace(/[%,]/g, "");
        q = q.or(`customer_name.ilike.%${s}%,description.ilike.%${s}%,external_id.ilike.%${s}%`);
      }
      const sortBy = filters.sortBy ?? "created_at";
      q = q.order(sortBy, { ascending: filters.sortDir === "asc" });
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data as any[]) ?? [];

      const ids = Array.from(new Set(rows.map((r) => r.assigned_user_id).filter(Boolean)));
      let sellerMap: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles" as any)
          .select("user_id, display_name, full_name")
          .in("user_id", ids);
        for (const p of (profs as any[]) ?? []) {
          sellerMap[p.user_id] = p.display_name ?? p.full_name ?? "—";
        }
      }
      return rows.map((r) => ({ ...r, seller_name: r.assigned_user_id ? sellerMap[r.assigned_user_id] ?? null : null }));
    },
  });

  useEffect(() => {
    if (!current?.id) return;
    const ch = supabase
      .channel(`payment_links_full:${current.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_links", filter: `workspace_id=eq.${current.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["payments_list", current.id] });
        qc.invalidateQueries({ queryKey: ["payments_kpis", current.id] });
        qc.invalidateQueries({ queryKey: ["payments_status_counts", current.id] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [current?.id, qc]);

  return q;
}

export function useCreatePayment() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<PaymentRow> & { amount_cents: number; method: string }) => {
      if (!current) throw new Error("Workspace inválido");
      const { data: user } = await supabase.auth.getUser();
      const payload: any = {
        ...input,
        workspace_id: current.id,
        assigned_user_id: input.assigned_user_id ?? user.user?.id ?? null,
        status: "pending",
      };
      const { data, error } = await supabase.from("payment_links" as any).insert(payload).select("*").single();
      if (error) throw error;
      return data as any;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments_list", current?.id] });
      qc.invalidateQueries({ queryKey: ["payments_kpis", current?.id] });
      qc.invalidateQueries({ queryKey: ["payments_status_counts", current?.id] });
    },
  });
}

export function useUpdatePayment() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; action: "cancel" | "refund" | "markPaid" | "retry"; ids?: string[] }) => {
      const ids = input.ids ?? [input.id];
      const patch: any = {};
      if (input.action === "cancel") patch.status = "cancelled";
      if (input.action === "refund") patch.status = "refunded";
      if (input.action === "markPaid") { patch.status = "paid"; patch.paid_at = new Date().toISOString(); }
      if (input.action === "retry") patch.next_retry_at = new Date(Date.now() + 60_000).toISOString();
      const { error } = await supabase.from("payment_links" as any).update(patch).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments_list", current?.id] });
      qc.invalidateQueries({ queryKey: ["payments_kpis", current?.id] });
      qc.invalidateQueries({ queryKey: ["payments_status_counts", current?.id] });
    },
  });
}

export function usePaymentAttempts(paymentId?: string) {
  return useQuery({
    queryKey: ["payment_attempts", paymentId],
    enabled: !!paymentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_attempts" as any)
        .select("*")
        .eq("payment_link_id", paymentId!)
        .order("attempted_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });
}

export function usePaymentWebhooks(paymentId?: string) {
  return useQuery({
    queryKey: ["payment_webhooks", paymentId],
    enabled: !!paymentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_webhook_logs" as any)
        .select("*")
        .eq("payment_link_id", paymentId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });
}
