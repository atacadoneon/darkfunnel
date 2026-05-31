import { useMemo, useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  DndContext, DragOverlay, PointerSensor, closestCorners, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent, type DragOverEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, horizontalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import {
  ArrowLeft, Plus, MoreHorizontal, Search, Clock, Paperclip, MessageSquare, CheckSquare, Pencil, Archive, X,
} from "lucide-react";
import { format, isPast, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  useBoardColumns, useCreateColumn, useUpdateColumn, useArchiveColumn, useReorderColumns,
  useBoardCards, useCreateCard, useUpdateCard, useMoveCard,
  type TaskColumn as TColumn, type TaskCardLite,
} from "@/hooks/useTaskBoards";

const db = supabase as any;

function useBoardMeta(boardId?: string) {
  return useQuery({
    queryKey: ["task_board_meta", boardId],
    enabled: !!boardId,
    queryFn: async () => {
      const { data, error } = await db.from("task_boards").select("*").eq("id", boardId).single();
      if (error) throw error;
      return data;
    },
  });
}

export default function TaskBoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const { data: board } = useBoardMeta(boardId);
  const { data: columns = [], isLoading: loadingCols } = useBoardColumns(boardId);
  const { data: cards = [] } = useBoardCards(boardId);
  const createCol = useCreateColumn();
  const updateCol = useUpdateColumn();
  const archiveCol = useArchiveColumn();
  const reorderCols = useReorderColumns();
  const createCard = useCreateCard();
  const moveCard = useMoveCard();

  const [search, setSearch] = useState("");
  const [activeCard, setActiveCard] = useState<TaskCardLite | null>(null);
  const [openCard, setOpenCard] = useState<TaskCardLite | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [addingCol, setAddingCol] = useState(false);
  const [newColName, setNewColName] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const cardsByCol = useMemo(() => {
    const m = new Map<string, TaskCardLite[]>();
    columns.forEach((c) => m.set(c.id, []));
    const q = search.toLowerCase();
    cards
      .filter((c) => !q || c.title.toLowerCase().includes(q))
      .forEach((c) => {
        if (!m.has(c.column_id)) m.set(c.column_id, []);
        m.get(c.column_id)!.push(c);
      });
    return m;
  }, [columns, cards, search]);

  const handleDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id);
    const card = cards.find((c) => c.id === id);
    if (card) setActiveCard(card);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveCard(null);
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const card = cards.find((c) => c.id === activeId);
    if (!card) return;

    // dropped on column
    let targetColumnId = overId;
    let targetIndex = -1;
    const overCard = cards.find((c) => c.id === overId);
    if (overCard) {
      targetColumnId = overCard.column_id;
      const colCards = cardsByCol.get(targetColumnId) ?? [];
      targetIndex = colCards.findIndex((c) => c.id === overId);
    }
    const colCards = cardsByCol.get(targetColumnId) ?? [];
    const newPos = targetIndex < 0
      ? (colCards[colCards.length - 1]?.position ?? 0) + 1000
      : targetIndex === 0
        ? (colCards[0].position ?? 0) - 1000
        : ((colCards[targetIndex - 1].position + colCards[targetIndex].position) / 2);

    moveCard.mutate({ card_id: card.id, column_id: targetColumnId, position: newPos });
  };

  const saveTitle = async () => {
    if (!boardId) return;
    const v = titleDraft.trim();
    if (!v || v === board?.name) return setEditingTitle(false);
    await db.from("task_boards").update({ name: v }).eq("id", boardId);
    setEditingTitle(false);
    toast.success("Renomeado");
  };

  const addColumn = async () => {
    const v = newColName.trim();
    if (!v || !boardId) return;
    await createCol.mutateAsync({ board_id: boardId, name: v, sort_order: columns.length });
    setNewColName("");
    setAddingCol(false);
  };

  const bgStyle = board?.cover_image_url
    ? { background: `url(${board.cover_image_url}) center/cover fixed` }
    : { background: board?.background_color ?? "hsl(var(--background))" };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden" style={bgStyle}>
      <div className="sticky top-0 z-20 bg-background/85 backdrop-blur border-b">
        <div className="flex items-center gap-3 px-4 py-3 flex-wrap">
          <Button size="icon" variant="ghost" onClick={() => navigate("/tarefas")}><ArrowLeft className="h-4 w-4" /></Button>
          {editingTitle ? (
            <Input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
              className="h-8 w-64 font-semibold"
            />
          ) : (
            <h1
              className="text-lg font-semibold cursor-pointer hover:bg-muted/50 rounded px-2 py-1"
              onClick={() => { setTitleDraft(board?.name ?? ""); setEditingTitle(true); }}
            >
              {board?.name ?? "Quadro"}
            </h1>
          )}
          <div className="flex-1" />
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cartões..." className="pl-8 h-8" />
          </div>
        </div>
      </div>

      {loadingCols ? (
        <div className="flex gap-3 p-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-96 w-[280px] shrink-0 rounded-xl" />)}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex-1 overflow-x-auto overflow-y-hidden">
            <div className="inline-flex items-start gap-3 p-4 h-full">
              {columns.map((col) => (
                <BoardColumn
                  key={col.id}
                  column={col}
                  cards={cardsByCol.get(col.id) ?? []}
                  onAddCard={async (title) => {
                    if (!boardId) return;
                    const list = cardsByCol.get(col.id) ?? [];
                    const pos = (list[list.length - 1]?.position ?? 0) + 1000;
                    await createCard.mutateAsync({ board_id: boardId, column_id: col.id, title, position: pos });
                  }}
                  onRename={(name) => updateCol.mutate({ id: col.id, patch: { name } })}
                  onArchive={() => archiveCol.mutate(col.id)}
                  onOpenCard={(c) => setOpenCard(c)}
                />
              ))}

              <div className="w-[280px] shrink-0">
                {addingCol ? (
                  <div className="bg-muted/80 backdrop-blur rounded-xl p-2 space-y-2 border">
                    <Input
                      autoFocus
                      value={newColName}
                      onChange={(e) => setNewColName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") addColumn(); if (e.key === "Escape") { setAddingCol(false); setNewColName(""); } }}
                      placeholder="Nome da lista..."
                      className="h-8"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={addColumn}>Adicionar</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setAddingCol(false); setNewColName(""); }}><X className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    onClick={() => setAddingCol(true)}
                    className="w-full justify-start bg-background/70 hover:bg-background backdrop-blur border border-dashed h-10"
                  >
                    <Plus className="h-4 w-4 mr-2" /> Nova lista
                  </Button>
                )}
              </div>
            </div>
          </div>
          <DragOverlay>
            {activeCard && <CardItem card={activeCard} onOpen={() => {}} dragging />}
          </DragOverlay>
        </DndContext>
      )}

      <Dialog open={!!openCard} onOpenChange={(o) => !o && setOpenCard(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{openCard?.title}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Editor completo de cartão (descrição, membros, labels, checklist, anexos, comentários) em breve.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ============ COLUMN ============ */

function BoardColumn({
  column, cards, onAddCard, onRename, onArchive, onOpenCard,
}: {
  column: TColumn;
  cards: TaskCardLite[];
  onAddCard: (title: string) => void | Promise<void>;
  onRename: (name: string) => void;
  onArchive: () => void;
  onOpenCard: (c: TaskCardLite) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(column.name);

  const submit = async () => {
    const v = draft.trim();
    if (!v) return;
    await onAddCard(v);
    setDraft("");
  };

  return (
    <div className="w-[280px] shrink-0 flex flex-col max-h-full">
      <div className="bg-muted/85 backdrop-blur rounded-xl flex flex-col max-h-full border shadow-sm">
        <div className="flex items-center gap-2 p-2 pl-3 border-b">
          <span className="h-2 w-2 rounded-full" style={{ background: column.color ?? "#94a3b8" }} />
          {renaming ? (
            <Input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={() => { if (nameDraft.trim() && nameDraft !== column.name) onRename(nameDraft.trim()); setRenaming(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setNameDraft(column.name); setRenaming(false); } }}
              className="h-7 flex-1"
            />
          ) : (
            <button onClick={() => setRenaming(true)} className="flex-1 text-left text-sm font-semibold truncate hover:bg-background/40 rounded px-1 py-0.5">
              {column.name}
            </button>
          )}
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{cards.length}</Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-6 w-6"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setRenaming(true)}><Pencil className="h-3.5 w-3.5 mr-2" />Renomear</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onArchive} className="text-destructive"><Archive className="h-3.5 w-3.5 mr-2" />Arquivar</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div
          ref={setNodeRef}
          className={cn("flex-1 overflow-y-auto p-2 space-y-2 min-h-[60px] transition-colors", isOver && "bg-primary/5")}
        >
          <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {cards.map((c) => <SortableCard key={c.id} card={c} onOpen={() => onOpenCard(c)} />)}
          </SortableContext>
        </div>

        <div className="p-2 border-t">
          {adding ? (
            <div className="space-y-2">
              <Textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } if (e.key === "Escape") { setAdding(false); setDraft(""); } }}
                placeholder="Título do cartão..."
                rows={2}
                className="text-sm resize-none"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={submit}>Adicionar</Button>
                <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setDraft(""); }}><X className="h-4 w-4" /></Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" size="sm" className="w-full justify-start h-8 text-muted-foreground" onClick={() => setAdding(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar cartão
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============ CARD ============ */

function SortableCard({ card, onOpen }: { card: TaskCardLite; onOpen: () => void }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: card.id });
  const style = { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <CardItem card={card} onOpen={onOpen} />
    </div>
  );
}

