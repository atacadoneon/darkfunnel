import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import type { Meeting, MeetingInput } from "@/types/meeting";

export function useMeetings() {
  const { current } = useWorkspace();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["meetings", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<Meeting[]> => {
      const { data, error } = await supabase
        .from("meetings")
        .select("*")
        .eq("workspace_id", current!.id)
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Meeting[];
    },
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!current) return;
    const ch = supabase
      .channel(`meetings:${current.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meetings", filter: `workspace_id=eq.${current.id}` },
        () => qc.invalidateQueries({ queryKey: ["meetings", current.id] })
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [current, qc]);

  return query;
}

export function useMeetingMutations() {
  const qc = useQueryClient();
  const { current } = useWorkspace();
  const { user } = useAuth();

  const invalidate = () => qc.invalidateQueries({ queryKey: ["meetings", current?.id] });

  const create = useMutation({
    mutationFn: async (input: MeetingInput) => {
      if (!current || !user) throw new Error("Workspace ou usuário não encontrado");
      const payload = {
        workspace_id: current.id,
        organizer_id: user.id,
        title: input.title ?? "Nova reunião",
        description: input.description ?? null,
        starts_at: input.starts_at ?? new Date().toISOString(),
        ends_at: input.ends_at ?? new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        location: input.location ?? null,
        meeting_url: input.meeting_url ?? null,
        contact_id: input.contact_id ?? null,
        deal_id: input.deal_id ?? null,
        attendees: input.attendees ?? [],
        status: input.status ?? "scheduled",
      };
      const { data, error } = await supabase.from("meetings").insert(payload).select("*").single();
      if (error) throw error;
      return data as Meeting;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: MeetingInput }) => {
      const { data, error } = await supabase.from("meetings").update(patch).eq("id", id).select("*").single();
      if (error) throw error;
      return data as Meeting;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meetings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
