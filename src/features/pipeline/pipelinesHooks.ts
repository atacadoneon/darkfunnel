import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { toast } from "sonner";

export type Pipeline = {
  id: string;
  name: string;
  is_default: boolean;
  position: number;
  category: string | null;
  archived_at?: string | null;
};

export function usePipelinesFull() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["pipelines-full", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<Pipeline[]> => {
      const { data, error } = await supabase
        .from("pipelines")
        .select("id,name,is_default,position,category,archived_at")
        .is("archived_at", null)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Pipeline[];
    },
  });
}

export function useCreatePipeline() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { name: string; category?: string | null }) => {
      if (!current) throw new Error("no ws");
      const { data: maxRow } = await supabase.from("pipelines").select("position")
        .eq("workspace_id", current.id).order("position", { ascending: false }).limit(1).maybeSingle();
      const pos = ((maxRow as any)?.position ?? 0) + 1;
      const { data, error } = await supabase.from("pipelines").insert({
        workspace_id: current.id, name: v.name, category: v.category ?? null, position: pos,
      }).select("id").single();
      if (error) throw error;
      return data?.id as string;
    },
    onSuccess: () => {
      toast.success("Pipeline criada");
      qc.invalidateQueries({ queryKey: ["pipelines-full", current?.id] });
      qc.invalidateQueries({ queryKey: ["pipelines", current?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdatePipeline() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; patch: Partial<Pipeline> }) => {
      const { error } = await supabase.from("pipelines").update(v.patch as any).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipelines-full", current?.id] });
      qc.invalidateQueries({ queryKey: ["pipelines", current?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useArchivePipeline() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pipelines")
        .update({ archived_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pipeline arquivada");
      qc.invalidateQueries({ queryKey: ["pipelines-full", current?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
