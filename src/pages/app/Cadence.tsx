import { useMemo, useState } from "react";
import { Plus, MessageSquare, Trash2, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useCadences, useCadenceMutations } from "@/hooks/useCadences";
import { CadenceDialog } from "@/features/cadence/CadenceDialog";
import { TRIGGER_LABEL, type Cadence } from "@/types/cadence";
import { toast } from "sonner";

export default function Cadence() {
  const { data: items = [], isLoading } = useCadences();
  const { update, remove } = useCadenceMutations();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Cadence | null>(null);

  const count = useMemo(() => items.length, [items]);

  return (
    <div className="p-3 space-y-3">
      <div className="h-10 flex items-center gap-2 border-b">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <h1 className="text-sm font-semibold">Fluxo de Cadência</h1>
        <Badge variant="outline" className="text-[10px] h-4">{isLoading ? "—" : count}</Badge>
        <span className="text-[11px] text-muted-foreground hidden sm:inline">Envio automático em sequência</span>
        <Button size="sm" className="ml-auto h-7 text-xs" onClick={() => setCreating(true)}>
          <Plus className="h-3 w-3 mr-1" /> Nova Cadência
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center">
          <MessageSquare className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <h3 className="font-semibold">Nenhuma cadência criada</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Crie sua primeira cadência para automatizar follow-ups.
          </p>
          <Button className="mt-4" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nova Cadência
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((c) => (
            <Card key={c.id} className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setEditing(c)}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{c.name}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{c.description ?? "Sem descrição"}</p>
                </div>
                <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
                  <Switch checked={c.enabled} onCheckedChange={(v) => update.mutate({ id: c.id, patch: { enabled: v } })} />
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => {
                    if (confirm(`Excluir cadência "${c.name}"?`)) {
                      remove.mutate(c.id, { onSuccess: () => toast.success("Cadência excluída") });
                    }
                  }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                <Badge variant="outline" className="text-xs">Trigger: {TRIGGER_LABEL[c.trigger_type]}</Badge>
                {!c.enabled && <Badge variant="secondary" className="text-xs"><Power className="h-3 w-3 mr-1" /> Pausada</Badge>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <CadenceDialog
        open={creating || !!editing}
        cadence={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
      />
    </div>
  );
}
