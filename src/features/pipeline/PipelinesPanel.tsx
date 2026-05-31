import { useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Filter, MoreHorizontal, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  usePipelinesFull, useCreatePipeline, useArchivePipeline, type Pipeline,
} from "./pipelinesHooks";

type Props = {
  currentPipelineId: string | null;
  onSelect: (id: string) => void;
};

export function PipelinesPanel({ currentPipelineId, onSelect }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const { data: pipelines = [] } = usePipelinesFull();
  const createMut = useCreatePipeline();
  const archiveMut = useArchivePipeline();
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});

  const grouped = useMemo(() => {
    const groups = new Map<string, Pipeline[]>();
    for (const p of pipelines) {
      const key = p.category || "Geral";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }
    return Array.from(groups.entries());
  }, [pipelines]);

  if (collapsed) {
    return (
      <div className="w-8 border-r flex flex-col items-center pt-2 bg-muted/20">
        <button onClick={() => setCollapsed(false)} className="p-1 hover:bg-muted rounded" title="Mostrar pipelines">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-60 shrink-0 border-r bg-muted/10 flex flex-col">
      <div className="flex items-center justify-between p-3 border-b">
        <div className="text-sm font-semibold">Pipelines</div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setCreateOpen(true)} title="Nova pipeline">
            <Plus className="h-4 w-4" />
          </Button>
          <button onClick={() => setCollapsed(true)} className="p-1 hover:bg-muted rounded" title="Ocultar">
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {grouped.length === 0 && (
          <div className="px-3 py-6 text-xs text-muted-foreground text-center">Nenhuma pipeline</div>
        )}
        {grouped.map(([cat, items]) => {
          const open = openCats[cat] ?? true;
          return (
            <div key={cat} className="mb-1">
              <button
                onClick={() => setOpenCats((s) => ({ ...s, [cat]: !open }))}
                className="w-full flex items-center gap-1 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                <ChevronDown className={cn("h-3 w-3 transition-transform", !open && "-rotate-90")} />
                {cat}
              </button>
              {open && (
                <div className="space-y-0.5 px-1">
                  {items.map((p) => {
                    const active = p.id === currentPipelineId;
                    return (
                      <div
                        key={p.id}
                        className={cn(
                          "group flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm cursor-pointer",
                          active ? "bg-accent text-accent-foreground" : "hover:bg-muted/60"
                        )}
                        onClick={() => onSelect(p.id)}
                      >
                        <Filter className={cn("h-3.5 w-3.5 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                        <span className="flex-1 truncate">{p.name}</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              onClick={(e) => e.stopPropagation()}
                              className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded"
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={() => onSelect(p.id)}>Selecionar</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => archiveMut.mutate(p.id)} className="text-destructive">
                              Arquivar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova pipeline</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Nome</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Vendas B2B" />
            </div>
            <div>
              <label className="text-xs font-medium">Categoria (opcional)</label>
              <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Comercial" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button
              onClick={async () => {
                if (!newName.trim()) return;
                const id = await createMut.mutateAsync({ name: newName.trim(), category: newCategory.trim() || null });
                setNewName(""); setNewCategory(""); setCreateOpen(false);
                if (id) onSelect(id);
              }}
              disabled={createMut.isPending}
            >
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
