import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Plus, KanbanSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useDeals, useStages, type Deal } from "@/features/pipeline/hooks";
import { StageColumn } from "@/features/pipeline/StageColumn";
import { DealCard } from "@/features/pipeline/DealCard";
import { DealDialog } from "@/features/pipeline/DealDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { toast } from "sonner";

export default function Pipeline() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const { data: stages = [], isLoading: loadingStages } = useStages();
  const { data: deals = [], isLoading: loadingDeals } = useDeals();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [defaultStageId, setDefaultStageId] = useState<string | undefined>();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const dealsByStage = useMemo(() => {
    const m: Record<string, Deal[]> = {};
    for (const s of stages) m[s.id] = [];
    for (const d of deals) (m[d.stage_id] ??= []).push(d);
    return m;
  }, [deals, stages]);

  const activeDeal = activeId ? deals.find((d) => d.id === activeId) ?? null : null;

  const onAddDeal = (stageId: string) => {
    setEditingDeal(null);
    setDefaultStageId(stageId);
    setDialogOpen(true);
  };

  const onOpenDeal = (deal: Deal) => {
    setEditingDeal(deal);
    setDefaultStageId(undefined);
    setDialogOpen(true);
  };

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || !current) return;

    const dragged = deals.find((d) => d.id === active.id);
    if (!dragged) return;

    // resolve target stage
    const overData = over.data.current as { type?: string; stage?: { id: string }; deal?: Deal } | undefined;
    let targetStageId = dragged.stage_id;
    if (overData?.type === "stage" && overData.stage) targetStageId = overData.stage.id;
    else if (overData?.type === "deal" && overData.deal) targetStageId = overData.deal.stage_id;

    if (targetStageId === dragged.stage_id) return;

    // optimistic update
    qc.setQueryData<Deal[]>(["deals", current.id], (old) =>
      (old ?? []).map((d) => (d.id === dragged.id ? { ...d, stage_id: targetStageId } : d))
    );

    const { error } = await supabase
      .from("deals")
      .update({ stage_id: targetStageId })
      .eq("id", dragged.id);

    if (error) {
      toast.error("Falha ao mover: " + error.message);
      qc.invalidateQueries({ queryKey: ["deals", current.id] });
    }
  };

  if (loadingStages || loadingDeals) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando pipeline...</div>;
  }

  if (stages.length === 0) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Card className="p-10 text-center border-dashed">
          <KanbanSquare className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold">Pipeline ainda não configurado</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Rode a migration <code className="text-xs bg-muted px-1 py-0.5 rounded">crm_pipeline_migration.sql</code>{" "}
            no SQL Editor do Supabase. Ela cria as tabelas <em>pipeline_stages</em> e <em>deals</em> e
            popula 6 etapas padrão para cada workspace existente.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            {deals.length} negócios · arraste cards entre etapas
          </p>
        </div>
        <Button onClick={() => onAddDeal(stages[0].id)}>
          <Plus className="h-4 w-4 mr-2" /> Novo negócio
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-x-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <div className="flex gap-3 p-4 h-full">
            {stages.map((s) => (
              <StageColumn
                key={s.id}
                stage={s}
                deals={dealsByStage[s.id] ?? []}
                onAddDeal={onAddDeal}
                onOpenDeal={onOpenDeal}
              />
            ))}
          </div>
          <DragOverlay>{activeDeal && <DealCard deal={activeDeal} overlay />}</DragOverlay>
        </DndContext>
      </div>

      <DealDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        stages={stages}
        deal={editingDeal}
        defaultStageId={defaultStageId}
      />
    </div>
  );
}
