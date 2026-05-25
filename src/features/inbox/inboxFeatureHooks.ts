import { useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { toast } from "sonner";

/* ------------------ Notas internas ------------------ */
export type ConversationNote = {
  id: string;
  conversation_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

export function useConversationNotes(conversationId: string | null) {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["conv-notes", conversationId],
    enabled: !!conversationId && !!current,
    queryFn: async (): Promise<ConversationNote[]> => {
      const { data, error } = await supabase
        .from("conversation_notes")
        .select("*")
        .eq("conversation_id", conversationId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ConversationNote[];
    },
  });
  useEffect(() => {
    if (!conversationId) return;
    const ch = supabase
      .channel(`notes:${conversationId}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_notes", filter: `conversation_id=eq.${conversationId}` },
        () => qc.invalidateQueries({ queryKey: ["conv-notes", conversationId] }))
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [conversationId, qc]);
  return q;
}

export function useAddNote() {
  const { current } = useWorkspace();
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { conversation_id: string; body: string }) => {
      if (!current || !user) throw new Error("no session");
      const { error } = await supabase.from("conversation_notes").insert({
        workspace_id: current.id,
        conversation_id: v.conversation_id,
        author_id: user.id,
        body: v.body,
      });
      if (error) throw error;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["conv-notes", v.conversation_id] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ------------------ Mensagens agendadas ------------------ */
export type ScheduledMessage = {
  id: string;
  conversation_id: string;
  payload: { body?: string };
  scheduled_for: string;
  status: string;
  created_at: string;
};

export function useScheduledMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ["sched-msgs", conversationId],
    enabled: !!conversationId,
    queryFn: async (): Promise<ScheduledMessage[]> => {
      const { data, error } = await supabase
        .from("scheduled_messages")
        .select("*")
        .eq("conversation_id", conversationId!)
        .in("status", ["pending"])
        .order("scheduled_for", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ScheduledMessage[];
    },
  });
}

export function useScheduleMessage() {
  const { current } = useWorkspace();
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      conversation_id: string;
      contact_id: string;
      channel_id: string;
      body: string;
      scheduled_for: string;
    }) => {
      if (!current || !user) throw new Error("no session");
      const { error } = await supabase.from("scheduled_messages").insert({
        workspace_id: current.id,
        conversation_id: v.conversation_id,
        contact_id: v.contact_id,
        channel_id: v.channel_id,
        created_by: user.id,
        message_type: "text",
        payload: { body: v.body },
        scheduled_for: v.scheduled_for,
      });
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      toast.success("Mensagem agendada");
      qc.invalidateQueries({ queryKey: ["sched-msgs", v.conversation_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCancelScheduled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("scheduled_messages").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sched-msgs"] }); toast.success("Agendamento cancelado"); },
  });
}

/* ------------------ Respostas rápidas ------------------ */
export type QuickReply = {
  id: string;
  title: string;
  shortcut: string | null;
  message_type: string;
  payload: { body?: string; [key: string]: unknown };
};

export function useQuickReplies() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["quick-replies", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<QuickReply[]> => {
      const { data, error } = await supabase
        .from("quick_replies")
        .select("id,title,shortcut,message_type,payload")
        .is("archived_at", null)
        .order("title", { ascending: true });
      if (error) throw error;
      return (data ?? []) as QuickReply[];
    },
  });
}

/* ------------------ Playbooks ------------------ */
export type Playbook = { id: string; name: string; description: string | null };

export function usePlaybooks() {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["playbooks", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<Playbook[]> => {
      const { data, error } = await supabase
        .from("playbooks")
        .select("id,name,description")
        .is("archived_at", null)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Playbook[];
    },
  });
}

export function useStartCadence() {
  const { current } = useWorkspace();
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { conversation_id: string; playbook_id: string; contact_id: string; channel_id: string }) => {
      if (!current || !user) throw new Error("no session");
      // cria run
      const { data: run, error: rErr } = await supabase.from("cadence_runs").insert({
        workspace_id: current.id,
        conversation_id: v.conversation_id,
        playbook_id: v.playbook_id,
        started_by: user.id,
      }).select().single();
      if (rErr) throw rErr;

      // agenda os passos
      const { data: steps } = await supabase
        .from("playbook_steps").select("position, message_type, payload, delay_minutes")
        .eq("playbook_id", v.playbook_id).order("position");
      let acc = 0;
      const now = Date.now();
      const rows = (steps ?? []).map((s: any) => {
        acc += s.delay_minutes ?? 0;
        return {
          workspace_id: current.id,
          conversation_id: v.conversation_id,
          contact_id: v.contact_id,
          channel_id: v.channel_id,
          created_by: user.id,
          message_type: s.message_type,
          payload: s.payload,
          scheduled_for: new Date(now + acc * 60_000).toISOString(),
        };
      });
      if (rows.length) {
        const { error: sErr } = await supabase.from("scheduled_messages").insert(rows);
        if (sErr) throw sErr;
      }
      return run;
    },
    onSuccess: (_, v) => {
      toast.success("Cadência iniciada");
      qc.invalidateQueries({ queryKey: ["sched-msgs", v.conversation_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ------------------ Reatribuir conversa ------------------ */
export function useAssignConversation() {
  const qc = useQueryClient();
  const { current } = useWorkspace();
  return useMutation({
    mutationFn: async (v: { conversation_id: string; user_id: string | null }) => {
      const { error } = await supabase.rpc("assign_conversation", {
        p_conversation: v.conversation_id, p_user: v.user_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Responsável atualizado");
      qc.invalidateQueries({ queryKey: ["conversations", current?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ------------------ Atualizar status da conversa ------------------ */
export function useUpdateConversationStatus() {
  const qc = useQueryClient();
  const { current } = useWorkspace();
  return useMutation({
    mutationFn: async (v: { conversation_id: string; status: string }) => {
      const { error } = await supabase
        .from("conversations")
        .update({ status: v.status })
        .eq("id", v.conversation_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations", current?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ------------------ Análise IA ------------------ */
export type AIAnalysis = {
  id: string;
  summary: string | null;
  score: number | null;
  strengths: string[] | null;
  improvements: string[] | null;
  next_actions: string[] | null;
  created_at: string;
};

export function useAIAnalyses(conversationId: string | null) {
  return useQuery({
    queryKey: ["ai-an", conversationId],
    enabled: !!conversationId,
    queryFn: async (): Promise<AIAnalysis[]> => {
      const { data, error } = await supabase
        .from("conversation_ai_analyses")
        .select("id,summary,score,strengths,improvements,next_actions,created_at")
        .eq("conversation_id", conversationId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AIAnalysis[];
    },
  });
}

export function useRunAIAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (conversation_id: string) => {
      const { data, error } = await supabase.functions.invoke("analyze-conversation", {
        body: { conversation_id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, id) => {
      toast.success("Análise gerada");
      qc.invalidateQueries({ queryKey: ["ai-an", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ------------------ Deal vinculado ao contato ------------------ */
export function useContactDeal(contactId: string | null) {
  return useQuery({
    queryKey: ["contact-deal", contactId],
    enabled: !!contactId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("id,title,stage_id,value_cents,currency,assigned_to,notes,status")
        .eq("contact_id", contactId!)
        .is("deleted_at", null)
        .is("archived_at", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
