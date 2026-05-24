import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { toast } from "sonner";

export type EmailCampaign = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  status: "draft" | "scheduled" | "sending" | "sent" | "failed";
  subject: string | null;
  preheader: string | null;
  from_name: string | null;
  from_email: string | null;
  reply_to: string | null;
  body_html: string | null;
  body_text: string | null;
  template_id: string | null;
  list_ids: string[] | null;
  recipients_count: number | null;
  delivered_count?: number | null;
  opened_count?: number | null;
  clicked_count?: number | null;
  bounced_count?: number | null;
  scheduled_for: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at?: string | null;
  deleted_at: string | null;
  created_by: string | null;
};

export type EmailList = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  source: "manual" | "dynamic" | "contacts_all";
  members_count?: number | null;
  created_at: string;
  updated_at?: string | null;
  deleted_at: string | null;
};

export type EmailListMember = {
  id: string;
  list_id: string;
  email: string;
  contact_id: string | null;
  status: "subscribed" | "unsubscribed" | "bounced" | "complained";
  subscribed_at: string | null;
};

export type EmailTemplate = {
  id: string;
  workspace_id: string;
  name: string;
  category: string | null;
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  thumbnail_url?: string | null;
  created_at: string;
  updated_at?: string | null;
  deleted_at: string | null;
};

export type EmailRecipient = {
  id: string;
  campaign_id: string;
  email: string;
  status: string;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
};

export type EmailEvent = {
  id: string;
  campaign_id: string;
  recipient_id: string | null;
  type: "open" | "click" | "bounce" | "complaint" | "unsubscribe" | "delivered" | string;
  occurred_at: string;
  metadata: Record<string, unknown> | null;
};

export type EmailSuppression = {
  id: string;
  workspace_id: string;
  email: string;
  reason: string;
  created_at: string;
};

/* ============ Queries ============ */

export function useEmailCampaigns() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["email-campaigns", current?.id],
    enabled: !!current,
    staleTime: 30_000,
    queryFn: async (): Promise<EmailCampaign[]> => {
      const { data, error } = await supabase
        .from("email_campaigns")
        .select("*")
        .eq("workspace_id", current!.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as EmailCampaign[];
    },
  });
  useEffect(() => {
    if (!current) return;
    const ch = supabase
      .channel(`em-camp:${current.id}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "email_campaigns", filter: `workspace_id=eq.${current.id}` },
        () => qc.invalidateQueries({ queryKey: ["email-campaigns", current.id] }))
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [current, qc]);
  return q;
}

export function useEmailLists() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["email-lists", current?.id],
    enabled: !!current,
    staleTime: 30_000,
    queryFn: async (): Promise<EmailList[]> => {
      const { data, error } = await supabase
        .from("email_lists")
        .select("*")
        .eq("workspace_id", current!.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as EmailList[];
    },
  });
  useEffect(() => {
    if (!current) return;
    const ch = supabase
      .channel(`em-lists:${current.id}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "email_lists", filter: `workspace_id=eq.${current.id}` },
        () => qc.invalidateQueries({ queryKey: ["email-lists", current.id] }))
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [current, qc]);
  return q;
}

export function useEmailTemplates() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["email-templates", current?.id],
    enabled: !!current,
    staleTime: 60_000,
    queryFn: async (): Promise<EmailTemplate[]> => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .eq("workspace_id", current!.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as EmailTemplate[];
    },
  });
}

