import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  DndContext, DragOverlay, PointerSensor, closestCorners, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import {
  Plus, KanbanSquare, Settings as SettingsIcon, Upload, ChevronDown, Search, SlidersHorizontal, Users,
  Tag as TagIcon, Layers, Megaphone, Package, Webhook, Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

type Tab = "funil" | "banco" | "dashboard";
type ConfigKey = "stages" | "loss" | "origins" | "products" | "capture" | "automations" | null;

export default function Pipeline() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const { data: stages = [], isLoading: loadingStages } = useStages();
  const { data: deals = [], isLoading: loadingDeals } = useDeals();
  const { data: members = [] } = useWorkspaceMembers();
  const { data: origins = [] } = useLeadOrigins();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [defaultStageId, setDefaultStageId] = useState<string | undefined>();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "funil";
  const setTab = (t: Tab) => {
    const next = new URLSearchParams(params);
    if (t === "funil") next.delete("tab"); else next.set("tab", t);
    setParams(next, { replace: true });
  };
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [config, setConfig] = useState<ConfigKey>(null);

  // filtros
  const [fAssignee, setFAssignee] = useState("all");
  const [fOrigin, setFOrigin] = useState("all");
  const [fShowArchived, setFShowArchived] = useState(false);
  const [fMin, setFMin] = useState(""); const [fMax, setFMax] = useState("");
  const [fInactive, setFInactive] = useState("any");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const filteredDeals = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deals.filter((d) => {
      if (q && !(d.title.toLowerCase().includes(q) || d.contact?.display_name?.toLowerCase().includes(q) || d.contact?.phone_e164?.toLowerCase().includes(q))) return false;
      if (fAssignee !== "all") {
        if (fAssignee === "none" && d.assigned_to) return false;
        if (fAssignee !== "none" && d.assigned_to !== fAssignee) return false;
      }
      if (fOrigin !== "all" && (d as any).origin_id !== fOrigin) return false;
      if (fMin && d.value_cents < Number(fMin) * 100) return false;
      if (fMax && d.value_cents > Number(fMax) * 100) return false;
      if (fInactive !== "any") {
        const days = Number(fInactive);
        const last = (d as any).last_interaction_at ?? d.updated_at;
        const diff = (Date.now() - new Date(last).getTime()) / 86400000;
        if (diff < days) return false;
      }
      return true;
    });
  }, [deals, search, fAssignee, fOrigin, fMin, fMax, fInactive]);

  const dealsByStage = useMemo(() => {
    const m: Record<string, Deal[]> = {};
    for (const s of stages) m[s.id] = [];
    for (const d of filteredDeals) (m[d.stage_id] ??= []).push(d);
    return m;
  }, [filteredDeals, stages]);

  const activeDeal = activeId ? deals.find((d) => d.id === activeId) ?? null : null;
  const onAddDeal = (stageId: string) => { setEditingDeal(null); setDefaultStageId(stageId); setDialogOpen(true); };
  const onOpenDeal = (deal: Deal) => { setEditingDeal(deal); setDefaultStageId(undefined); setDialogOpen(true); };
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

  const wsName = current?.name ?? "Workspace";
  const totalLeads = deals.length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
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

            <div className="hidden md:flex items-center gap-2">
              <Button variant="outline" className="gap-2">
                <KanbanSquare className="h-4 w-4" />
                {wsName}
                <ChevronDown className="h-4 w-4 opacity-60" />
              </Button>
              <Button onClick={() => onAddDeal(stages[0].id)} className="gap-1">
                <Plus className="h-4 w-4" /> Novo Lead
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-1">
                    <SettingsIcon className="h-4 w-4" /> Configurações
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

              <Button variant="outline" className="gap-1"><Upload className="h-4 w-4" /> Importar</Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="px-4 md:px-6 pt-4">
        <div className="inline-flex bg-muted/60 rounded-lg p-1 gap-1">
          {(["funil", "banco", "dashboard"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("px-4 py-1.5 text-sm font-medium rounded-md capitalize transition-colors",
                tab === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Search + Filters */}
      <div className="px-4 md:px-6 pt-4 pb-3 flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar leads..." className="pl-9 h-10 rounded-lg" />
        </div>
        <Button variant="outline" className="h-10 gap-2" onClick={() => setFiltersOpen(true)}>
          <SlidersHorizontal className="h-4 w-4" /> Filtros
        </Button>
      </div>

      {/* Kanban */}
      {tab === "funil" && (
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

      {tab === "banco" && <div className="flex-1 min-h-0 overflow-hidden"><Contacts /></div>}
      {tab === "dashboard" && (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Dashboard do funil · em breve</div>
      )}

      <DealDialog open={dialogOpen} onOpenChange={setDialogOpen} stages={stages} deal={editingDeal} defaultStageId={defaultStageId} />

      {/* Filtros Sheet */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent className="w-[360px] sm:w-[400px] overflow-y-auto">
          <SheetHeader><SheetTitle>Filtros</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Responsável</Label>
              <Select value={fAssignee} onValueChange={setFAssignee}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Responsáveis</SelectItem>
                  <SelectItem value="none">Sem vendedor</SelectItem>
                  {members.map((m: any) => <SelectItem key={m.user_id} value={m.user_id}>{m.display_name ?? m.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Origem do Lead</Label>
              <Select value={fOrigin} onValueChange={setFOrigin}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Origens</SelectItem>
                  {origins.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between border rounded-md p-3">
              <div>
                <div className="text-sm font-medium">Ver Arquivados</div>
                <div className="text-xs text-muted-foreground">Mostrar leads que foram arquivados</div>
              </div>
              <Switch checked={fShowArchived} onCheckedChange={setFShowArchived} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Valor mín. (R$)</Label>
                <Input value={fMin} onChange={(e) => setFMin(e.target.value)} type="number" placeholder="Mín" />
              </div>
              <div>
                <Label>Valor máx. (R$)</Label>
                <Input value={fMax} onChange={(e) => setFMax(e.target.value)} type="number" placeholder="Máx" />
              </div>
            </div>
            <div>
              <Label>Dias sem interação</Label>
              <Select value={fInactive} onValueChange={setFInactive}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Qualquer</SelectItem>
                  <SelectItem value="3">+ de 3 dias</SelectItem>
                  <SelectItem value="7">+ de 7 dias</SelectItem>
                  <SelectItem value="15">+ de 15 dias</SelectItem>
                  <SelectItem value="30">+ de 30 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" className="w-full" onClick={() => {
              setFAssignee("all"); setFOrigin("all"); setFMin(""); setFMax(""); setFInactive("any"); setFShowArchived(false);
            }}>Limpar filtros</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Configuração modais */}
      <StagesDialog open={config === "stages"} onOpenChange={(v) => !v && setConfig(null)} />
      <LossReasonsDialog open={config === "loss"} onOpenChange={(v) => !v && setConfig(null)} />
      <OriginsDialog open={config === "origins"} onOpenChange={(v) => !v && setConfig(null)} />
      <ProductsDialog open={config === "products"} onOpenChange={(v) => !v && setConfig(null)} />
      <CaptureDialog open={config === "capture"} onOpenChange={(v) => !v && setConfig(null)} />
      <AutomationsDialog open={config === "automations"} onOpenChange={(v) => !v && setConfig(null)} />
    </div>
  );
}
