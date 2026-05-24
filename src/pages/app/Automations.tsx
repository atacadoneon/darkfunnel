import { useMemo, useState } from "react";
import { Plus, Search, Zap, MoreVertical, Pencil, Copy, Trash2, Power, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useAutomations, useAutomationMutations } from "@/hooks/useAutomations";
import { AutomationBuilder } from "@/features/automations/AutomationBuilder";
import {
  CATEGORY_LABEL, TRIGGER_EVENTS,
  type Automation, type AutomationCategory,
} from "@/types/automation";
import { toast } from "sonner";

const TABS: { value: AutomationCategory | "all"; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "distribution", label: "Distribuição" },
  { value: "pipeline", label: "Pipeline" },
  { value: "notifications", label: "Notificações" },
];

export default function Automations() {
  const { data: items = [], isLoading } = useAutomations();
  const { update, remove, duplicate } = useAutomationMutations();
  const [tab, setTab] = useState<AutomationCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Automation | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((a) => {
      if (tab !== "all" && a.category !== tab) return false;
      if (q && !a.name.toLowerCase().includes(q) && !(a.description ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, tab, search]);

  return (
    <div className="p-6 space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30 border p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">Automações</h1>
                <Badge variant="secondary" className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30">Beta</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Configure regras automáticas para otimizar seu fluxo de vendas
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Sparkles className="h-4 w-4 mr-2" /> Templates
            </Button>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4 mr-2" /> Nova Automação
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar automações..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as AutomationCategory | "all")}>
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Zap className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <h3 className="font-semibold">Nenhuma automação</h3>
          <p className="text-sm text-muted-foreground mt-1">Crie sua primeira automação para acelerar seu fluxo.</p>
          <Button className="mt-4" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nova Automação
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((a) => {
            const triggerLabel = TRIGGER_EVENTS.find((t) => t.value === a.trigger?.event)?.label ?? a.trigger?.event ?? "—";
            return (
              <Card key={a.id} className="p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setEditing(a)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Zap className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{a.name}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{a.description ?? "Sem descrição"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Switch
                      checked={a.active}
                      onCheckedChange={(v) => update.mutate({ id: a.id, patch: { active: v } })}
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditing(a)}>
                          <Pencil className="h-4 w-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => duplicate.mutate(a)}>
                          <Copy className="h-4 w-4 mr-2" /> Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => {
                            if (confirm(`Excluir "${a.name}"?`)) {
                              remove.mutate(a.id, { onSuccess: () => toast.success("Automação excluída") });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-4">
                  <Badge variant="outline" className="text-xs">{CATEGORY_LABEL[a.category] ?? a.category}</Badge>
                  <Badge variant="outline" className="text-xs">Quando: {triggerLabel}</Badge>
                  <Badge variant="outline" className="text-xs">{(a.conditions?.length ?? 0)} condição(ões)</Badge>
                  <Badge variant="outline" className="text-xs">{(a.actions?.length ?? 0)} ação(ões)</Badge>
                  <Badge variant="outline" className="text-xs">
                    {a.pipeline_id ? "Pipeline específico" : "Todos os pipelines"}
                  </Badge>
                  {a.channel_id && <Badge variant="outline" className="text-xs">Canal definido</Badge>}
                  {!a.active && <Badge variant="secondary" className="text-xs"><Power className="h-3 w-3 mr-1" /> Inativa</Badge>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <AutomationBuilder
        open={creating || !!editing}
        automation={editing}
        onClose={() => { setEditing(null); setCreating(false); }}
      />
    </div>
  );
}
