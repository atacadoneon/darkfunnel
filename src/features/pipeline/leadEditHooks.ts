import { useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { toast } from "sonner";

/* ---------------- Pipelines ---------------- */
export type Pipeline = { id: string; name: string; is_default: boolean; position: number };

export function usePipelines() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["pipelines", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<Pipeline[]> => {
      const { data, error } = await supabase
        .from("pipelines").select("id,name,is_default,position")
        .is("archived_at", null).order("position");
      if (error) throw error;
      return (data ?? []) as Pipeline[];
    },
  });
}

/* ---------------- Products catalog ---------------- */
export type Product = { id: string; name: string; default_value_cents: number };
export function useProducts() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["products", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase.from("workspace_products")
        .select("id,name,default_value_cents").is("archived_at", null).order("name");
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });
}

/* ---------------- History ---------------- */
export type DealHistoryRow = { id: string; field: string; old_value: string | null; new_value: string | null; created_at: string };
export function useDealHistory(dealId: string | null) {
  return useQuery({
    queryKey: ["deal-history", dealId],
    enabled: !!dealId,
    queryFn: async (): Promise<DealHistoryRow[]> => {
      const { data, error } = await supabase.from("deal_history")
        .select("id,field,old_value,new_value,created_at")
        .eq("deal_id", dealId!).order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return (data ?? []) as DealHistoryRow[];
    },
  });
}

/* ---------------- Purchases ---------------- */
export type Purchase = {
  id: string; product_name: string; description: string | null;
  value_cents: number; purchased_at: string; notes: string | null;
};
export function usePurchases(dealId: string | null) {
  return useQuery({
    queryKey: ["purchases", dealId],
    enabled: !!dealId,
    queryFn: async (): Promise<Purchase[]> => {
      const { data, error } = await supabase.from("deal_purchases")
        .select("id,product_name,description,value_cents,purchased_at,notes")
        .eq("deal_id", dealId!).order("purchased_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Purchase[];
    },
  });
}
export function useAddPurchase(dealId: string) {
  const { current } = useWorkspace(); const { user } = useAuth(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { product_name: string; description: string; value_cents: number; purchased_at: string; notes?: string }) => {
      if (!current) throw new Error("no ws");
      const { error } = await supabase.from("deal_purchases").insert({
        workspace_id: current.id, deal_id: dealId, created_by: user?.id, ...v,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["purchases", dealId] }); toast.success("Compra adicionada"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ---------------- Attachments ---------------- */
export type Attachment = { id: string; file_name: string; storage_path: string; mime_type: string | null; size_bytes: number | null; created_at: string };
export function useAttachments(dealId: string | null) {
  return useQuery({
    queryKey: ["attachments", dealId],
    enabled: !!dealId,
    queryFn: async (): Promise<Attachment[]> => {
      const { data, error } = await supabase.from("deal_attachments")
        .select("id,file_name,storage_path,mime_type,size_bytes,created_at")
        .eq("deal_id", dealId!).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Attachment[];
    },
  });
}
export function useUploadAttachment(dealId: string) {
  const { current } = useWorkspace(); const { user } = useAuth(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      if (!current) throw new Error("no ws");
      const path = `${current.id}/${dealId}/${Date.now()}-${file.name}`;
      const { error: uErr } = await supabase.storage.from("deal-attachments").upload(path, file);
      if (uErr) throw uErr;
      const { error } = await supabase.from("deal_attachments").insert({
        workspace_id: current.id, deal_id: dealId,
        file_name: file.name, storage_path: path, mime_type: file.type, size_bytes: file.size, uploaded_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["attachments", dealId] }); toast.success("Anexo enviado"); },
    onError: (e: Error) => toast.error(e.message),
  });
}
export function useDeleteAttachment(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (att: Attachment) => {
      await supabase.storage.from("deal-attachments").remove([att.storage_path]);
      const { error } = await supabase.from("deal_attachments").delete().eq("id", att.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["attachments", dealId] }); toast.success("Anexo removido"); },
    onError: (e: Error) => toast.error(e.message),
  });
}
export async function downloadAttachment(att: Attachment) {
  const { data, error } = await supabase.storage.from("deal-attachments").createSignedUrl(att.storage_path, 60);
  if (error) return toast.error(error.message);
  window.open(data.signedUrl, "_blank");
}

/* ---------------- Activities ---------------- */
export type Activity = {
  id: string; kind: string; title: string; description: string | null;
  scheduled_at: string | null; duration_minutes: number | null; done: boolean; created_at: string;
};
export function useActivities(dealId: string | null) {
  return useQuery({
    queryKey: ["activities", dealId],
    enabled: !!dealId,
    queryFn: async (): Promise<Activity[]> => {
      const { data, error } = await supabase.from("deal_activities")
        .select("id,kind,title,description,scheduled_at,duration_minutes,done,created_at")
        .eq("deal_id", dealId!).order("scheduled_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as Activity[];
    },
  });
}
export function useAddActivity(dealId: string) {
  const { current } = useWorkspace(); const { user } = useAuth(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { kind: string; title: string; description?: string; scheduled_at?: string | null; duration_minutes?: number | null }) => {
      if (!current) throw new Error("no ws");
      const { error } = await supabase.from("deal_activities").insert({
        workspace_id: current.id, deal_id: dealId, created_by: user?.id, ...v,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["activities", dealId] }); toast.success("Atividade adicionada"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ---------------- Custom fields ---------------- */
export type CustomField = { id: string; field_name: string; field_value: string | null };
export function useCustomFields(dealId: string | null) {
  return useQuery({
    queryKey: ["custom-fields", dealId],
    enabled: !!dealId,
    queryFn: async (): Promise<CustomField[]> => {
      const { data, error } = await supabase.from("deal_custom_fields")
        .select("id,field_name,field_value").eq("deal_id", dealId!).order("created_at");
      if (error) throw error;
      return (data ?? []) as CustomField[];
    },
  });
}
export function useUpsertCustomField(dealId: string) {
  const { current } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id?: string; field_name: string; field_value: string }) => {
      if (!current) throw new Error("no ws");
      if (v.id) {
        const { error } = await supabase.from("deal_custom_fields").update({ field_name: v.field_name, field_value: v.field_value }).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("deal_custom_fields").insert({
          workspace_id: current.id, deal_id: dealId, field_name: v.field_name, field_value: v.field_value,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom-fields", dealId] }),
    onError: (e: Error) => toast.error(e.message),
  });
}
export function useDeleteCustomField(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("deal_custom_fields").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom-fields", dealId] }),
  });
}

/* ---------------- ADS attribution ---------------- */
export type AdsAttribution = {
  source: string | null; campaign: string | null; medium: string | null;
  landing_page: string | null; gclid: string | null; fbclid: string | null; attributed_at: string | null;
};
export function useAdsAttribution(dealId: string | null) {
  return useQuery({
    queryKey: ["ads-att", dealId],
    enabled: !!dealId,
    queryFn: async (): Promise<AdsAttribution | null> => {
      const { data, error } = await supabase.from("deal_ads_attribution")
        .select("source,campaign,medium,landing_page,gclid,fbclid,attributed_at")
        .eq("deal_id", dealId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
