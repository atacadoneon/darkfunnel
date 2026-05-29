import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Phone, Mail, MessageCircle, Calendar, Users, FileText, Video,
  Coffee, ShoppingCart, Star, AlertCircle, Check, MoreHorizontal, Plus, Pencil, Trash2,
} from "lucide-react";
import {
  useActivityTypes, useUpsertActivityType, useDeleteActivityType, type ActivityTypeRow,
} from "@/features/cadastros/hooks";
import { useIsManagerOrAdmin } from "@/features/workspace/permissions";

const ICONS: Record<string, typeof Phone> = {
  Phone, Mail, MessageCircle, Calendar, Users, FileText, Video,
  Coffee, ShoppingCart, Star, AlertCircle, Check,
};

function Icon({ name, className }: { name: string; className?: string }) {
  const I = ICONS[name] ?? FileText;
  return <I className={className} />;
}

export default function TiposAtividadePage() {
  const { data: rows = [], isLoading } = useActivityTypes();
  const canEdit = useIsManagerOrAdmin();
  const upsert = useUpsertActivityType();
  const del = useDeleteActivityType();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ActivityTypeRow | null>(null);
  const [toDelete, setToDelete] = useState<ActivityTypeRow | null>(null);

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tipos de Atividade</h1>
          <p className="text-sm text-muted-foreground">Defina as categorias de atividades realizadas na operação.</p>
        </div>
        {canEdit && (
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="bg-violet-600 hover:bg-violet-700 text-white">
            <Plus className="h-4 w-4" /> Novo Tipo
          </Button>
        )}
      </header>

      {isLoading ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">Carregando…</Card>
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">Nenhum tipo cadastrado.</Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {rows.map((t) => (
            <Card key={t.id} className="p-4 relative" style={{ background: `${t.color}1A`, borderColor: `${t.color}55` }}>
              <div className="flex items-start justify-between mb-3">
                <div
                  className="h-12 w-12 rounded-lg flex items-center justify-center"
                  style={{ background: t.color }}
                >
                  <Icon name={t.icon} className="h-6 w-6 text-white" />
                </div>
                {canEdit && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setEditing(t); setDialogOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setToDelete(t)} className="text-destructive">
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <p className="font-semibold">{t.name}</p>
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-muted-foreground">{t.is_active ? "Ativo" : "Inativo"}</span>
                <Switch
                  checked={t.is_active}
                  disabled={!canEdit}
                  onCheckedChange={(v) => upsert.mutate({ id: t.id, name: t.name, icon: t.icon, color: t.color, is_active: v })}
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      <TypeDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tipo?</AlertDialogTitle>
            <AlertDialogDescription>
              O tipo "{toDelete?.name}" será removido. Atividades existentes não serão excluídas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (toDelete) del.mutate(toDelete.id); setToDelete(null); }}
              className="bg-destructive text-destructive-foreground"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TypeDialog({ open, onOpenChange, editing }: {
  open: boolean; onOpenChange: (o: boolean) => void; editing: ActivityTypeRow | null;
}) {
  const upsert = useUpsertActivityType();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("Phone");
  const [color, setColor] = useState("#8b5cf6");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setIcon(editing?.icon ?? "Phone");
    setColor(editing?.color ?? "#8b5cf6");
    setIsActive(editing?.is_active ?? true);
  }, [open, editing]);

  const submit = async () => {
    if (!name.trim()) return;
    await upsert.mutateAsync({ id: editing?.id, name: name.trim(), icon, color, is_active: isActive });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar tipo" : "Novo tipo de atividade"}</DialogTitle>
          <DialogDescription>Escolha um ícone e cor para destacar este tipo.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Nome *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Ligação" />
          </div>
          <div>
            <label className="text-sm font-medium">Ícone</label>
            <div className="grid grid-cols-6 gap-2 mt-1">
              {Object.keys(ICONS).map((key) => (
                <button
                  key={key} type="button"
                  onClick={() => setIcon(key)}
                  className={`h-10 w-10 rounded-md border flex items-center justify-center transition ${icon === key ? "border-violet-500 bg-violet-500/10" : "border-input hover:bg-muted"}`}
                  aria-label={key}
                >
                  <Icon name={key} className="h-5 w-5" />
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium">Cor</label>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-16 rounded border bg-background" />
            <div className="h-9 w-9 rounded flex items-center justify-center" style={{ background: color }}>
              <Icon name={icon} className="h-5 w-5 text-white" />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <p className="text-sm font-medium">{isActive ? "Ativo" : "Inativo"}</p>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!name.trim() || upsert.isPending} className="bg-violet-600 hover:bg-violet-700 text-white">
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