export function useListMembers(listId: string | null) {
  return useQuery({
    queryKey: ["email-list-members", listId],
    enabled: !!listId,
    staleTime: 30_000,
    queryFn: async (): Promise<EmailListMember[]> => {
      const { data, error } = await supabase
        .from("email_list_members")
        .select("*")
        .eq("list_id", listId!)
        .order("subscribed_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as EmailListMember[];
    },
  });
}

export function useCampaignRecipients(campaignId: string | null) {
  return useQuery({
    queryKey: ["email-recipients", campaignId],
    enabled: !!campaignId,
    queryFn: async (): Promise<EmailRecipient[]> => {
      const { data, error } = await supabase
        .from("email_recipients")
        .select("*")
        .eq("campaign_id", campaignId!)
        .order("sent_at", { ascending: false, nullsFirst: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as EmailRecipient[];
    },
  });
}

export function useCampaignEvents(campaignId: string | null) {
  return useQuery({
    queryKey: ["email-events", campaignId],
    enabled: !!campaignId,
    queryFn: async (): Promise<EmailEvent[]> => {
      const { data, error } = await supabase
        .from("email_events")
        .select("*")
        .eq("campaign_id", campaignId!)
        .order("occurred_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as EmailEvent[];
    },
  });
}

export function useEmailSuppressions() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["email-suppressions", current?.id],
    enabled: !!current,
    staleTime: 60_000,
    queryFn: async (): Promise<EmailSuppression[]> => {
      const { data, error } = await supabase
        .from("email_suppressions")
        .select("*")
        .eq("workspace_id", current!.id)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as EmailSuppression[];
    },
  });
}

/* ============ Mutations ============ */

export function useCreateCampaign() {
  const { current } = useWorkspace();
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<EmailCampaign>) => {
      const { data, error } = await supabase
        .from("email_campaigns")
        .insert({
          workspace_id: current!.id,
          created_by: user!.id,
          status: "draft",
          ...payload,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-campaigns", current?.id] });
      toast.success("Campanha criada");
    },
    onError: (e: any) => toast.error("Erro ao criar campanha", { description: e?.message }),
  });
}

export function useUpdateCampaign() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<EmailCampaign> }) => {
      const { error } = await supabase.from("email_campaigns").update(patch as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-campaigns", current?.id] }),
    onError: (e: any) => toast.error("Erro ao atualizar", { description: e?.message }),
  });
}

export function useSendCampaign() {
  const qc = useQueryClient();
  const { current } = useWorkspace();
  return useMutation({
    mutationFn: async (campaign_id: string) => {
      const { data, error } = await supabase.functions.invoke("email-send", { body: { campaign_id } });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-campaigns", current?.id] });
      toast.success("Disparo iniciado");
    },
    onError: (e: any) => toast.error("Erro ao enviar", { description: e?.message }),
  });
}

export function useCreateList() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; description?: string; source: EmailList["source"] }) => {
      const { data, error } = await supabase
        .from("email_lists")
        .insert({ workspace_id: current!.id, ...payload } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-lists", current?.id] });
      toast.success("Lista criada");
    },
    onError: (e: any) => toast.error("Erro ao criar lista", { description: e?.message }),
  });
}

export function useDeleteList() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("email_lists").update({ deleted_at: new Date().toISOString() } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-lists", current?.id] }),
  });
}

export function useAddListMembers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ list_id, members }: { list_id: string; members: { email: string; contact_id?: string | null }[] }) => {
      const rows = members.map((m) => ({ list_id, email: m.email, contact_id: m.contact_id ?? null, status: "subscribed", subscribed_at: new Date().toISOString() }));
      const { error } = await supabase.from("email_list_members").insert(rows as any);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["email-list-members", vars.list_id] });
      toast.success("Contatos adicionados");
    },
    onError: (e: any) => toast.error("Erro ao adicionar", { description: e?.message }),
  });
}

export function useCreateTemplate() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<EmailTemplate>) => {
      const { data, error } = await supabase
        .from("email_templates")
        .insert({ workspace_id: current!.id, ...payload } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-templates", current?.id] });
      toast.success("Template salvo");
    },
    onError: (e: any) => toast.error("Erro ao salvar", { description: e?.message }),
  });
}

export function useUpdateTemplate() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<EmailTemplate> }) => {
      const { error } = await supabase.from("email_templates").update(patch as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-templates", current?.id] }),
  });
}

export function useDeleteTemplate() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("email_templates").update({ deleted_at: new Date().toISOString() } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-templates", current?.id] }),
  });
}

/* ============ Helpers ============ */

export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|div|h\d|br|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export function statusColor(s: EmailCampaign["status"]): string {
  switch (s) {
    case "draft": return "bg-muted text-muted-foreground";
    case "scheduled": return "bg-sky-500/15 text-sky-500 border-sky-500/40";
    case "sending": return "bg-amber-500/15 text-amber-500 border-amber-500/40 animate-pulse";
    case "sent": return "bg-emerald-500/15 text-emerald-500 border-emerald-500/40";
    case "failed": return "bg-rose-500/15 text-rose-500 border-rose-500/40";
  }
}

export function statusLabel(s: EmailCampaign["status"]): string {
  return { draft: "Rascunho", scheduled: "Agendada", sending: "Enviando", sent: "Enviada", failed: "Falhou" }[s];
}
