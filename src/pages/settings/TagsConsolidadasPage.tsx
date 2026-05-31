import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  useCadastrosTags, useUpsertTag, useDeleteTag, type TagWithUsage,
} from "@/features/cadastros/hooks";

const PALETTE = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#64748b",
];

type Category = "lead" | "proposal" | "product" | "dialer" | "email";

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "lead", label: "Lead" },
  { key: "proposal", label: "Proposta" },
  { key: "product", label: "Produto" },
  { key: "dialer", label: "Discador" },
  { key: "email", label: "Email" },
];

// Map URL slug to category
const URL_TO_CAT: Record<string, Category> = {
  lead: "lead",
  proposta: "proposal",
  produto: "product",
  discador: "dialer",
  email: "email",
};
const CAT_TO_URL: Record<Category, string> = {
  lead: "lead", proposal: "proposta", product: "produto", dialer: "discador", email: "email",
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

// Usage count per category — falls back to existing counts when pivot tables aren't available.
function useCategoryUsage(category: Category, tagIds: string[]) {
  const { current } = useWorkspace();
  return useQuery({
    queryKey: ["tags:usage", category, current?.id, tagIds.sort().join(",")],
    enabled: !!current && tagIds.length > 0,
    queryFn: async (): Promise<Record<string, number>> => {
      const counts: Record<string, number> = {};
      const table =
        category === "lead" ? "lead_tags"
        : category === "proposal" ? "proposal_tags"
        : category === "product" ? "product_tags"
        : category === "dialer" ? "dialer_tags"
        : "email_tags";
      try {
        const { data, error } = await (supabase as any).from(table).select("tag_id").in("tag_id", tagIds);
        if (error) return counts;
        for (const r of (data ?? []) as { tag_id: string }[]) {
          counts[r.tag_id] = (counts[r.tag_id] ?? 0) + 1;
        }
      } catch {
        // ignore — pivot table may not exist for dialer/email yet
      }
      return counts;
    },
  });
}

export default function TagsConsolidadasPage() {
  const [params, setParams] = useSearchParams();
  const initialTab = (params.get("tab") && URL_TO_CAT[params.get("tab")!]) || "lead";
  const [tab, setTab] = useState<Category>(initialTab);
  const { data: rows = [], isLoading } = useCadastrosTags();
  const del = useDeleteTag();

  useEffect(() => {
    setParams({ tab: CAT_TO_URL[tab] }, { replace: true });
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Tags</h1>
        <p className="text-sm text-muted-foreground">
          Organize seus contatos, propostas, produtos e mais com etiquetas coloridas.
        </p>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Category)}>
        <TabsList>
          {CATEGORIES.map((c) => (
            <TabsTrigger key={c.key} value={c.key} className="uppercase text-xs">
              {c.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {CATEGORIES.map((c) => (
          <TabsContent key={c.key} value={c.key}>
            <CategoryPanel
              category={c.key}
              rows={rows}
              isLoading={isLoading}
              onDelete={(id) => del.mutate(id)}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function CategoryPanel({
  category, rows, isLoading, onDelete,
}: {
  category: Category;
  rows: TagWithUsage[];
  isLoading: boolean;
  onDelete: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TagWithUsage | null>(null);
  const [toDelete, setToDelete] = useState<TagWithUsage | null>(null);

  const inCategory = useMemo(
    () => rows.filter((t) => (t.entity_types ?? []).includes(category)),
    [rows, category],
  );
  const { data: usage = {} } = useCategoryUsage(category, inCategory.map((t) => t.id));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return inCategory;
    return inCategory.filter((t) => t.name.toLowerCase().includes(q));
  }, [inCategory, search]);

  return (
    <div className="space-y-3 mt-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
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
          <Plus className="h-4 w-4 mr-1" /> Nova Tag
        </Button>
      </div>

      <Card>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            {search ? "Nenhuma tag encontrada." : `Nenhuma tag de ${category} cadastrada.`}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cor</TableHead>
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
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-4 w-4 rounded" style={{ background: t.color }} />
                      <code className="text-xs text-muted-foreground">{t.color}</code>
                    </div>
                  </TableCell>
                  <TableCell>{usage[t.id] ?? 0}</TableCell>
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

      <TagDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        defaultCategory={category}
      />

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
              onClick={() => { if (toDelete) onDelete(toDelete.id); setToDelete(null); }}
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
  open, onOpenChange, editing, defaultCategory,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: TagWithUsage | null;
  defaultCategory: Category;
}) {
  const upsert = useUpsertTag();
  const [name, setName] = useState("");
  const [color, setColor] = useState(PALETTE[7]);
  const [entities, setEntities] = useState<string[]>([defaultCategory]);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setColor(editing?.color ?? PALETTE[7]);
    setEntities(
      editing?.entity_types && editing.entity_types.length > 0
        ? editing.entity_types
        : [defaultCategory],
    );
  }, [open, editing, defaultCategory]);

  const toggle = (k: string) =>
    setEntities((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  const submit = async () => {
    if (!name.trim() || entities.length === 0) return;
    try {
      await upsert.mutateAsync({
        id: editing?.id,
        name: name.trim(),
        color,
        entity_types: entities,
      });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Tag" : "Nova Tag"}</DialogTitle>
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
          <div>
            <label className="text-sm font-medium">Aplica em *</label>
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              {CATEGORIES.map((c) => (
                <label key={c.key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={entities.includes(c.key)} onCheckedChange={() => toggle(c.key)} />
                  {c.label}
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
          <Button
            onClick={submit}
            disabled={!name.trim() || entities.length === 0 || upsert.isPending}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
