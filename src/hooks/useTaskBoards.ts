import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useAuth } from "@/features/auth/AuthProvider";

export type TaskBoard = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  background_color: string | null;
  cover_image_url: string | null;
  archived_at: string | null;
  created_at: string;
  created_by: string | null;
  card_count?: number;
  done_count?: number;
};

export type TaskColumn = {
  id: string;
  board_id: string;
  name: string;
  color: string | null;
  sort_order: number;
  wip_limit: number | null;
  archived_at: string | null;
};

export type TaskCardLite = {
  id: string;
  board_id: string;
  column_id: string;
  title: string;
  description: string | null;
  position: number;
  cover_image_url: string | null;
  due_date: string | null;
  is_done: boolean | null;
  archived_at: string | null;
  labels?: { id: string; name: string; color: string }[];
  members?: { user_id: string; display_name?: string | null }[];
  checklist_total?: number;
  checklist_done?: number;
  attachments_count?: number;
  comments_count?: number;
};

const db = supabase as any;

/* ============ BOARDS ============ */

export function useTaskBoards(includeArchived = false) {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["task_boards", current?.id, includeArchived],
    enabled: !!current,
    queryFn: async (): Promise<TaskBoard[]> => {
      let q = db.from("task_boards").select("*").eq("workspace_id", current!.id).order("created_at", { ascending: false });
      if (!includeArchived) q = q.is("archived_at", null);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as TaskBoard[];
    },
  });
}

export function useCreateBoard() {
  const qc = useQueryClient();
  const { current } = useWorkspace();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { name: string; description?: string; background_color?: string; cover_image_url?: string; template?: string }) => {
      if (!current || !user) throw new Error("Sem workspace");
      const { data: board, error } = await db
        .from("task_boards")
        .insert({
          workspace_id: current.id,
          name: input.name,
          description: input.description ?? null,
          background_color: input.background_color ?? "#7c3aed",
          cover_image_url: input.cover_image_url ?? null,
          created_by: user.id,
        })
        .select("*")
        .single();
      if (error) throw error;

      const tpls: Record<string, string[]> = {
        vendas: ["Backlog", "Em Contato", "Proposta", "Ganhos", "Perdidos"],
        produto: ["Ideias", "A Fazer", "Em Andamento", "Em Review", "Concluido"],
        pessoal: ["A Fazer", "Hoje", "Em Andamento", "Concluido"],
        blank: ["A Fazer", "Em Andamento", "Concluido"],
      };
      const cols = tpls[input.template ?? "blank"] ?? tpls.blank;
      await db.from("task_columns").insert(
        cols.map((name, i) => ({ board_id: board.id, name, sort_order: i }))
      );
      return board as TaskBoard;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task_boards"] }),
  });
}

export function useUpdateBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<TaskBoard> }) => {
      const { error } = await db.from("task_boards").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task_boards"] }),
  });
}

export function useArchiveBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, archive }: { id: string; archive: boolean }) => {
      const { error } = await db.from("task_boards").update({ archived_at: archive ? new Date().toISOString() : null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task_boards"] }),
  });
}

export function useDuplicateBoard() {
  const qc = useQueryClient();
  const { current } = useWorkspace();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (boardId: string) => {
      const { data: original } = await db.from("task_boards").select("*").eq("id", boardId).single();
      if (!original) throw new Error("Board não encontrado");
      const { data: nb, error } = await db.from("task_boards").insert({
        workspace_id: current!.id,
        name: `${original.name} (cópia)`,
        description: original.description,
        background_color: original.background_color,
        cover_image_url: original.cover_image_url,
        created_by: user!.id,
      }).select("*").single();
      if (error) throw error;
      const { data: cols } = await db.from("task_columns").select("*").eq("board_id", boardId).order("sort_order");
      if (cols?.length) {
        await db.from("task_columns").insert(cols.map((c: any) => ({ board_id: nb.id, name: c.name, color: c.color, sort_order: c.sort_order, wip_limit: c.wip_limit })));
      }
      return nb;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task_boards"] }),
  });
}

/* ============ COLUMNS ============ */

export function useBoardColumns(boardId: string | undefined) {
  return useQuery({
    queryKey: ["task_columns", boardId],
    enabled: !!boardId,
    queryFn: async (): Promise<TaskColumn[]> => {
      const { data, error } = await db
        .from("task_columns")
        .select("*")
        .eq("board_id", boardId)
        .is("archived_at", null)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TaskColumn[];
    },
  });
}

export function useCreateColumn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ board_id, name, sort_order }: { board_id: string; name: string; sort_order: number }) => {
      const { error } = await db.from("task_columns").insert({ board_id, name, sort_order });
      if (error) throw error;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["task_columns", vars.board_id] }),
  });
}

export function useUpdateColumn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<TaskColumn> }) => {
      const { error } = await db.from("task_columns").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task_columns"] }),
  });
}

export function useArchiveColumn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("task_columns").update({ archived_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task_columns"] }),
  });
}

export function useReorderColumns() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cols: { id: string; sort_order: number }[]) => {
      await Promise.all(cols.map((c) => db.from("task_columns").update({ sort_order: c.sort_order }).eq("id", c.id)));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task_columns"] }),
  });
}

/* ============ CARDS ============ */

export function useBoardCards(boardId: string | undefined) {
  return useQuery({
    queryKey: ["task_cards", boardId],
    enabled: !!boardId,
    queryFn: async (): Promise<TaskCardLite[]> => {
      const { data, error } = await db
        .from("task_cards")
        .select("*")
        .eq("board_id", boardId)
        .is("archived_at", null)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TaskCardLite[];
    },
  });
}

export function useCreateCard() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ board_id, column_id, title, position }: { board_id: string; column_id: string; title: string; position: number }) => {
      const { error } = await db.from("task_cards").insert({
        board_id, column_id, title, position, created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["task_cards", vars.board_id] }),
  });
}

export function useUpdateCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<TaskCardLite> }) => {
      const { error } = await db.from("task_cards").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task_cards"] }),
  });
}

export function useMoveCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ card_id, column_id, position }: { card_id: string; column_id: string; position: number }) => {
      const { error } = await db.rpc("move_task_card", { card_id, col_id: column_id, position });
      if (error) {
        // fallback simples
        const { error: e2 } = await db.from("task_cards").update({ column_id, position }).eq("id", card_id);
        if (e2) throw e2;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task_cards"] }),
  });
}
