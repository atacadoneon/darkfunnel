import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";

/**
 * Descobre o conversationId mais recente para um lead (lead === contato).
 * Usa workspace atual + contact_id, ordenando por last_message_at desc.
 */
export function useLeadConversation(leadId: string | null | undefined) {
  const { current: ws } = useWorkspace();
  return useQuery({
    queryKey: ["lead-conversation", leadId, ws?.id],
    enabled: !!leadId && !!ws,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await (supabase as any)
        .from("conversations")
        .select("id")
        .eq("workspace_id", ws!.id)
        .eq("contact_id", leadId)
        .is("deleted_at", null)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return (data?.id as string) ?? null;
    },
  });
}