function CardItem({ card, onOpen, dragging }: { card: TaskCardLite; onOpen: () => void; dragging?: boolean }) {
  const due = card.due_date ? new Date(card.due_date) : null;
  const overdue = due && isPast(due) && !card.is_done;
  const soon = due && !overdue && differenceInDays(due, new Date()) <= 3;
  return (
    <div
      onClick={onOpen}
      className={cn(
        "bg-card border rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden",
        dragging && "ring-2 ring-primary shadow-lg"
      )}
    >
      {card.cover_image_url && (
        <div className="aspect-[16/9] bg-muted" style={{ background: `url(${card.cover_image_url}) center/cover` }} />
      )}
      <div className="p-3 space-y-2">
        {!!card.labels?.length && (
          <div className="flex gap-1 flex-wrap">
            {card.labels.slice(0, 4).map((l) => (
              <span key={l.id} className="h-1.5 w-8 rounded-full" style={{ background: l.color }} title={l.name} />
            ))}
            {card.labels.length > 4 && <span className="text-[10px] text-muted-foreground">+{card.labels.length - 4}</span>}
          </div>
        )}
        <div className={cn("text-sm font-medium line-clamp-2 leading-snug", card.is_done && "line-through opacity-60")}>
          {card.title}
        </div>
        <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground flex-wrap">
          {due && (
            <span className={cn("inline-flex items-center gap-1", overdue && "text-destructive font-medium", soon && !overdue && "text-amber-600")}>
              <Clock className="h-3 w-3" />
              {format(due, "dd MMM", { locale: ptBR })}
            </span>
          )}
          {!!card.checklist_total && (
            <span className="inline-flex items-center gap-1"><CheckSquare className="h-3 w-3" />{card.checklist_done ?? 0}/{card.checklist_total}</span>
          )}
          {!!card.attachments_count && (
            <span className="inline-flex items-center gap-1"><Paperclip className="h-3 w-3" />{card.attachments_count}</span>
          )}
          {!!card.comments_count && (
            <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" />{card.comments_count}</span>
          )}
        </div>
      </div>
    </div>
  );
}
