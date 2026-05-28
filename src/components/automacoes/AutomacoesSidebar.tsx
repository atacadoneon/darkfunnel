import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Search, Plus, ChevronDown, ChevronRight, Workflow } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useFlows, useFlowMutations, useAutomationGroups, type Flow } from "@/hooks/useFlow";
import { cn } from "@/lib/utils";

type Props = {
  activeFlowId?: string;
  onCreateClick: () => void;
};

export function AutomacoesSidebar({ activeFlowId, onCreateClick }: Props) {
  const { data: flows = [] } = useFlows();
  const { data: groups = [] } = useAutomationGroups();
  const { update } = useFlowMutations();
  const [search, setSearch] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const filtered = flows.filter((f) =>
    !search.trim() || f.name.toLowerCase().includes(search.toLowerCase())
  );

  const grouped: Record<string, Flow[]> = { __none__: [] };
  for (const g of groups) grouped[g.id] = [];
  for (const f of filtered) {
    const k = f.group_id ?? "__none__";
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(f);
  }

  const groupList = [
    ...groups.map((g) => ({ id: g.id, name: g.name })),
    { id: "__none__", name: "Sem grupo" },
  ];

  return (
    <aside className="w-[280px] shrink-0 border-r bg-card/30 flex flex-col h-full">
      <div className="p-3 border-b space-y-2">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar automação..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Button size="sm" className="w-full h-8 text-xs" onClick={onCreateClick}>
          <Plus className="h-3 w-3 mr-1" />
          Adicionar automação
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {groupList.map((g) => {
          const items = grouped[g.id] ?? [];
          if (!items.length) return null;
          const isOpen = openGroups[g.id] ?? true;
          return (
            <div key={g.id} className="mb-1">
              <button
                onClick={() => setOpenGroups((s) => ({ ...s, [g.id]: !isOpen }))}
                className="w-full flex items-center gap-1 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
              >
                {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                <span className="flex-1 text-left truncate">{g.name}</span>
                <span className="text-[10px]">{items.length}</span>
              </button>
              {isOpen && (
                <div className="space-y-0.5">
                  {items.map((f) => (
                    <NavLink
                      key={f.id}
                      to={`/automacoes/${f.id}`}
                      className={cn(
                        "group flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/60 transition-colors",
                        activeFlowId === f.id && "bg-muted",
                      )}
                    >
                      <Workflow className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate">{f.name}</span>
                      <Switch
                        checked={f.is_active}
                        onClick={(e) => e.stopPropagation()}
                        onCheckedChange={(v) =>
                          update.mutate({ id: f.id, patch: { is_active: v } })
                        }
                        className="scale-75"
                      />
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {!flows.length && (
          <div className="p-6 text-center text-xs text-muted-foreground">
            Nenhuma automação ainda.
          </div>
        )}
      </div>
    </aside>
  );
}
