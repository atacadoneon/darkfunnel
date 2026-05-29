import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useDepartments, useUpsertDepartment, useDeleteDepartment, type Department } from "@/features/settings/settingsHooks";
import { useIsManagerOrAdmin } from "@/features/workspace/permissions";

export default function DepartamentosPage() {
  const { data: rows = [], isLoading } = useDepartments();
  const canEdit = useIsManagerOrAdmin();
  const del = useDeleteDepartment();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [toDelete, setToDelete] = useState<Department | null>(null);

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Departamentos</h1>
          <p className="text-sm text-muted-foreground">Organize a estrutura interna da sua empresa.</p>
        </div>
        {canEdit && (
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="bg-violet-600 hover:bg-violet-700 text-white">
            <Plus className="h-4 w-4" /> Novo Departamento
          </Button>
        )}
      </header>

      <Card>
        {isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Nenhum departamento cadastrado.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="w-[120px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((d) => (
                <TableRow key={d.id}>
                  <TableCell><Badge style={{ background: d.color ?? "#8b5cf6", color: "#fff" }}>{d.name}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{d.description || "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{new Date(d.created_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="text-right">
                    {canEdit && (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(d); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setToDelete(d)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <DepartmentDialog open={open} onOpenChange={setOpen} editing={editing} nextOrder={rows.length} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir departamento?</AlertDialogTitle>
            <AlertDialogDescription>"{toDelete?.name}" será removido permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (toDelete) del.mutate(toDelete.id); setToDelete(null); }}
              className="bg-destructive text-destructive-foreground"
            >Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DepartmentDialog({ open, onOpenChange, editing, nextOrder }: {
  open: boolean; onOpenChange: (o: boolean) => void; editing: Department | null; nextOrder: number;
}) {
  const upsert = useUpsertDepartment();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#8b5cf6");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setColor(editing?.color ?? "#8b5cf6");
    setDescription(editing?.description ?? "");
  }, [open, editing]);

  const submit = async () => {
    if (!name.trim()) return;
    await upsert.mutateAsync({
      id: editing?.id,
      name: name.trim(),
      color,
      description: description.trim() || null,
      sort_order: editing?.sort_order ?? nextOrder,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar departamento" : "Novo departamento"}</DialogTitle>
          <DialogDescription>Defina nome, cor e descrição.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="flex items-end gap-3">
            <div><Label>Cor</Label><input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-16 rounded border bg-background block" /></div>
            <Badge style={{ background: color, color: "#fff" }}>{name || "Preview"}</Badge>
          </div>
          <div><Label>Descrição</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!name.trim() || upsert.isPending} className="bg-violet-600 hover:bg-violet-700 text-white">Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
