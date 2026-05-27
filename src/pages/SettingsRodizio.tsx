import { useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Plus, Loader2, Users } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip } from "recharts";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useWorkspaceMembers, type WorkspaceMember } from "@/features/workspace/permissions";
import {
  useRotations,
  useRotationSlots,
  useWorkspacePresence,
  useAssignmentsToday,
  createRotation,
  updateRotation,
  addSlot,
  updateSlot,
  deleteSlot,
  reorderSlots,
  type RotationSlot,
} from "@/features/rodizio/hooks";

function presenceDotClass(s?: "online" | "away" | "offline") {
  if (s === "online") return "bg-emerald-500";
  if (s === "away") return "bg-amber-500";
  return "bg-rose-500";
}

function MemberBadge({
  member,
  presence,
}: {
  member?: WorkspaceMember;
  presence?: "online" | "away" | "offline";
}) {
  const name = member?.display_name || member?.email || "Usuário";
  const initial = name.trim().charAt(0).toUpperCase();
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="relative shrink-0">
        <Avatar className="h-7 w-7">
          {member?.avatar_url && <AvatarImage src={member.avatar_url} />}
          <AvatarFallback className="text-[10px]">{initial}</AvatarFallback>
        </Avatar>
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-background",
            presenceDotClass(presence),
          )}
        />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{name}</div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
          {presence ?? "offline"}
        </div>
      </div>
    </div>
  );
}

