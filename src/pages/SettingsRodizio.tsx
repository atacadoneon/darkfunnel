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
import {
  GripVertical, Trash2, Plus, Loader2, Users,
  ChevronDown, ChevronRight, MessageCircle, Phone,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip } from "recharts";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useWorkspaceMembers, type WorkspaceMember } from "@/features/workspace/permissions";
import { useChannels, type ChannelRow } from "@/features/channels/hooks";
import {
  useRotations, useRotationSlots, useWorkspacePresence, useAssignmentsToday,
  ensureRotationForChannel, updateRotation, addSlot, updateSlot, deleteSlot, reorderSlots,
  type LeadRotation, type RotationSlot,
} from "@/features/rodizio/hooks";

type PresenceStatus = "online" | "away" | "offline";

function presenceDotClass(s?: PresenceStatus) {
  if (s === "online") return "bg-emerald-500";
  if (s === "away") return "bg-amber-500";
  return "bg-muted-foreground/50";
}

function presenceLabel(s?: PresenceStatus) {
  if (s === "online") return "Online";
  if (s === "away") return "Ausente";
  return "Offline";
}

function relativeFromNow(iso?: string | null) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const diff = Math.max(0, Date.now() - t);
  const s = Math.floor(diff / 1000);
  if (s < 60) return "agora há pouco";
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} d`;
}

function MemberBadge({
  member, presence, lastSeenAt,
}: { member?: WorkspaceMember; presence?: PresenceStatus; lastSeenAt?: string | null }) {
  const name = member?.display_name || member?.email || "Usuário";
  const initial = name.trim().charAt(0).toUpperCase();
  const rel = relativeFromNow(lastSeenAt);
  const tip = presence === "online"
    ? "Online agora"
    : `${presenceLabel(presence)}${rel ? ` · visto ${rel}` : ""}`;
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative shrink-0">
            <Avatar className="h-7 w-7">
              {member?.avatar_url && <AvatarImage src={member.avatar_url} />}
              <AvatarFallback className="text-[10px]">{initial}</AvatarFallback>
            </Avatar>
            <span className={cn(
              "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-background",
              presenceDotClass(presence),
            )} />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">{tip}</TooltipContent>
      </Tooltip>
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{name}</div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
          {presenceLabel(presence)}{presence !== "online" && rel ? ` · ${rel}` : ""}
        </div>
      </div>
    </div>
  );
}

const SLOT_GRID = "grid grid-cols-[28px_36px_88px_1fr_150px_64px_40px] gap-2 items-center";

function SlotRow({
  slot, index, member, presence, lastSeenAt, activeCount, rotationActive, todayCount, isNext,
  onToggleActive, onToggleSkip, onDelete,
}: {
  slot: RotationSlot;
  index: number;
  member?: WorkspaceMember;
  presence?: PresenceStatus;
  lastSeenAt?: string | null;
  activeCount: number;
  rotationActive: boolean;
  todayCount: number;
  isNext?: boolean;
  onToggleActive: () => void;
  onToggleSkip: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slot.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

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
      className={cn(
        SLOT_GRID,
        "px-2 py-2 border-b last:border-b-0 bg-background",
        isNext && "bg-blue-500/5",
      )}
    >
      <button className="cursor-grab text-muted-foreground hover:text-foreground" {...attributes} {...listeners} aria-label="Reordenar">
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-xs text-muted-foreground tabular-nums text-center">{index + 1}</span>
      <div className="flex items-center gap-2">
        <Switch checked={slot.is_active} onCheckedChange={handleToggleActive} />
        {isNext ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge className="bg-blue-500 hover:bg-blue-500 text-white border-0 px-1.5 py-0 h-5 text-[10px] font-semibold uppercase tracking-wide">
                Próximo
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top">Próximo a receber lead deste rodízio</TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-xs text-muted-foreground">Ativo</span>
        )}
      </div>
      <MemberBadge member={member} presence={presence} lastSeenAt={lastSeenAt} />
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
      <span className="text-sm font-medium tabular-nums text-center">{todayCount}</span>
      <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Remover">
        <Trash2 className="h-4 w-4 text-rose-500" />
      </Button>
    </div>
  );
}

const PIE_COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

function ChannelRotationCard({
  channel, members, membersMap, presence,
}: {
  channel: ChannelRow;
  members: WorkspaceMember[];
  membersMap: Record<string, WorkspaceMember>;
  presence: Record<string, { status: PresenceStatus; last_seen_at?: string | null }>;
}) {
  const { current } = useWorkspace();
  const { data: rotations = [] } = useRotations();
  const rotation: LeadRotation | null = useMemo(
    () => rotations.find((r) => r.channel_id === channel.id) ?? null,
    [rotations, channel.id],
  );
  const { data: slots = [] } = useRotationSlots(rotation?.id ?? null);
  const { data: assignments = [] } = useAssignmentsToday(rotation?.id ?? null);

  const [open, setOpen] = useState<boolean | null>(null);
  const isOpen = open ?? !!rotation;
  const [ensuring, setEnsuring] = useState(false);
  const [picker, setPicker] = useState("");
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<RotationSlot | null>(null);

  const activeCount = slots.filter((s) => s.is_active).length;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const ensure = async () => {
    if (!current || rotation || ensuring) return rotation;
    setEnsuring(true);
    try {
      return await ensureRotationForChannel(current.id, channel.id, `Rodízio · ${channel.display_name}`);
    } finally {
      setEnsuring(false);
    }
  };

  const handleToggleOpen = () => setOpen(!isOpen);

  const handleCreateRotation = async () => {
    try { await ensure(); }
    catch (e) { toast.error((e as Error).message); }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = slots.findIndex((s) => s.id === active.id);
    const newIdx = slots.findIndex((s) => s.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(slots, oldIdx, newIdx).map((s, i) => ({ id: s.id, position: i }));
    try { await reorderSlots(next); }
    catch (e) { toast.error((e as Error).message); }
  };

  const handleAdd = async () => {
    if (!current || !picker) return;
    setAdding(true);
    try {
      const r = rotation ?? (await ensure());
      if (!r) return;
      const position = (slots[slots.length - 1]?.position ?? -1) + 1;
      await addSlot(r.id, current.id, picker, position);
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
    for (const a of assignments) m[a.assigned_user_id] = (m[a.assigned_user_id] ?? 0) + 1;
    return m;
  }, [assignments]);
  const totalToday = assignments.length;
  const slotUsers = Array.from(new Set(slots.map((s) => s.user_id)));
  const pieData = slotUsers.map((uid) => ({
    name: membersMap[uid]?.display_name || membersMap[uid]?.email || "?",
    value: countsByUser[uid] ?? 0,
  }));

  return (
    <Card>
      <button
        type="button"
        onClick={handleToggleOpen}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
      >
        {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <div className="h-9 w-9 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
          <Phone className="h-4 w-4 text-emerald-600" fill="currentColor" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold tabular-nums">
              {channel.phone_e164 ?? "—"}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="font-medium truncate">{channel.display_name}</span>
            {rotation ? (
              <Badge variant={rotation.is_active ? "default" : "secondary"} className="text-[10px]">
                {rotation.is_active ? "Ativo" : "Pausado"}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">Sem rodízio</Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {slots.length} vendedor{slots.length === 1 ? "" : "es"} · {totalToday} atribuição{totalToday === 1 ? "" : "s"} hoje
          </div>
        </div>
        {rotation && (
          <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
            <span className="text-xs text-muted-foreground">
              {rotation.is_active ? "Ativo" : "Pausado"}
            </span>
            <Switch
              checked={rotation.is_active}
              onCheckedChange={async (v) => {
                try { await updateRotation(rotation.id, { is_active: v }); }
                catch (e) { toast.error((e as Error).message); }
              }}
            />
          </div>
        )}
      </button>

      {isOpen && (
        <CardContent className="border-t pt-4 space-y-4">
          {!rotation ? (
            <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center space-y-3">
              <Users className="h-7 w-7 mx-auto opacity-60 text-muted-foreground" />
              <div className="space-y-1">
                <div className="text-sm font-medium">Sem rodízio configurado para este canal</div>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Crie um rodízio para distribuir automaticamente novos leads deste canal entre vendedores.
                </p>
              </div>
              <Button onClick={handleCreateRotation} disabled={ensuring}>
                {ensuring ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" /> Criar rodízio neste canal</>}
              </Button>
            </div>
          ) : slots.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              <Users className="h-6 w-6 mx-auto mb-2 opacity-60" />
              Adicione vendedores ao rodízio. Se todos estiverem offline, o lead será atribuído para quem está na vez (não fica órfão).
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <div className={cn(SLOT_GRID, "px-2 py-2 bg-muted/40 text-[11px] font-medium text-muted-foreground uppercase tracking-wide border-b")}>
                <span />
                <span className="text-center">#</span>
                <span>Ativo</span>
                <span>Vendedor</span>
                <span>Pular offline</span>
                <span className="text-center">Hoje</span>
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
                      lastSeenAt={presence[s.user_id]?.last_seen_at}
                      activeCount={activeCount}
                      rotationActive={rotation?.is_active ?? false}
                      todayCount={countsByUser[s.user_id] ?? 0}
                      isNext={rotation?.next_slot_id === s.id}
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

          {rotation && (
            <div className="flex items-end gap-2 pt-2 border-t">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">
                  Adicionar vendedor (pode repetir para aumentar peso)
                </label>
                <Select value={picker} onValueChange={setPicker}>
                  <SelectTrigger><SelectValue placeholder="Escolher vendedor..." /></SelectTrigger>
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
          )}

          {totalToday > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                  Atribuições hoje · {totalToday}
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70}>
                        {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <RTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Equilíbrio</div>
                {slotUsers.map((uid, i) => {
                  const count = countsByUser[uid] ?? 0;
                  const pct = totalToday ? Math.round((count / totalToday) * 100) : 0;
                  const m = membersMap[uid];
                  return (
                    <div key={uid} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="truncate">{m?.display_name || m?.email || "Usuário"}</span>
                        <span className="tabular-nums text-muted-foreground">{count} · {pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full" style={{
                          width: `${pct}%`,
                          backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
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
            <AlertDialogAction onClick={async () => {
              if (!confirmDelete) return;
              try { await deleteSlot(confirmDelete.id); }
              catch (e) { toast.error((e as Error).message); }
              finally { setConfirmDelete(null); }
            }}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export default function SettingsRodizio() {
  const { data: channels = [], isLoading } = useChannels();
  const { data: members = [] } = useWorkspaceMembers();
  const { data: presence = {} } = useWorkspacePresence();

  const whatsappChannels = useMemo(
    () => channels.filter(
      (c) => (c.kind === "uazapi" || c.kind === "whatsapp_cloud")
        && c.status === "connected"
        && !c.deleted_at,
    ),
    [channels],
  );

  const membersMap = useMemo(
    () => Object.fromEntries(members.map((m) => [m.user_id, m])),
    [members],
  );

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Rodízio de Leads</h1>
        <p className="text-sm text-muted-foreground">
          Distribua novos leads automaticamente entre vendedores por canal WhatsApp.
        </p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : whatsappChannels.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <MessageCircle className="h-8 w-8 mx-auto mb-3 text-muted-foreground opacity-60" />
          <h3 className="font-semibold">Nenhum canal WhatsApp conectado</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Conecte um canal em <b>Configurações → Canais</b> para configurar o rodízio.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {whatsappChannels.map((ch) => (
            <ChannelRotationCard
              key={ch.id}
              channel={ch}
              members={members}
              membersMap={membersMap}
              presence={presence}
            />
          ))}
        </div>
      )}
    </div>
  );
}
