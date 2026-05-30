import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";

export type TagProduto = {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  entity_types: string[] | null;
  created_at: string;
};

export type TagProdutoInput = {
  id?: string;
  name: string;
  color: string;
};

export function useTagsProduto() {
  const { current } = useWorkspace();
  const workspaceId = current?.id;
  return useQuery({
    queryKey: ["tags-produto", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tags")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .contains("entity_types", ["product"])
        .order("name");
      if (error) throw error;
      return (data ?? []) as TagProduto[];
    },
  });
}

export function useUpsertTagProduto() {
  const qc = useQueryClient();
  const { current } = useWorkspace();
  return useMutation({
    mutationFn: async (tag: TagProdutoInput) => {
      if (tag.id) {
        const { data, error } = await supabase
          .from("tags")
          .update({ name: tag.name, color: tag.color })
          .eq("id", tag.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("tags")
        .insert({
          workspace_id: current?.id,
          name: tag.name,
          color: tag.color,
          entity_types: ["product"],
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags-produto"] }),
  });
}

export function useDeleteTagProduto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tags").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags-produto"] }),
  });
}
