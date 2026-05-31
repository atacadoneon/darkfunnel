import { useEffect, useMemo, useState } from "react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus, Save, RotateCcw, GripVertical, X, Maximize2, Minimize2, LayoutDashboard,
  Users, Filter, TrendingUp, DollarSign, MessageSquare, Target, Trophy, Layers,
  Timer, Activity, BadgeCheck, FileText, ArrowDownToLine, ArrowUpFromLine, Percent,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useDashboardFilters } from "@/contexts/DashboardFiltersContext";
import { useCommercialSummary, useAdsRoi } from "@/hooks/useDashboard";
import { useSlaBySeller } from "@/hooks/useDashboard";
import { usePaymentsCommissions } from "@/hooks/usePayments";
import {
  useWidgetCatalog, useUserWidgets, useSaveLayout, useResetLayout,
  type UserWidget, type WidgetCatalog,
} from "@/hooks/useCustomDashboard";
import { FunilView } from "./FunilView";
import { MetasView } from "./MetasView";

const brl = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format((cents ?? 0) / 100);
const num = (n: number) => new Intl.NumberFormat("pt-BR").format(n ?? 0);

const ICONS: Record<string, any> = {
  users: Users, filter: Filter, "trending-up": TrendingUp, "dollar-sign": DollarSign,
  "message-square": MessageSquare, target: Target, trophy: Trophy, layers: Layers,
  timer: Timer, activity: Activity, "badge-check": BadgeCheck, "file-text": FileText,
  "arrow-down": ArrowDownToLine, "arrow-up": ArrowUpFromLine, percent: Percent,
};
const iconFor = (name?: string | null) => ICONS[(name ?? "").toLowerCase()] ?? LayoutDashboard;

const CATEGORY_LABEL: Record<string, string> = {
  comercial: "Comercial", atendimento: "Atendimento", trafego: "Tráfego",
  funil: "Funil", metas: "Metas",
};

/* ---------- Widget renderer ---------- */

function KpiBox({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: string }) {
  return (
    <div className="h-full flex flex-col justify-between p-4">
      <div className="flex items-start justify-between">
        <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
        <div className="h-8 w-8 rounded-md bg-accent/40 flex items-center justify-center"><Icon className="h-4 w-4 text-foreground/70" /></div>
      </div>
      <div className={cn("text-3xl font-semibold tracking-tight tabular-nums", accent)}>{value}</div>
    </div>
  );
}

