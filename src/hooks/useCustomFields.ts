import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { toast } from "sonner";

export type EntityType = "lead" | "deal" | "contact" | "conversation" | "workspace" | "product";

export type FieldType =
  | "text" | "textarea" | "number" | "currency" | "date" | "datetime"
  | "boolean" | "select" | "multi_select" | "email" | "phone" | "url" | "file";

export type CustomFieldDefinition = {
  id: string;
  workspace_id: string;
  entity_type: EntityType;
  display_name: string;
  slug: string;
  field_type: FieldType;
  options: Array<{ label: string; value: string }> | null;
  is_required: boolean;
  default_value: any;
  show_in_list: boolean;
  show_in_drawer: boolean;
  position: number;
  deleted_at: string | null;
  created_at: string;
};

export type CustomFieldValue = {
  id: string;
  workspace_id: string;
  field_id: string;
  entity_type: EntityType;
  entity_id: string;
  value: any;
};

export function useCustomFieldDefs(entityType?: EntityType, opts?: { showInDrawer?: boolean; showInList?: boolean }) {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["cf-defs", current?.id, entityType, opts?.showInDrawer, opts?.showInList],
    enabled: !!current,
    queryFn: async (): Promise<CustomFieldDefinition[]> => {
      let q = supabase
        .from("custom_field_definitions" as any)
        .select("*")
        .eq("workspace_id", current!.id)
        .is("deleted_at", null)
        .order("position");
      if (entityType) q = q.eq("entity_type", entityType);
      if (opts?.showInDrawer) q = q.eq("show_in_drawer", true);
      if (opts?.showInList) q = q.eq("show_in_list", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any as CustomFieldDefinition[];
    },
  });
}

export function useUpsertCustomFieldDef() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: Partial<CustomFieldDefinition> & { display_name: string; entity_type: EntityType; field_type: FieldType; slug: string }) => {
      if (!current) throw new Error("no ws");
      const row: any = {
        workspace_id: current.id,
        entity_type: v.entity_type,
        display_name: v.display_name,
        slug: v.slug,
        field_type: v.field_type,
        options: v.options ?? null,
        is_required: v.is_required ?? false,
        default_value: v.default_value ?? null,
        show_in_list: v.show_in_list ?? false,
        show_in_drawer: v.show_in_drawer ?? true,
        position: v.position ?? 0,
      };
      if (v.id) {
        const { error } = await supabase.from("custom_field_definitions" as any).update(row).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("custom_field_definitions" as any).insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Campo salvo"); qc.invalidateQueries({ queryKey: ["cf-defs"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSoftDeleteCustomFieldDef() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("custom_field_definitions" as any)
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Campo removido"); qc.invalidateQueries({ queryKey: ["cf-defs"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCustomFieldValues(entityType: EntityType, entityId: string | null | undefined) {
  return useQuery({
    queryKey: ["cf-vals", entityType, entityId],
    enabled: !!entityId,
    queryFn: async (): Promise<CustomFieldValue[]> => {
      const { data, error } = await supabase
        .from("custom_field_values" as any)
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId!);
      if (error) throw error;
      return (data ?? []) as any as CustomFieldValue[];
    },
  });
}

export function useUpsertCustomFieldValue() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { field_id: string; entity_type: EntityType; entity_id: string; value: any }) => {
      if (!current) throw new Error("no ws");
      const { error } = await supabase
        .from("custom_field_values" as any)
        .upsert(
          { workspace_id: current.id, ...v, updated_at: new Date().toISOString() },
          { onConflict: "field_id,entity_id" }
        );
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["cf-vals", v.entity_type, v.entity_id] }),
    onError: (e: Error) => toast.error(e.message),
  });
}
