import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import {
  useCadastrosTags, useUpsertTag, useDeleteTag, type TagWithUsage,
} from "@/features/cadastros/hooks";
import { useIsManagerOrAdmin } from "@/features/workspace/permissions";

const PALETTE = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#64748b",
];

const ENTITY_LABELS: Record<string, string> = { contact: "Contato", lead: "Lead", deal: "Deal" };

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default function TagsPage() {
  const { data: rows = [], isLoading } = useCadastrosTags();
  const canEdit = useIsManagerOrAdmin();
  const del = useDeleteTag();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TagWithUsage | null>(null);
  const [toDelete, setToDelete] = useState<TagWithUsage | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((t) => t.name.toLowerCase().includes(q));
  }, [rows, search]);

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tags</h1>
          <p className="text-sm text-muted-foreground">Marcadores reutilizáveis em contatos, leads e deals.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="pl-8 h-9 w-56" />
          </div>
          {canEdit && (
            <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="bg-violet-600 hover:bg-violet-700 text-white">
              <Plus className="h-4 w-4" /> Nova Tag
            </Button>
          )}
        </div>
      </header>

      <Card>
        {isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            {search ? "Nenhuma tag encontrada para essa busca." : "Nenhuma tag cadastrada."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Aplica em</TableHead>
                <TableHead>Uso</TableHead>
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
                    <div className="flex gap-1 flex-wrap">
                      {(t.entity_types ?? []).map((e) => (
                        <Badge key={e} variant="outline" className="text-[10px]">{ENTITY_LABELS[e] ?? e}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{t.usage_count}</TableCell>
                  <TableCell className="text-muted-foreground">{fmtDate(t.created_at)}</TableCell>
                  <TableCell className="text-right">
                    {canEdit && (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(t); setDialogOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setToDelete(t)}>
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

      <TagDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tag?</AlertDialogTitle>
            <AlertDialogDescription>
              A tag "{toDelete?.name}" será removida de {toDelete?.usage_count ?? 0} registro(s).
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

function TagDialog({ open, onOpenChange, editing }: {
  open: boolean; onOpenChange: (o: boolean) => void; editing: TagWithUsage | null;
}) {
  const upsert = useUpsertTag();
  const [name, setName] = useState("");
  const [color, setColor] = useState(PALETTE[7]);
  const [entities, setEntities] = useState<string[]>(["contact"]);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setColor(editing?.color ?? PALETTE[7]);
    setEntities(editing?.entity_types && editing.entity_types.length > 0 ? editing.entity_types : ["contact"]);
  }, [open, editing]);

  const toggleEntity = (e: string) => {
    setEntities((prev) => prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]);
  };

  const submit = async () => {
    if (!name.trim() || entities.length === 0) return;
    await upsert.mutateAsync({ id: editing?.id, name: name.trim(), color, entity_types: entities });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar tag" : "Nova tag"}</DialogTitle>
          <DialogDescription>Defina nome, cor e onde a tag pode ser aplicada.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Nome *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: VIP" />
          </div>
          <div>
            <label className="text-sm font-medium">Cor</label>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {PALETTE.map((c) => (
                <button
                  key={c} type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full border-2 transition ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ background: c }}
                  aria-label={c}
                />
              ))}
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-7 w-12 rounded border bg-background" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Aplica em *</label>
            <div className="flex items-center gap-4 mt-2">
              {Object.entries(ENTITY_LABELS).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={entities.includes(k)} onCheckedChange={() => toggleEntity(k)} />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div className="rounded-md border p-3 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Preview:</span>
            <Badge style={{ background: color, color: "#fff" }}>{name || "Tag"}</Badge>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!name.trim() || entities.length === 0 || upsert.isPending} className="bg-violet-600 hover:bg-violet-700 text-white">
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
