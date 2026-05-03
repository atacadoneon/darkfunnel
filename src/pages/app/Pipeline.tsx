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
import {
  Plus,
  KanbanSquare,
  Settings as SettingsIcon,
  Upload,
  ChevronDown,
  Search,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useDeals, useStages, type Deal } from "@/features/pipeline/hooks";
import { StageColumn } from "@/features/pipeline/StageColumn";
import { DealCard } from "@/features/pipeline/DealCard";
import { DealDialog } from "@/features/pipeline/DealDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Contacts from "@/pages/app/Contacts";

type Tab = "funil" | "banco" | "dashboard";

export default function Pipeline() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const { data: stages = [], isLoading: loadingStages } = useStages();
  const { data: deals = [], isLoading: loadingDeals } = useDeals();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [defaultStageId, setDefaultStageId] = useState<string | undefined>();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("funil");
  const [search, setSearch] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const filteredDeals = useMemo(() => {
    if (!search.trim()) return deals;
    const q = search.toLowerCase();
    return deals.filter((d) => d.title.toLowerCase().includes(q));
  }, [deals, search]);

  const dealsByStage = useMemo(() => {
    const m: Record<string, Deal[]> = {};
    for (const s of stages) m[s.id] = [];
    for (const d of filteredDeals) (m[d.stage_id] ??= []).push(d);
    return m;
  }, [filteredDeals, stages]);

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

    const overData = over.data.current as { type?: string; stage?: { id: string }; deal?: Deal } | undefined;
    let targetStageId = dragged.stage_id;
    if (overData?.type === "stage" && overData.stage) targetStageId = overData.stage.id;
    else if (overData?.type === "deal" && overData.deal) targetStageId = overData.deal.stage_id;

    if (targetStageId === dragged.stage_id) return;

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
            no SQL Editor do Supabase.
          </p>
        </Card>
      </div>
    );
  }

  const wsName = current?.name ?? "Workspace";
  const totalLeads = deals.length;

  return (
    <div className="flex flex-col h-full">
      {/* Header card */}
      <div className="px-4 md:px-6 pt-4 md:pt-6">
        <Card className="p-4 md:p-5 bg-gradient-to-br from-primary/5 via-background to-background">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg shrink-0">
              {wsName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">{wsName}</h1>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground border">
                  {totalLeads} {totalLeads === 1 ? "lead" : "leads"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Users className="h-3 w-3" /> CRM · Gestão de Leads
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <Button variant="outline" className="flex-1 justify-between font-medium">
              <span className="flex items-center gap-2">
                <KanbanSquare className="h-4 w-4" />
                {wsName}
              </span>
              <ChevronDown className="h-4 w-4 opacity-60" />
            </Button>
            <Button size="icon" onClick={() => onAddDeal(stages[0].id)} aria-label="Novo negócio">
              <Plus className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="outline" aria-label="Configurações do funil">
              <SettingsIcon className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="outline" aria-label="Importar">
              <Upload className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="px-4 md:px-6 pt-4">
        <div className="grid grid-cols-3 bg-muted/60 rounded-lg p-1">
          {(["funil", "banco", "dashboard"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "py-2 text-sm font-medium rounded-md capitalize transition-colors",
                tab === t
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Search + Filters */}
      <div className="px-4 md:px-6 pt-4 pb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar leads..."
            className="pl-9 h-10 rounded-lg"
          />
        </div>
        <Button variant="outline" className="h-10 gap-2">
          <SlidersHorizontal className="h-4 w-4" />
          Filtros
        </Button>
      </div>

      {/* Kanban */}
      {tab === "funil" && (
        <div className="flex-1 min-h-0 overflow-x-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          >
            <div className="flex gap-3 px-4 md:px-6 pb-6 h-full">
              {stages.map((s) => (
                <StageColumn
                  key={s.id}
                  stage={s}
                  deals={dealsByStage[s.id] ?? []}
                  totalDeals={deals.filter((d) => d.stage_id === s.id).length}
                  onAddDeal={onAddDeal}
                  onOpenDeal={onOpenDeal}
                />
              ))}
            </div>
            <DragOverlay>{activeDeal && <DealCard deal={activeDeal} overlay />}</DragOverlay>
          </DndContext>
        </div>
      )}

      {tab === "banco" && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <Contacts />
        </div>
      )}
      {tab === "dashboard" && (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Dashboard do funil · em breve
        </div>
      )}

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
