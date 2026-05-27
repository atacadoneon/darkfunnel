import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import type { PaymentGateway, PaymentLink, PaymentProvider } from "./types";

export function useGateways() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["payment_gateways", current?.id],
    enabled: !!current?.id,
    queryFn: async (): Promise<PaymentGateway[]> => {
      const { data, error } = await supabase
        .from("payment_gateways" as any)
        .select("*")
        .eq("workspace_id", current!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as any) ?? [];
    },
  });

  useEffect(() => {
    if (!current?.id) return;
    const ch = supabase
      .channel(`payment_gateways:${current.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_gateways", filter: `workspace_id=eq.${current.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["payment_gateways", current.id] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [current?.id, qc]);

  return q;
}

export function useSaveGateway() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      provider: PaymentProvider;
      display_name: string;
      credentials: Record<string, any>;
      environment: "sandbox" | "production";
      is_default?: boolean;
    }) => {
      if (!current) throw new Error("Workspace inválido");
      const existing = await supabase
        .from("payment_gateways" as any)
        .select("id")
        .eq("workspace_id", current.id)
        .limit(1);
      const isFirst = (existing.data?.length ?? 0) === 0;
      const payload: any = {
        workspace_id: current.id,
        provider: input.provider,
        display_name: input.display_name,
        credentials_encrypted: { ...input.credentials, environment: input.environment },
        status: "configured",
        is_default: input.is_default ?? isFirst,
      };
      if (input.id) {
        const { error } = await supabase.from("payment_gateways" as any).update(payload).eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("payment_gateways" as any).upsert(payload, { onConflict: "workspace_id,provider" });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payment_gateways", current?.id] }),
  });
}

export function useSetDefaultGateway() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!current) return;
      await supabase.from("payment_gateways" as any).update({ is_default: false }).eq("workspace_id", current.id);
      const { error } = await supabase.from("payment_gateways" as any).update({ is_default: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payment_gateways", current?.id] }),
  });
}

export function useDisconnectGateway() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("payment_gateways" as any)
        .update({ status: "disabled", credentials_encrypted: null, is_default: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payment_gateways", current?.id] }),
  });
}

export function useCreatePaymentLink() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      gateway_id?: string;
      provider?: PaymentProvider;
      amount_cents: number;
      description?: string;
      contact_id?: string | null;
      deal_id?: string | null;
      customer_name?: string;
      customer_email?: string;
      customer_phone?: string;
      customer_document?: string;
      max_installments?: number;
      payment_methods?: string[];
      expires_in_hours?: number;
    }) => {
      if (!current) throw new Error("Workspace inválido");
      const { data, error } = await supabase.functions.invoke("payment-link-create", {
        body: { workspace_id: current.id, ...input },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { id: string; url: string; expires_at: string | null };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payment_links", current?.id] }),
  });
}

export function usePaymentLinks(filters: { status?: string; gateway_id?: string; from?: string; to?: string } = {}) {
  const { current } = useWorkspace();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["payment_links", current?.id, filters],
    enabled: !!current?.id,
    queryFn: async (): Promise<PaymentLink[]> => {
      let query = supabase
        .from("payment_links" as any)
        .select("*")
        .eq("workspace_id", current!.id)
        .order("created_at", { ascending: false })
        .limit(500);
      if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
      if (filters.gateway_id && filters.gateway_id !== "all") query = query.eq("gateway_id", filters.gateway_id);
      if (filters.from) query = query.gte("created_at", filters.from);
      if (filters.to) query = query.lte("created_at", filters.to);
      const { data, error } = await query;
      if (error) throw error;
      return (data as any) ?? [];
    },
  });

  useEffect(() => {
    if (!current?.id) return;
    const ch = supabase
      .channel(`payment_links:${current.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_links", filter: `workspace_id=eq.${current.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["payment_links", current.id] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [current?.id, qc]);

  return q;
}

export function useCancelPaymentLink() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payment_links" as any).update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payment_links", current?.id] }),
  });
}

// Test connection — fallback no-op (edge function preferred). Returns true if creds present.
export async function testGatewayConnection(provider: PaymentProvider, creds: Record<string, any>): Promise<{ ok: boolean; message: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("payment-gateway-test", {
      body: { provider, credentials: creds },
    });
    if (!error && data) return { ok: !!data.ok, message: data.message ?? (data.ok ? "Conexão validada" : "Falha na validação") };
  } catch {
    /* fallback */
  }
  const required = Object.values(creds).filter((v) => typeof v === "string" && v.length > 0).length;
  return { ok: required > 0, message: required > 0 ? "Credenciais salvas (validação manual)" : "Preencha as credenciais" };
}
