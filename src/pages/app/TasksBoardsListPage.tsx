import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Archive, MoreHorizontal, Copy, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useTaskBoards, useCreateBoard, useUpdateBoard, useArchiveBoard, useDuplicateBoard,
  type TaskBoard,
} from "@/hooks/useTaskBoards";

const COLORS = ["#7c3aed", "#2563eb", "#0891b2", "#059669", "#ca8a04", "#dc2626", "#db2777", "#475569"];

export default function TasksBoardsListPage() {
  const navigate = useNavigate();
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState<TaskBoard | null>(null);

  const { data: boards = [], isLoading } = useTaskBoards(showArchived);
  const archive = useArchiveBoard();
  const dup = useDuplicateBoard();

  const filtered = useMemo(
    () => boards.filter((b) => b.name.toLowerCase().includes(search.toLowerCase())),
    [boards, search]
  );

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quadros de Tarefas</h1>
          <p className="text-sm text-muted-foreground">Organize seu trabalho em quadros estilo Trello</p>
        </div>
        <Button onClick={() => setOpenNew(true)} className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" /> Novo Quadro
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar quadros..." className="pl-9" />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="arch" checked={showArchived} onCheckedChange={setShowArchived} />
          <Label htmlFor="arch" className="text-sm cursor-pointer">Mostrar arquivados</Label>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-[16/10] rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhum quadro ainda"
          description="Crie seu primeiro quadro para organizar suas tarefas"
          action={<Button onClick={() => setOpenNew(true)}><Plus className="h-4 w-4 mr-2" /> Criar primeiro quadro</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((b) => (
            <div
              key={b.id}
              onClick={() => navigate(`/tarefas/${b.id}`)}
              className="group relative aspect-[16/10] rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:scale-[1.03] hover:shadow-xl shadow-md"
              style={{
                background: b.cover_image_url
                  ? `url(${b.cover_image_url}) center/cover`
                  : b.background_color ?? "#7c3aed",
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />
              <div className="absolute top-2 right-2 z-10" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-7 w-7 bg-black/30 hover:bg-black/50 text-white">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditing(b)}><Pencil className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => dup.mutate(b.id, { onSuccess: () => toast.success("Quadro duplicado") })}>
                      <Copy className="h-4 w-4 mr-2" />Duplicar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => archive.mutate(
                        { id: b.id, archive: !b.archived_at },
                        { onSuccess: () => toast.success(b.archived_at ? "Restaurado" : "Arquivado") }
                      )}
                    >
                      <Archive className="h-4 w-4 mr-2" />{b.archived_at ? "Restaurar" : "Arquivar"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="absolute inset-x-0 bottom-0 p-4">
                <h3 className="text-white font-semibold text-lg leading-tight line-clamp-2">{b.name}</h3>
                {b.description && <p className="text-white/80 text-xs mt-1 line-clamp-1">{b.description}</p>}
              </div>
              {b.archived_at && (
                <div className="absolute top-2 left-2 px-2 py-0.5 text-[10px] bg-black/60 text-white rounded">arquivado</div>
              )}
            </div>
          ))}
        </div>
      )}

      <BoardDialog open={openNew} onOpenChange={setOpenNew} />
      <BoardDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} board={editing} />
    </div>
  );
}

function BoardDialog({ open, onOpenChange, board }: { open: boolean; onOpenChange: (o: boolean) => void; board?: TaskBoard | null }) {
  const isEdit = !!board;
  const [name, setName] = useState(board?.name ?? "");
  const [desc, setDesc] = useState(board?.description ?? "");
  const [color, setColor] = useState(board?.background_color ?? COLORS[0]);
  const [cover, setCover] = useState(board?.cover_image_url ?? "");
  const [template, setTemplate] = useState("blank");
  const create = useCreateBoard();
  const update = useUpdateBoard();

  // reset on open
  useMemo(() => {
    if (open) {
      setName(board?.name ?? "");
      setDesc(board?.description ?? "");
      setColor(board?.background_color ?? COLORS[0]);
      setCover(board?.cover_image_url ?? "");
      setTemplate("blank");
    }
  }, [open, board]);

  const submit = async () => {
    if (!name.trim()) return toast.error("Informe um nome");
    if (isEdit) {
      await update.mutateAsync({ id: board!.id, patch: { name, description: desc || null, background_color: color, cover_image_url: cover || null } });
      toast.success("Quadro atualizado");
    } else {
      await create.mutateAsync({ name, description: desc, background_color: color, cover_image_url: cover || undefined, template });
      toast.success("Quadro criado");
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{isEdit ? "Editar quadro" : "Novo quadro"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Sprint Setembro" />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Cor de fundo</Label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn("h-8 w-8 rounded-md border-2 transition", color === c ? "border-foreground scale-110" : "border-transparent")}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>URL da capa (opcional)</Label>
            <Input value={cover} onChange={(e) => setCover(e.target.value)} placeholder="https://..." />
          </div>
          {!isEdit && (
            <div className="space-y-1.5">
              <Label>Template</Label>
              <Select value={template} onValueChange={setTemplate}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="blank">Em branco</SelectItem>
                  <SelectItem value="vendas">Time de Vendas</SelectItem>
                  <SelectItem value="produto">Time de Produto</SelectItem>
                  <SelectItem value="pessoal">Pessoal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit}>{isEdit ? "Salvar" : "Criar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
