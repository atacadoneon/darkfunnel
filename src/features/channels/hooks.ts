import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";

export type ChannelKind = "uazapi" | "whatsapp_cloud";
export type ChannelStatus =
  | "pending"
  | "qr_pending"
  | "connected"
  | "disconnected"
  | "banned"
  | "expired";

export type ChannelRow = {
  id: string;
  workspace_id: string;
  kind: ChannelKind;
  display_name: string;
  phone_e164: string | null;
  status: ChannelStatus;
  policy: "transactional" | "marketing" | "support" | "sales";
  daily_outbound_limit: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export function useChannels() {
  const { current } = useWorkspace();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["channels", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<ChannelRow[]> => {
      const { data, error } = await supabase
        .from("channels")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ChannelRow[];
    },
  });

  useEffect(() => {
    if (!current) return;
    const ch = supabase
      .channel(`channels:${current.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "channels", filter: `workspace_id=eq.${current.id}` },
        () => qc.invalidateQueries({ queryKey: ["channels", current.id] })
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [current, qc]);

  return query;
}
