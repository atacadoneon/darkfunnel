import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { X, Layers, User, CircleCheck, Megaphone, Tag as TagIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useDealSelection } from "./selection";
import type { Stage, Deal } from "./hooks";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useWorkspaceMembers } from "@/features/workspace/permissions";
import { useLeadOrigins } from "./configHooks";

type Props = { stages: Stage[]; deals: Deal[] };

async function bulkUpdate(ids: string[], patch: Record<string, any>) {
  const { error } = await supabase.from("deals").update(patch).in("id", ids);
  if (error) throw error;
}

export function BulkActionsBar({ stages, deals }: Props) {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const { selectedIds, clear, size } = useDealSelection();
  const { data: members = [] } = useWorkspaceMembers();
  const { data: origins = [] } = useLeadOrigins();
  const [lossOpen, setLossOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [lossReason, setLossReason] = useState("");

  const ids = Array.from(selectedIds);
  const lostStage = stages.find((s) => s.is_lost);
  const wonStage = stages.find((s) => s.is_won);

  const tagsQ = useQuery({
    queryKey: ["workspace-tags", current?.id, "deal"],
    enabled: !!current,
    queryFn: async () => {
      const { data } = await supabase.from("tags").select("id,name,color,entity_types")
        .eq("workspace_id", current!.id);
      return (data ?? []).filter((t: any) => !t.entity_types || t.entity_types.includes("deal") || t.entity_types.includes("lead"));
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["deals", current?.id] });

  const mut = useMutation({
    mutationFn: async (patch: Record<string, any>) => bulkUpdate(ids, patch),
    onSuccess: () => { invalidate(); toast.success(`${ids.length} atualizados`); clear(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const moveStage = (stageId: string) => mut.mutate({ stage_id: stageId });
  const assign = (uid: string | null) => mut.mutate({ assigned_to: uid });
  const setStatus = (status: "open" | "won" | "lost") => {
    if (status === "lost") { setLossOpen(true); return; }
    const patch: any = { status };
    if (status === "won" && wonStage) patch.stage_id = wonStage.id;
    mut.mutate(patch);
  };
  const setOrigin = (originId: string | null) => mut.mutate({ origin_id: originId });
  const softDelete = () => mut.mutate({ deleted_at: new Date().toISOString() });

  const addTag = async (tagId: string) => {
    try {
      const sel = deals.filter((d) => selectedIds.has(d.id));
      const rows = sel.filter((d) => d.contact_id).map((d) => ({
        workspace_id: current!.id, contact_id: d.contact_id, tag_id: tagId,
      }));
      if (rows.length === 0) { toast.warning("Nenhum contato vinculado"); return; }
      const { error } = await supabase.from("contact_tags").upsert(rows, { onConflict: "contact_id,tag_id" });
      if (error) throw error;
      toast.success("Tag aplicada"); invalidate(); clear();
    } catch (e: any) { toast.error(e.message); }
  };

  if (size === 0) return null;

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-primary text-primary-foreground rounded-full shadow-xl py-2 px-4 flex items-center gap-3">
        <button onClick={clear} className="hover:bg-primary-foreground/10 rounded-full p-1" title="Limpar seleção">
          <X className="h-4 w-4" />
        </button>
        <Badge variant="secondary" className="bg-primary-foreground text-primary font-bold uppercase">
          {size} selecionado{size > 1 ? "s" : ""}
        </Badge>

        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="ghost" className="hover:bg-primary-foreground/10 gap-1"><Layers className="h-4 w-4" />Etapa</Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-1">
            {stages.map((s) => (
              <button key={s.id} onClick={() => moveStage(s.id)}
                className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.name}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="ghost" className="hover:bg-primary-foreground/10 gap-1"><User className="h-4 w-4" />Dono</Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-1 max-h-64 overflow-y-auto">
            <button onClick={() => assign(null)} className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent text-muted-foreground">Remover dono</button>
            {members.map((m: any) => (
              <button key={m.user_id} onClick={() => assign(m.user_id)}
                className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent">
                {m.display_name ?? m.email}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="ghost" className="hover:bg-primary-foreground/10 gap-1"><CircleCheck className="h-4 w-4" />Status</Button>
          </PopoverTrigger>
          <PopoverContent className="w-44 p-1">
            <button onClick={() => setStatus("open")} className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent">Aberto</button>
            <button onClick={() => setStatus("won")} className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent text-green-600">Ganho</button>
            <button onClick={() => setStatus("lost")} className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent text-destructive">Perdido</button>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="ghost" className="hover:bg-primary-foreground/10 gap-1"><Megaphone className="h-4 w-4" />Origem</Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-1 max-h-64 overflow-y-auto">
            <button onClick={() => setOrigin(null)} className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent text-muted-foreground">Sem origem</button>
            {origins.map((o) => (
              <button key={o.id} onClick={() => setOrigin(o.id)}
                className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: o.color }} />{o.name}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="ghost" className="hover:bg-primary-foreground/10 gap-1"><TagIcon className="h-4 w-4" />Tag</Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-1 max-h-64 overflow-y-auto">
            {(tagsQ.data ?? []).length === 0 && <div className="px-2 py-3 text-xs text-muted-foreground">Nenhuma tag</div>}
            {(tagsQ.data ?? []).map((t: any) => (
              <button key={t.id} onClick={() => addTag(t.id)}
                className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: t.color ?? "#888" }} />{t.name}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <button onClick={() => setDeleteOpen(true)} className="hover:bg-destructive/30 rounded-full p-1.5" title="Excluir">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <AlertDialog open={lossOpen} onOpenChange={setLossOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar {size} como perdido</AlertDialogTitle>
            <AlertDialogDescription>Informe o motivo da perda (opcional).</AlertDialogDescription>
          </AlertDialogHeader>
          <Input placeholder="Motivo" value={lossReason} onChange={(e) => setLossReason(e.target.value)} />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              const patch: any = { status: "lost" };
              if (lostStage) patch.stage_id = lostStage.id;
              if (lossReason) patch.loss_reason = lossReason;
              mut.mutate(patch);
              setLossOpen(false); setLossReason("");
            }}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {size} deals?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação move os deals para a lixeira (soft delete).</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => { softDelete(); setDeleteOpen(false); }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
