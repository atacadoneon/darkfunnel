import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  DndContext, DragOverlay, PointerSensor, closestCorners, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import {
  Plus, KanbanSquare, Settings as SettingsIcon, Upload, ChevronDown, Search, SlidersHorizontal, Users,
  Tag as TagIcon, Layers, Megaphone, Package, Webhook, Timer, X, List,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useDeals, useStages, type Deal } from "@/features/pipeline/hooks";
import { StageColumn } from "@/features/pipeline/StageColumn";
import { DealCard } from "@/features/pipeline/DealCard";
import { DealDialog } from "@/features/pipeline/DealDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useWorkspaceMembers } from "@/features/workspace/permissions";
import { useLeadOrigins } from "@/features/pipeline/configHooks";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Contacts from "@/pages/app/Contacts";
import {
  StagesDialog, LossReasonsDialog, OriginsDialog, ProductsDialog, AutomationsDialog, CaptureDialog,
} from "@/features/pipeline/PipelineConfigDialogs";
import { FiltersSheet, EMPTY_FILTERS, applyFilters, countActive, type Filters } from "@/features/pipeline/PipelineFilters";
import { DealsTable } from "@/features/pipeline/DealsTable";
import { PipelineDashboard } from "@/features/pipeline/PipelineDashboard";
import { CsvImportDialog } from "@/features/pipeline/CsvImportDialog";

type Tab = "funil" | "banco" | "dashboard";
type ConfigKey = "stages" | "loss" | "origins" | "products" | "capture" | "automations" | null;

function parseFiltersFromURL(params: URLSearchParams): Filters {
  const arr = (k: string) => params.get(k)?.split(",").filter(Boolean) ?? [];
  return {
    assignees: arr("assignees"),
    origins: arr("origins"),
    stages: arr("stages"),
    status: arr("status") as any,
    showArchived: params.get("archived") === "1",
    minValue: params.get("min") ?? "",
    maxValue: params.get("max") ?? "",
    inactiveDays: params.get("inactive") ?? "any",
    createdFrom: params.get("from") ?? "",
    createdTo: params.get("to") ?? "",
    sort: (params.get("sort") as any) ?? "position",
  };
}
function writeFiltersToURL(prev: URLSearchParams, f: Filters): URLSearchParams {
  const next = new URLSearchParams(prev);
  const setOrDel = (k: string, v: string) => { if (v) next.set(k, v); else next.delete(k); };
  setOrDel("assignees", f.assignees.join(","));
  setOrDel("origins", f.origins.join(","));
  setOrDel("stages", f.stages.join(","));
  setOrDel("status", f.status.join(","));
  setOrDel("archived", f.showArchived ? "1" : "");
  setOrDel("min", f.minValue);
  setOrDel("max", f.maxValue);
  setOrDel("inactive", f.inactiveDays === "any" ? "" : f.inactiveDays);
  setOrDel("from", f.createdFrom);
  setOrDel("to", f.createdTo);
  setOrDel("sort", f.sort === "position" ? "" : f.sort);
  return next;
}