function SlotRow({
  slot,
  index,
  member,
  presence,
  activeCount,
  rotationActive,
  onToggleActive,
  onToggleSkip,
  onDelete,
}: {
  slot: RotationSlot;
  index: number;
  member?: WorkspaceMember;
  presence?: "online" | "away" | "offline";
  activeCount: number;
  rotationActive: boolean;
  onToggleActive: () => void;
  onToggleSkip: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: slot.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleToggleActive = () => {
    if (slot.is_active && rotationActive && activeCount <= 1) {
      toast.error("Mantenha pelo menos 1 vendedor ativo no rodízio.");
      return;
    }
    onToggleActive();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="grid grid-cols-[28px_28px_1fr_120px_120px_40px] gap-2 items-center px-2 py-2 border-b last:border-b-0 bg-background"
    >
      <button
        className="cursor-grab text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
        aria-label="Reordenar"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-xs text-muted-foreground tabular-nums">{index + 1}</span>
      <MemberBadge member={member} presence={presence} />
      <div className="flex items-center gap-2">
        <Switch checked={slot.is_active} onCheckedChange={handleToggleActive} />
        <span className="text-xs text-muted-foreground">Ativo</span>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            <Switch checked={slot.skip_if_offline} onCheckedChange={onToggleSkip} />
            <span className="text-xs text-muted-foreground">Pular offline</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          Se ligado, o lead pula para o próximo vendedor quando este estiver offline.
        </TooltipContent>
      </Tooltip>
      <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Remover">
        <Trash2 className="h-4 w-4 text-rose-500" />
      </Button>
    </div>
  );
}

export default function SettingsRodizio() {
  const { current } = useWorkspace();
  const { data: rotations = [], isLoading: rLoading } = useRotations();
  const rotation = rotations[0] ?? null;
  const { data: slots = [] } = useRotationSlots(rotation?.id ?? null);
  const { data: members = [] } = useWorkspaceMembers();
  const { data: presence = {} } = useWorkspacePresence();
  const { data: assignments = [] } = useAssignmentsToday(rotation?.id ?? null);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("Rodízio principal");
  const [picker, setPicker] = useState("");
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<RotationSlot | null>(null);

  const membersMap = useMemo(
    () => Object.fromEntries(members.map((m) => [m.user_id, m])),
    [members],
  );

  const activeCount = slots.filter((s) => s.is_active).length;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = slots.findIndex((s) => s.id === active.id);
    const newIdx = slots.findIndex((s) => s.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(slots, oldIdx, newIdx).map((s, i) => ({ id: s.id, position: i }));
    try {
      await reorderSlots(next);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleCreate = async () => {
    if (!current || !newName.trim()) return;
    setCreating(true);
    try {
      await createRotation(current.id, newName.trim());
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleAdd = async () => {
    if (!current || !rotation || !picker) return;
    setAdding(true);
    try {
      const position = (slots[slots.length - 1]?.position ?? -1) + 1;
      await addSlot(rotation.id, current.id, picker, position);
      setPicker("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAdding(false);
    }
  };

  // Stats
  const countsByUser = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of assignments) m[a.user_id] = (m[a.user_id] ?? 0) + 1;
    return m;
  }, [assignments]);

  const totalToday = assignments.length;

  const slotUsers = Array.from(new Set(slots.map((s) => s.user_id)));
  const pieData = slotUsers.map((uid) => ({
    name: membersMap[uid]?.display_name || membersMap[uid]?.email || "?",
    value: countsByUser[uid] ?? 0,
  }));

  const PIE_COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Rodízio de Leads</h1>
        <p className="text-sm text-muted-foreground">
          Distribua novos leads automaticamente entre vendedores por canal WhatsApp.
        </p>
      </header>

      {rLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : !rotation ? (
        <Card>
          <CardHeader>
            <CardTitle>Criar rodízio</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome do rodízio"
            />
            <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {rotation.name}
                  <Badge variant={rotation.is_active ? "default" : "secondary"}>
                    {rotation.is_active ? "Ativo" : "Pausado"}
                  </Badge>
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Ativo</span>
                <Switch
                  checked={rotation.is_active}
                  onCheckedChange={async (v) => {
                    try { await updateRotation(rotation.id, { is_active: v }); }
                    catch (e) { toast.error((e as Error).message); }
                  }}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {slots.length === 0 ? (
                <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                  <Users className="h-6 w-6 mx-auto mb-2 opacity-60" />
                  Adicione vendedores ao rodízio. Se todos estiverem offline, o lead será atribuído para quem
                  está na vez (não fica órfão).
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <div className="grid grid-cols-[28px_28px_1fr_120px_120px_40px] gap-2 px-2 py-2 bg-muted/40 text-[11px] font-medium text-muted-foreground uppercase tracking-wide border-b">
                    <span />
                    <span>#</span>
                    <span>Vendedor</span>
                    <span>Status</span>
                    <span>Offline</span>
                    <span />
                  </div>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={slots.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                      {slots.map((s, idx) => (
                        <SlotRow
                          key={s.id}
                          slot={s}
                          index={idx}
                          member={membersMap[s.user_id]}
                          presence={presence[s.user_id]?.status}
                          activeCount={activeCount}
                          rotationActive={rotation.is_active}
                          onToggleActive={async () => {
                            try { await updateSlot(s.id, { is_active: !s.is_active }); }
                            catch (e) { toast.error((e as Error).message); }
                          }}
                          onToggleSkip={async () => {
                            try { await updateSlot(s.id, { skip_if_offline: !s.skip_if_offline }); }
                            catch (e) { toast.error((e as Error).message); }
                          }}
                          onDelete={() => {
                            if (s.is_active) setConfirmDelete(s);
                            else void deleteSlot(s.id).catch((e) => toast.error((e as Error).message));
                          }}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </div>
              )}

              <div className="flex items-end gap-2 pt-2 border-t">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Adicionar vendedor (pode repetir para aumentar peso)
                  </label>
                  <Select value={picker} onValueChange={setPicker}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolher vendedor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((m) => {
                        const st = presence[m.user_id]?.status;
                        const name = m.display_name || m.email || m.user_id;
                        return (
                          <SelectItem key={m.user_id} value={m.user_id}>
                            <div className="flex items-center gap-2">
                              <span className={cn("h-2 w-2 rounded-full", presenceDotClass(st))} />
                              {name}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAdd} disabled={!picker || adding}>
                  {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" /> Adicionar</>}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Atribuições hoje · {totalToday}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {totalToday === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-6">
                  Nenhuma atribuição hoje ainda.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                          {pieData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <RTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                      Equilíbrio
                    </div>
                    {slotUsers.map((uid, i) => {
                      const count = countsByUser[uid] ?? 0;
                      const pct = totalToday ? Math.round((count / totalToday) * 100) : 0;
                      const m = membersMap[uid];
                      return (
                        <div key={uid} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="truncate">
                              {m?.display_name || m?.email || "Usuário"}
                            </span>
                            <span className="tabular-nums text-muted-foreground">
                              {count} · {pct}%
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover vendedor do rodízio?</AlertDialogTitle>
            <AlertDialogDescription>
              Este slot está ativo. Remover pode desbalancear a distribuição de leads.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmDelete) return;
                try { await deleteSlot(confirmDelete.id); }
                catch (e) { toast.error((e as Error).message); }
                finally { setConfirmDelete(null); }
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
