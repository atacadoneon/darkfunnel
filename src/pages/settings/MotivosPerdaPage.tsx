import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, AlertTriangle } from "lucide-react";
import {
  useLostReasons, useUpsertLostReason, useDeleteLostReason, useUpdateLostReasonOrder,
  countDealsForLostReason, type LostReasonRow,
} from "@/features/cadastros/hooks";
import { useIsManagerOrAdmin } from "@/features/workspace/permissions";

export default function MotivosPerdaPage() {
  const { data: rows = [], isLoading } = useLostReasons();
  const canEdit = useIsManagerOrAdmin();
  const reorder = useUpdateLostReasonOrder();
  const del = useDeleteLostReason();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LostReasonRow | null>(null);
  const [toDelete, setToDelete] = useState<LostReasonRow | null>(null);
  const [dealCount, setDealCount] = useState<number>(0);

  useEffect(() => {
    if (toDelete) countDealsForLostReason(toDelete.id).then(setDealCount);
  }, [toDelete]);

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= rows.length) return;
    const a = rows[idx], b = rows[j];
    reorder.mutate([
      { id: a.id, sort_order: b.sort_order },
      { id: b.id, sort_order: a.sort_order },
    ]);
  };

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Motivos de Perda</h1>
          <p className="text-sm text-muted-foreground">Configure os motivos disponíveis ao marcar negócios como perdidos.</p>
        </div>
        {canEdit && (
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="bg-violet-600 hover:bg-violet-700 text-white">
            <Plus className="h-4 w-4" /> Novo Motivo
          </Button>
        )}
      </header>

      <Card>
        {isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Nenhum motivo cadastrado. Crie o primeiro.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">Ordem</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[120px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge style={{ background: r.color, color: "#fff" }}>{r.name}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.description || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={r.is_active ? "default" : "secondary"}>
                      {r.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {canEdit && (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setDialogOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setToDelete(r)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <ReasonDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} nextOrder={rows.length} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {dealCount > 0 && <AlertTriangle className="h-5 w-5 text-amber-500" />}
              Excluir motivo?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dealCount > 0 ? (
                <>Este motivo está vinculado a <b>{dealCount}</b> negócio(s) perdido(s). Excluí-lo removerá a referência.</>
              ) : (
                <>O motivo "{toDelete?.name}" será removido permanentemente.</>
              )}
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

function ReasonDialog({ open, onOpenChange, editing, nextOrder }: {
  open: boolean; onOpenChange: (o: boolean) => void; editing: LostReasonRow | null; nextOrder: number;
}) {
  const upsert = useUpsertLostReason();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#8b5cf6");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setDescription(editing?.description ?? "");
    setColor(editing?.color ?? "#8b5cf6");
    setIsActive(editing?.is_active ?? true);
  }, [open, editing]);

  const submit = async () => {
    if (!name.trim()) return;
    await upsert.mutateAsync({
      id: editing?.id,
      name: name.trim(),
      description: description.trim() || null,
      color,
      is_active: isActive,
      sort_order: editing?.sort_order ?? nextOrder,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar motivo" : "Novo motivo"}</DialogTitle>
          <DialogDescription>Defina nome, cor e disponibilidade.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Nome *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Sem orçamento" />
          </div>
          <div>
            <label className="text-sm font-medium">Descrição</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium">Cor</label>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-16 rounded border bg-background" />
            <Badge style={{ background: color, color: "#fff" }}>{name || "Preview"}</Badge>
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
