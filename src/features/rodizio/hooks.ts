import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";

export type LeadRotation = {
  id: string;
  workspace_id: string;
  channel_id: string | null;
  name: string;
  is_active: boolean;
  next_slot_id: string | null;
  created_at: string;
};

export type RotationSlot = {
  id: string;
  rotation_id: string;
  workspace_id: string;
  user_id: string;
  position: number;
  is_active: boolean;
  skip_if_offline: boolean;
  created_at: string;
};

export type RotationAssignment = {
  id: string;
  rotation_id: string;
  workspace_id: string;
  user_id: string;
  assigned_at: string;
};

export type PresenceRow = {
  user_id: string;
  status: "online" | "away" | "offline";
  last_seen_at: string | null;
};

export function useRotations() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["lead_rotations", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<LeadRotation[]> => {
      const { data, error } = await supabase
        .from("lead_rotations" as never)
        .select("*")
        .eq("workspace_id", current!.id)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as LeadRotation[];
    },
  });
  useEffect(() => {
    if (!current) return;
    const ch = supabase
      .channel(`lead_rotations:${current.id}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: "lead_rotations", filter: `workspace_id=eq.${current.id}` },
        () => qc.invalidateQueries({ queryKey: ["lead_rotations", current.id] }),
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [current, qc]);
  return q;
}

export function useRotationSlots(rotationId: string | null) {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["rotation_slots", rotationId],
    enabled: !!rotationId,
    queryFn: async (): Promise<RotationSlot[]> => {
      const { data, error } = await supabase
        .from("rotation_slots" as never)
        .select("*")
        .eq("rotation_id", rotationId!)
        .order("position");
      if (error) throw error;
      return (data ?? []) as unknown as RotationSlot[];
    },
  });
  useEffect(() => {
    if (!current) return;
    const ch = supabase
      .channel(`rotation_slots:${current.id}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: "rotation_slots", filter: `workspace_id=eq.${current.id}` },
        () => qc.invalidateQueries({ queryKey: ["rotation_slots", rotationId] }),
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [current, qc, rotationId]);
  return q;
}

export function useWorkspacePresence() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["workspace_user_presence", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<Record<string, PresenceRow>> => {
      const { data, error } = await supabase
        .from("workspace_user_presence" as never)
        .select("user_id,status,last_seen_at")
        .eq("workspace_id", current!.id);
      if (error) return {};
      const m: Record<string, PresenceRow> = {};
      for (const r of (data ?? []) as PresenceRow[]) m[r.user_id] = r;
      return m;
    },
  });
  useEffect(() => {
    if (!current) return;
    const ch = supabase
      .channel(`wup:${current.id}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: "workspace_user_presence", filter: `workspace_id=eq.${current.id}` },
        () => qc.invalidateQueries({ queryKey: ["workspace_user_presence", current.id] }),
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [current, qc]);
  return q;
}

export function useAssignmentsToday(rotationId: string | null) {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["rotation_assignments_today", rotationId],
    enabled: !!rotationId && !!current,
    queryFn: async (): Promise<RotationAssignment[]> => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("rotation_assignments" as never)
        .select("*")
        .eq("rotation_id", rotationId!)
        .gte("assigned_at", start.toISOString());
      if (error) return [];
      return (data ?? []) as unknown as RotationAssignment[];
    },
  });
  useEffect(() => {
    if (!current) return;
    const ch = supabase
      .channel(`ra:${current.id}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: "rotation_assignments", filter: `workspace_id=eq.${current.id}` },
        () => qc.invalidateQueries({ queryKey: ["rotation_assignments_today", rotationId] }),
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [current, qc, rotationId]);
  return q;
}

export async function createRotation(
  workspaceId: string,
  name: string,
  channelId: string | null = null,
) {
  const { data, error } = await supabase
    .from("lead_rotations" as never)
    .insert({
      workspace_id: workspaceId,
      channel_id: channelId,
      name,
      is_active: true,
      trigger_on: "first_inbound",
      respect_existing_owner: true,
    } as never)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as LeadRotation;
}

/** Garante uma rotation para o canal (cria se não existir) e retorna o id. */
export async function ensureRotationForChannel(
  workspaceId: string,
  channelId: string,
  name: string,
): Promise<LeadRotation> {
  const { data: existing } = await supabase
    .from("lead_rotations" as never)
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("channel_id", channelId)
    .maybeSingle();
  if (existing) return existing as unknown as LeadRotation;
  return createRotation(workspaceId, name, channelId);
}

export async function updateRotation(id: string, patch: Partial<Pick<LeadRotation, "name" | "is_active">>) {
  const { error } = await supabase.from("lead_rotations" as never).update(patch as never).eq("id", id);
  if (error) throw error;
}

export async function addSlot(rotationId: string, workspaceId: string, userId: string, position: number) {
  const { error } = await supabase.from("rotation_slots" as never).insert({
    rotation_id: rotationId,
    workspace_id: workspaceId,
    user_id: userId,
    position,
    is_active: true,
    skip_if_offline: true,
  } as never);
  if (error) throw error;
}

export async function updateSlot(id: string, patch: Partial<Pick<RotationSlot, "is_active" | "skip_if_offline" | "position">>) {
  const { error } = await supabase.from("rotation_slots" as never).update(patch as never).eq("id", id);
  if (error) throw error;
}

export async function deleteSlot(id: string) {
  const { error } = await supabase.from("rotation_slots" as never).delete().eq("id", id);
  if (error) throw error;
}

export async function reorderSlots(slots: { id: string; position: number }[]) {
  // best-effort sequential updates
  for (const s of slots) {
    const { error } = await supabase
      .from("rotation_slots" as never)
      .update({ position: s.position } as never)
      .eq("id", s.id);
    if (error) throw error;
  }
}