export default function Pipeline() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const { data: stages = [], isLoading: loadingStages } = useStages();
  const { data: members = [] } = useWorkspaceMembers();
  const { data: origins = [] } = useLeadOrigins();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [defaultStageId, setDefaultStageId] = useState<string | undefined>();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [params, setParams] = useSearchParams();
  const showArchived = params.get("archived") === "1";
  const { data: deals = [], isLoading: loadingDeals } = useDeals({ includeArchived: showArchived });
  const tab: Tab = "funil";
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [config, setConfig] = useState<ConfigKey>(null);
  const view = (params.get("view") as "kanban" | "list") || "kanban";
  const setView = (v: "kanban" | "list") => {
    const next = new URLSearchParams(params);
    if (v === "kanban") next.delete("view"); else next.set("view", v);
    setParams(next, { replace: true });
  };

  const filters = useMemo(() => parseFiltersFromURL(params), [params]);
  const setFilters = (f: Filters) => setParams(writeFiltersToURL(params, f), { replace: true });
  const activeFilters = countActive(filters);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const filteredDeals = useMemo(() => applyFilters(deals, filters, search), [deals, filters, search]);

  const dealsByStage = useMemo(() => {
    const m: Record<string, Deal[]> = {};
    for (const s of stages) m[s.id] = [];
    for (const d of filteredDeals) (m[d.stage_id] ??= []).push(d);
    return m;
  }, [filteredDeals, stages]);

  const activeDeal = activeId ? deals.find((d) => d.id === activeId) ?? null : null;
  const onAddDeal = (stageId: string) => { setEditingDeal(null); setDefaultStageId(stageId); setDialogOpen(true); };
  const onOpenDeal = (deal: Deal) => { setEditingDeal(deal); setDefaultStageId(undefined); setDialogOpen(true); };

  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent<{ dealId: string }>).detail?.dealId;
      if (!id) return;
      const d = deals.find((x) => x.id === id);
      if (d) onOpenDeal(d);
    };
    window.addEventListener("open-deal", handler as EventListener);
    return () => window.removeEventListener("open-deal", handler as EventListener);
  }, [deals]);

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
    qc.setQueryData<Deal[]>(["deals", current.id, { includeArchived: showArchived }], (old) =>
      (old ?? []).map((d) => (d.id === dragged.id ? { ...d, stage_id: targetStageId } : d)));
    const { error } = await supabase.from("deals").update({ stage_id: targetStageId }).eq("id", dragged.id);
    if (error) { toast.error("Falha ao mover: " + error.message); qc.invalidateQueries({ queryKey: ["deals", current.id] }); }
  };

  if (loadingStages || loadingDeals) return <div className="p-6 text-sm text-muted-foreground">Carregando pipeline...</div>;

  if (stages.length === 0) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Card className="p-10 text-center border-dashed">
          <KanbanSquare className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold">Pipeline ainda não configurado</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Rode a migration <code className="text-xs bg-muted px-1 py-0.5 rounded">sprints_full_migration.sql</code> no SQL Editor.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search + Filters */}
      <div className="px-4 md:px-6 pt-4 pb-3 flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar leads..." className="pl-9 h-10 rounded-lg" />
        </div>
        <Button variant="outline" className="h-10 gap-2 relative" onClick={() => setFiltersOpen(true)}>
          <SlidersHorizontal className="h-4 w-4" /> Filtros
          {activeFilters > 0 && (
            <Badge className="ml-1 h-5 px-1.5 rounded-full">{activeFilters}</Badge>
          )}
        </Button>
        {activeFilters > 0 && (
          <Button variant="ghost" size="sm" className="h-10 gap-1 text-muted-foreground" onClick={() => setFilters(EMPTY_FILTERS)}>
            <X className="h-3.5 w-3.5" /> Limpar
          </Button>
        )}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {filteredDeals.length} de {deals.length} {deals.length === 1 ? "lead" : "leads"}
          </span>
          {tab === "funil" && (
            <div className="inline-flex bg-muted/60 rounded-md p-0.5 gap-0.5">
              <button onClick={() => setView("kanban")}
                className={cn("px-2.5 py-1 rounded-sm transition-colors flex items-center gap-1 text-xs",
                  view === "kanban" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                <KanbanSquare className="h-3.5 w-3.5" /> Kanban
              </button>
              <button onClick={() => setView("list")}
                className={cn("px-2.5 py-1 rounded-sm transition-colors flex items-center gap-1 text-xs",
                  view === "list" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                <List className="h-3.5 w-3.5" /> Lista
              </button>
            </div>
          )}
          <Button size="sm" className="h-9 gap-1" onClick={() => onAddDeal(stages[0].id)}>
            <Plus className="h-4 w-4" /> Novo Lead
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1">
                <SettingsIcon className="h-4 w-4" /> Config
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setConfig("stages")}><Layers className="h-4 w-4 mr-2" /> Etapas do Funil</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setConfig("loss")}><TagIcon className="h-4 w-4 mr-2" /> Motivos de Perda</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setConfig("origins")}><Megaphone className="h-4 w-4 mr-2" /> Canais de Origem</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setConfig("products")}><Package className="h-4 w-4 mr-2" /> Serviços/Produtos</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setConfig("capture")}><Webhook className="h-4 w-4 mr-2" /> Captura de Leads</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setConfig("automations")}><Timer className="h-4 w-4 mr-2" /> Automações</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" className="h-9 gap-1" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" /> Importar
          </Button>
        </div>
      </div>

      {/* Funil view */}
      {tab === "funil" && view === "kanban" && (
        <div className="flex-1 min-h-0 overflow-x-auto">
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
            <div className="flex gap-3 px-4 md:px-6 pb-6 h-full">
              {stages.map((s) => (
                <StageColumn key={s.id} stage={s} deals={dealsByStage[s.id] ?? []}
                  totalDeals={deals.filter((d) => d.stage_id === s.id).length}
                  onAddDeal={onAddDeal} onOpenDeal={onOpenDeal} />
              ))}
            </div>
            <DragOverlay>{activeDeal && <DealCard deal={activeDeal as any} overlay />}</DragOverlay>
          </DndContext>
        </div>
      )}
      {tab === "funil" && view === "list" && (
        <DealsTable
          deals={filteredDeals}
          stages={stages}
          onOpenDeal={onOpenDeal}
          includeArchived={showArchived}
        />
      )}


      <DealDialog open={dialogOpen} onOpenChange={setDialogOpen} stages={stages} deal={editingDeal} defaultStageId={defaultStageId} />

      {/* Filtros Sheet */}
      <FiltersSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={filters}
        onChange={setFilters}
        members={members}
        origins={origins}
        stages={stages}
      />

      {/* Configuração modais */}
      <StagesDialog open={config === "stages"} onOpenChange={(v) => !v && setConfig(null)} />
      <LossReasonsDialog open={config === "loss"} onOpenChange={(v) => !v && setConfig(null)} />
      <OriginsDialog open={config === "origins"} onOpenChange={(v) => !v && setConfig(null)} />
      <ProductsDialog open={config === "products"} onOpenChange={(v) => !v && setConfig(null)} />
      <CaptureDialog open={config === "capture"} onOpenChange={(v) => !v && setConfig(null)} />
      <AutomationsDialog open={config === "automations"} onOpenChange={(v) => !v && setConfig(null)} />
      <CsvImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