function WidgetContent({ slug }: { slug: string }) {
  const { filters } = useDashboardFilters();
  const { data: commercial } = useCommercialSummary(filters);
  const { data: roi } = useAdsRoi(filters);
  const { data: sla } = useSlaBySeller(filters);
  const { data: commissions } = usePaymentsCommissions();

  const avgSla = (() => {
    const rs = sla ?? []; let s = 0, n = 0;
    for (const r of rs) if (r.avg_response_minutes != null) { s += r.avg_response_minutes * r.conversas; n += r.conversas; }
    return n ? Math.round(s / n) : 0;
  })();

  switch (slug) {
    case "kpi_leads_30d": return <KpiBox icon={Users} label="Leads 30d" value={num(commercial?.leads_entrada_30d ?? 0)} />;
    case "kpi_deals_won": return <KpiBox icon={TrendingUp} label="Vendas" value={num(commercial?.vendas_30d ?? 0)} />;
    case "kpi_revenue_30d": return <KpiBox icon={DollarSign} label="Receita 30d" value={brl(commercial?.valor_vendas_cents_30d ?? 0)} accent="text-primary" />;
    case "kpi_messages_in": return <KpiBox icon={ArrowDownToLine} label="Msgs Recebidas" value={num(commercial?.mensagens_in_30d ?? 0)} />;
    case "kpi_messages_out": return <KpiBox icon={ArrowUpFromLine} label="Msgs Enviadas" value={num(commercial?.mensagens_out_30d ?? 0)} />;
    case "kpi_conversations": return <KpiBox icon={MessageSquare} label="Conversas" value={num(commercial?.conversas_30d ?? 0)} />;
    case "kpi_sla_response": return <KpiBox icon={Timer} label="SLA Resposta" value={`${avgSla} min`} />;
    case "kpi_ads_spend": return <KpiBox icon={Target} label="Investido Ads" value={brl(roi?.invested_cents_30d ?? 0)} />;
    case "kpi_ads_roi": {
      const v = roi?.invested_cents_30d ? (((roi.attributed_revenue_cents_30d - roi.invested_cents_30d) / roi.invested_cents_30d) * 100) : 0;
      return <KpiBox icon={Percent} label="ROI Ads" value={`${v.toFixed(1)}%`} accent={v >= 0 ? "text-emerald-500" : "text-destructive"} />;
    }
    case "kpi_ads_proposals": return <KpiBox icon={FileText} label="Propostas Ads" value={num(roi?.propostas_30d ?? 0)} />;
    case "kpi_ads_deals": return <KpiBox icon={BadgeCheck} label="Vendas Ads" value={num(roi?.attributed_deals_30d ?? 0)} />;
    case "chart_funnel": return <div className="h-full overflow-auto"><FunilView /></div>;
    case "chart_goals_progress": return <div className="h-full overflow-auto"><MetasView /></div>;
    case "top_sellers":
      return (
        <div className="p-4 h-full overflow-auto">
          <div className="text-sm font-semibold mb-3 flex items-center gap-2"><Trophy className="h-4 w-4 text-primary" /> Top vendedores</div>
          {(commissions ?? []).length === 0 ? (
            <div className="text-sm text-muted-foreground">Sem dados.</div>
          ) : (
            <div className="space-y-2">
              {(commissions ?? []).slice(0, 5).map((c: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="truncate">{c.display_name ?? c.name ?? "—"}</span>
                  <span className="tabular-nums font-medium">{brl(c.total_paid_cents ?? 0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    default:
      return <div className="p-4 text-sm text-muted-foreground flex items-center justify-center h-full">Widget "{slug}" não implementado.</div>;
  }
}

/* ---------- Sortable Card ---------- */

type Item = UserWidget & { uid: string };

function SortableWidget({
  item, catalog, editing, onRemove, onResize,
}: {
  item: Item;
  catalog: WidgetCatalog | undefined;
  editing: boolean;
  onRemove: () => void;
  onResize: (dw: number, dh: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.uid });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    gridColumn: `span ${Math.min(4, Math.max(1, item.width))}`,
    gridRow: `span ${Math.min(3, Math.max(1, item.height))}`,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <Card ref={setNodeRef} style={style} className="relative group overflow-hidden shadow-sm">
      {editing && (
        <div className="absolute top-1.5 right-1.5 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onResize(-1, 0)} title="Reduzir largura"><Minimize2 className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onResize(1, 0)} title="Aumentar largura"><Maximize2 className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onRemove} title="Remover"><X className="h-3.5 w-3.5" /></Button>
        </div>
      )}
      {editing && (
        <button
          {...attributes} {...listeners}
          className="absolute top-1.5 left-1.5 z-10 h-7 w-7 rounded hover:bg-accent flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
          title="Arrastar"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
      <CardContent className="p-0 h-full min-h-[120px]">
        <WidgetContent slug={item.slug} />
      </CardContent>
    </Card>
  );
}

/* ---------- Catalog popover ---------- */

function CatalogPopover({ onAdd }: { onAdd: (w: WidgetCatalog) => void }) {
  const { data: catalog, isLoading } = useWidgetCatalog();
  const grouped = useMemo(() => {
    const m = new Map<string, WidgetCatalog[]>();
    for (const c of catalog ?? []) {
      const k = c.category ?? "outros";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(c);
    }
    return Array.from(m.entries());
  }, [catalog]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="gap-2 bg-primary hover:bg-primary/90"><Plus className="h-4 w-4" /> Adicionar gadget</Button>
      </PopoverTrigger>
      <PopoverContent className="w-[520px] p-0" align="start">
        <div className="px-4 py-3 border-b">
          <div className="font-semibold text-sm">Catálogo de widgets</div>
          <div className="text-xs text-muted-foreground">Escolha um widget para adicionar à sua dashboard</div>
        </div>
        <div className="max-h-[480px] overflow-y-auto p-3 space-y-4">
          {isLoading && <Skeleton className="h-40" />}
          {grouped.map(([cat, items]) => (
            <div key={cat}>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium px-1 mb-2">
                {CATEGORY_LABEL[cat] ?? cat}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {items.map((w) => {
                  const Icon = iconFor(w.icon);
                  return (
                    <div key={w.slug} className="border rounded-lg p-3 flex items-start gap-2 hover:bg-accent/30 transition-colors">
                      <div className="h-8 w-8 rounded-md bg-accent/40 flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-foreground/70" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{w.name}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2">{w.description}</div>
                      </div>
                      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => onAdd(w)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ---------- Main view ---------- */

export function PersonalizadoView() {
  const { data: saved, isLoading } = useUserWidgets();
  const { data: catalog } = useWidgetCatalog();
  const save = useSaveLayout();
  const reset = useResetLayout();

  const catalogMap = useMemo(() => {
    const m = new Map<string, WidgetCatalog>();
    for (const c of catalog ?? []) m.set(c.slug, c);
    return m;
  }, [catalog]);

  const [items, setItems] = useState<Item[]>([]);
  const [editing, setEditing] = useState(true);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!saved) return;
    setItems(saved.map((s, i) => ({ ...s, uid: s.id ?? `${s.slug}-${i}-${Math.random().toString(36).slice(2, 7)}` })));
    setDirty(false);
  }, [saved]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const handleAdd = (w: WidgetCatalog) => {
    const maxY = items.reduce((m, it) => Math.max(m, it.position_y ?? 0), -1);
    setItems((prev) => [
      ...prev,
      {
        uid: `${w.slug}-${Date.now()}`,
        slug: w.slug,
        position_x: 0,
        position_y: maxY + 1,
        width: w.default_w ?? 1,
        height: w.default_h ?? 1,
      },
    ]);
    setDirty(true);
  };

  const handleRemove = (uid: string) => { setItems((p) => p.filter((i) => i.uid !== uid)); setDirty(true); };
  const handleResize = (uid: string, dw: number, dh: number) => {
    setItems((p) => p.map((i) => i.uid === uid ? {
      ...i,
      width: Math.min(4, Math.max(1, i.width + dw)),
      height: Math.min(3, Math.max(1, i.height + dh)),
    } : i));
    setDirty(true);
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIx = prev.findIndex((i) => i.uid === active.id);
      const newIx = prev.findIndex((i) => i.uid === over.id);
      if (oldIx < 0 || newIx < 0) return prev;
      const next = arrayMove(prev, oldIx, newIx).map((it, idx) => ({ ...it, position_y: idx, position_x: 0 }));
      return next;
    });
    setDirty(true);
  };

  const handleSave = () => {
    save.mutate(items.map(({ uid, id, ...w }, i) => ({ ...w, position_y: i, position_x: 0 })));
  };

  const handleReset = () => {
    if (!confirm("Apagar todos os widgets desta dashboard?")) return;
    reset.mutate();
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="text-lg font-semibold">Dashboard personalizada</div>
          <div className="text-xs text-muted-foreground">Arraste, redimensione e salve seu layout</div>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <Badge variant="secondary">Alterações não salvas</Badge>}
          <Button variant="ghost" size="sm" onClick={() => setEditing((v) => !v)}>{editing ? "Visualizar" : "Editar"}</Button>
          <CatalogPopover onAdd={handleAdd} />
          <Button variant="outline" className="gap-2" onClick={handleSave} disabled={save.isPending || !dirty}>
            <Save className="h-4 w-4" /> Salvar layout
          </Button>
          <Button variant="ghost" className="gap-2 text-muted-foreground" onClick={handleReset} disabled={reset.isPending}>
            <RotateCcw className="h-4 w-4" /> Resetar
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : items.length === 0 ? (
        <Card className="p-10 border-dashed text-center space-y-3">
          <LayoutDashboard className="h-10 w-10 mx-auto text-muted-foreground" />
          <div className="text-base font-semibold">Sua dashboard personalizada ainda está vazia</div>
          <p className="text-sm text-muted-foreground">Clique em <strong>Adicionar gadget</strong> para começar.</p>
        </Card>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((i) => i.uid)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-[140px]">
              {items.map((it) => (
                <SortableWidget
                  key={it.uid}
                  item={it}
                  catalog={catalogMap.get(it.slug)}
                  editing={editing}
                  onRemove={() => handleRemove(it.uid)}
                  onResize={(dw, dh) => handleResize(it.uid, dw, dh)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
