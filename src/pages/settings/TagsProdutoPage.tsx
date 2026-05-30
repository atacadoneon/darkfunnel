import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import {
  useTagsProduto, useUpsertTagProduto, useDeleteTagProduto, type TagProduto,
} from "@/hooks/useTagsProduto";

const PALETTE = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#64748b",
];

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

export default function TagsProdutoPage() {
  const { data: rows = [], isLoading } = useTagsProduto();
  const del = useDeleteTagProduto();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TagProduto | null>(null);
  const [toDelete, setToDelete] = useState<TagProduto | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((t) => t.name.toLowerCase().includes(q));
  }, [rows, search]);

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tags de Produto</h1>
          <p className="text-sm text-muted-foreground">
            Marcadores para organizar e filtrar seu catálogo de produtos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="pl-8 h-9 w-56"
            />
          </div>
          <Button
            onClick={() => { setEditing(null); setDialogOpen(true); }}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            <Plus className="h-4 w-4" /> Nova Tag
          </Button>
        </div>
      </header>

      <Card>
        {isLoading ? (
          <div className="p-6 space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            {search
              ? "Nenhuma tag encontrada para essa busca."
              : "Nenhuma tag de produto criada. Crie tags para organizar e filtrar seu catálogo."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cor</TableHead>
                <TableHead>Criada em</TableHead>
                <TableHead className="w-[120px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <Badge style={{ background: t.color, color: "#fff" }}>{t.name}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-4 w-4 rounded" style={{ background: t.color }} />
                      <code className="text-xs text-muted-foreground">{t.color}</code>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{fmtDate(t.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(t); setDialogOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setToDelete(t)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <TagDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tag?</AlertDialogTitle>
            <AlertDialogDescription>
              A tag "{toDelete?.name}" será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!toDelete) return;
                try {
                  await del.mutateAsync(toDelete.id);
                  toast.success("Tag excluída");
                } catch (e: any) {
                  toast.error(e?.message ?? "Falha ao excluir");
                }
                setToDelete(null);
              }}
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

function TagDialog({
  open, onOpenChange, editing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: TagProduto | null;
}) {
  const upsert = useUpsertTagProduto();
  const [name, setName] = useState("");
  const [color, setColor] = useState(PALETTE[7]);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setColor(editing?.color ?? PALETTE[7]);
  }, [open, editing]);

  const submit = async () => {
    if (!name.trim()) return;
    try {
      await upsert.mutateAsync({ id: editing?.id, name: name.trim(), color });
      toast.success(editing ? "Tag atualizada" : "Tag criada");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Tag de Produto" : "Nova Tag de Produto"}</DialogTitle>
          <DialogDescription>Defina nome e cor da tag.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Nome *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Lançamento" />
          </div>
          <div>
            <label className="text-sm font-medium">Cor</label>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full border-2 transition ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ background: c }}
                  aria-label={c}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-7 w-12 rounded border bg-background"
              />
            </div>
          </div>
          <div className="rounded-md border p-3 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Preview:</span>
            <Badge style={{ background: color, color: "#fff" }}>{name || "Tag"}</Badge>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={submit}
            disabled={!name.trim() || upsert.isPending}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
