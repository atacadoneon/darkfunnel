import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useIsAdmin } from "@/features/workspace/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Lock } from "lucide-react";
import type { Tag } from "@/features/inbox/filterHooks";
import { useTags } from "@/features/inbox/filterHooks";

const COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#6366f1", "#a855f7", "#ec4899", "#64748b",
];

export function TagsAdminSection() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();
  const { data: tags = [] } = useTags();

  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[5]);
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!current || !name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("workspace_tags").insert({
      workspace_id: current.id,
      name: name.trim(),
      color,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Tag criada");
    setName("");
    qc.invalidateQueries({ queryKey: ["tags", current.id] });
  };

  const remove = async (t: Tag) => {
    if (!confirm(`Excluir a tag "${t.name}"? Ela será removida de todos os contatos.`)) return;
    const { error } = await supabase.from("workspace_tags").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success("Tag removida");
    qc.invalidateQueries({ queryKey: ["tags", current!.id] });
  };

  return (
    <Card className="p-5 space-y-4">
      <div>
        <h3 className="font-semibold">Tags</h3>
        <p className="text-xs text-muted-foreground">
          Cadastro prévio de tags. Ao editar contatos, somente estas tags poderão ser aplicadas.
        </p>
      </div>

      {!isAdmin && (
        <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs">
          <Lock className="h-3.5 w-3.5" /> Somente administradores podem criar ou remover tags.
        </div>
      )}

      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da tag"
            className="h-9 max-w-xs"
          />
          <div className="flex items-center gap-1">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-6 w-6 rounded-full border-2 transition ${
                  color === c ? "border-foreground scale-110" : "border-transparent"
                }`}
                style={{ background: c }}
                aria-label={c}
              />
            ))}
          </div>
          <Button size="sm" onClick={create} disabled={saving || !name.trim()}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
          </Button>
        </div>
      )}

      {tags.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Nenhuma tag cadastrada.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <Badge key={t.id} variant="outline" className="gap-1.5 py-1 pl-2 pr-1">
              <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
              {t.name}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => remove(t)}
                  className="ml-1 text-muted-foreground hover:text-destructive"
                  aria-label="Remover"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
    </Card>
  );
}

// ============ Loss reasons ============

export type LossReason = {
  id: string;
  workspace_id: string;
  name: string;
  active: boolean;
  created_at: string;
};

export function useLossReasons(activeOnly = false) {
  const { current } = useWorkspace();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["loss-reasons", current?.id, activeOnly],
    enabled: !!current,
    queryFn: async (): Promise<LossReason[]> => {
      let query = supabase
        .from("loss_reasons")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (activeOnly) query = query.eq("active", true);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as LossReason[];
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!current) return;
    const ch = supabase
      .channel(`lr:${current.id}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "loss_reasons", filter: `workspace_id=eq.${current.id}` },
        () => qc.invalidateQueries({ queryKey: ["loss-reasons", current.id] })
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [current, qc]);

  return q;
}

export function LossReasonsAdminSection() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();
  const { data: reasons = [] } = useLossReasons();

  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!current || !name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("loss_reasons").insert({
      workspace_id: current.id,
      name: name.trim(),
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Motivo cadastrado");
    setName("");
    qc.invalidateQueries({ queryKey: ["loss-reasons", current.id] });
  };

  const toggle = async (r: LossReason) => {
    const { error } = await supabase
      .from("loss_reasons")
      .update({ active: !r.active })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["loss-reasons", current!.id] });
  };

  const remove = async (r: LossReason) => {
    if (!confirm(`Excluir o motivo "${r.name}"?`)) return;
    const { error } = await supabase.from("loss_reasons").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Motivo removido");
    qc.invalidateQueries({ queryKey: ["loss-reasons", current!.id] });
  };

  return (
    <Card className="p-5 space-y-4">
      <div>
        <h3 className="font-semibold">Motivos de perda</h3>
        <p className="text-xs text-muted-foreground">
          Cadastro prévio. Ao marcar um negócio como perdido, o vendedor escolherá um destes motivos.
        </p>
      </div>

      {!isAdmin && (
        <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs">
          <Lock className="h-3.5 w-3.5" /> Somente administradores podem gerenciar motivos.
        </div>
      )}

      {isAdmin && (
        <div className="flex items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Sem orçamento, Concorrente..."
            className="h-9 max-w-md"
          />
          <Button size="sm" onClick={create} disabled={saving || !name.trim()}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
          </Button>
        </div>
      )}

      {reasons.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Nenhum motivo cadastrado.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {reasons.map((r) => (
            <li key={r.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span className={r.active ? "" : "text-muted-foreground line-through"}>{r.name}</span>
              {!r.active && <Badge variant="outline" className="text-[10px]">inativo</Badge>}
              {isAdmin && (
                <div className="ml-auto flex items-center gap-1">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => toggle(r)}>
                    {r.active ? "Desativar" : "Ativar"}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(r)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
