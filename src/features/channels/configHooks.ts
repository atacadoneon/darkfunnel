import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";

// ============= SETORES =============
export type Sector = { id: string; workspace_id: string; name: string; color: string | null };

export function useSectors() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["sectors", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<Sector[]> => {
      const { data, error } = await supabase
        .from("sectors")
        .select("id,workspace_id,name,color")
        .is("archived_at", null)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Sector[];
    },
  });
}

export function useCreateSector() {
  const qc = useQueryClient();
  const { current } = useWorkspace();
  return useMutation({
    mutationFn: async (name: string): Promise<Sector> => {
      if (!current) throw new Error("Workspace inválido");
      const { data, error } = await supabase
        .from("sectors")
        .insert({ workspace_id: current.id, name: name.trim() })
        .select("id,workspace_id,name,color")
        .single();
      if (error) throw error;
      return data as Sector;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sectors", current?.id] }),
  });
}

// ============= MEMBROS DO CANAL =============
export function useChannelMembers(channelId: string | null | undefined) {
  return useQuery({
    queryKey: ["channel-members", channelId],
    enabled: !!channelId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("channel_members")
        .select("user_id")
        .eq("channel_id", channelId!);
      if (error) throw error;
      return (data ?? []).map((r) => r.user_id);
    },
  });
}

export async function setChannelMembers(channelId: string, userIds: string[]) {
  const { error: delErr } = await supabase.from("channel_members").delete().eq("channel_id", channelId);
  if (delErr) throw delErr;
  if (userIds.length === 0) return;
  const rows = userIds.map((user_id) => ({ channel_id: channelId, user_id }));
  const { error } = await supabase.from("channel_members").insert(rows);
  if (error) throw error;
}

// ============= RODÍZIO =============
export type RotationSlot = {
  id: string;
  channel_id: string;
  position: number;
  target_type: "user" | "sector";
  user_id: string | null;
  sector_id: string | null;
  active: boolean;
  skip_when_offline: boolean;
};

export function useRotationSlots(channelId: string | null | undefined) {
  return useQuery({
    queryKey: ["rotation-slots", channelId],
    enabled: !!channelId,
    queryFn: async (): Promise<RotationSlot[]> => {
      const { data, error } = await supabase
        .from("channel_rotation_slots")
        .select("*")
        .eq("channel_id", channelId!)
        .order("position");
      if (error) throw error;
      return (data ?? []) as RotationSlot[];
    },
  });
}

export async function addRotationSlot(
  channelId: string,
  target: { type: "user"; user_id: string } | { type: "sector"; sector_id: string },
  position: number,
) {
  const payload = {
    channel_id: channelId,
    position,
    target_type: target.type,
    user_id: target.type === "user" ? target.user_id : null,
    sector_id: target.type === "sector" ? target.sector_id : null,
    active: true,
    skip_when_offline: false,
  };
  const { error } = await supabase.from("channel_rotation_slots").insert(payload);
  if (error) throw error;
}

export async function updateRotationSlot(id: string, patch: Partial<Pick<RotationSlot, "active" | "skip_when_offline" | "position">>) {
  const { error } = await supabase.from("channel_rotation_slots").update(patch).eq("id", id);
  if (error) throw error;
}

export async function removeRotationSlot(id: string) {
  const { error } = await supabase.from("channel_rotation_slots").delete().eq("id", id);
  if (error) throw error;
}
