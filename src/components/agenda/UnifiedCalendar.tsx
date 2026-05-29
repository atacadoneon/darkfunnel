import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalIcon, Video } from "lucide-react";
import {
  addDays, addMonths, addWeeks, endOfMonth, endOfWeek,
  format, isSameDay, isSameMonth, startOfMonth, startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useUnifiedCalendar, type CalendarKind, type UnifiedCalendarItem } from "@/hooks/useUnifiedCalendar";
import { useWorkspaceMembers } from "@/features/workspace/permissions";
import { CalendarFilters, KIND_META } from "./CalendarFilters";
import { EventDetailDrawer } from "./EventDetailDrawer";
import { NewEventDialog } from "./NewEventDialog";

type ViewMode = "month" | "week" | "day";

export function UnifiedCalendar() {
  const [cursor, setCursor] = useState(new Date());
  const [view, setView] = useState<ViewMode>("month");
  const [selected, setSelected] = useState<UnifiedCalendarItem | null>(null);
  const [newKind, setNewKind] = useState<"meeting" | "event" | null>(null);
  const [enabledKinds, setEnabledKinds] = useState<Set<CalendarKind>>(
    new Set(["meeting", "event", "task", "activity"])
  );
  const [selectedOwners, setSelectedOwners] = useState<Set<string>>(new Set());

  const { data: members = [] } = useWorkspaceMembers();
  const owners = useMemo(
    () => members.map((m: any) => ({ id: m.user_id ?? m.id, name: m.full_name ?? m.email ?? "—" })),
    [members]
  );

  const range = useMemo(() => {
    if (view === "month") {
      const mStart = startOfMonth(cursor);
      return { from: startOfWeek(mStart, { weekStartsOn: 0 }), to: endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 }) };
    }
    if (view === "week") {
      return { from: startOfWeek(cursor, { weekStartsOn: 0 }), to: endOfWeek(cursor, { weekStartsOn: 0 }) };
    }
    const dayStart = new Date(cursor);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(cursor);
    dayEnd.setHours(23, 59, 59, 999);
    return { from: dayStart, to: dayEnd };
  }, [cursor, view]);

  const { data: items = [] } = useUnifiedCalendar(range);

  const filtered = useMemo(
    () => items.filter((it) => enabledKinds.has(it.kind) && (selectedOwners.size === 0 || (it.owner_id && selectedOwners.has(it.owner_id)))),
    [items, enabledKinds, selectedOwners]
  );

  const title = view === "month"
    ? format(cursor, "MMMM yyyy", { locale: ptBR })
    : view === "week"
      ? `${format(startOfWeek(cursor, { weekStartsOn: 0 }), "dd MMM", { locale: ptBR })} – ${format(endOfWeek(cursor, { weekStartsOn: 0 }), "dd MMM yyyy", { locale: ptBR })}`
      : format(cursor, "PPP", { locale: ptBR });

  const step = (delta: number) => {
    if (view === "month") setCursor((c) => addMonths(c, delta));
    else if (view === "week") setCursor((c) => addWeeks(c, delta));
    else setCursor((c) => addDays(c, delta));
  };

  const goToday = () => setCursor(new Date());
  const changeView = (nextView: ViewMode) => setView(nextView);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <CalIcon className="h-4 w-4 text-primary" />
          <h1 className="text-base font-semibold">Agenda</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" onClick={() => step(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" onClick={goToday}>Hoje</Button>
          <Button size="icon" variant="outline" onClick={() => step(1)}><ChevronRight className="h-4 w-4" /></Button>
          <h2 className="text-sm font-medium capitalize ml-2">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex bg-muted/60 rounded-md p-0.5 gap-0.5">
            {(["month", "week", "day"] as ViewMode[]).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => changeView(v)}
                className={cn(
                  "px-2.5 py-1 rounded-sm text-xs",
                  view === v ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {v === "month" ? "Mês" : v === "week" ? "Semana" : "Dia"}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={() => setNewKind("event")}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Evento
          </Button>
          <Button size="sm" onClick={() => setNewKind("meeting")}>
            <Video className="h-3.5 w-3.5 mr-1" /> Nova reunião
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-[220px_1fr] gap-3 p-3 overflow-hidden">
        <CalendarFilters
          enabledKinds={enabledKinds}
          onChange={setEnabledKinds}
          owners={owners}
          selectedOwners={selectedOwners}
          onOwnersChange={setSelectedOwners}
        />

        <div className="min-h-0 overflow-auto">
          {view === "month" && <MonthGrid cursor={cursor} items={filtered} onSelect={setSelected} />}
          {view === "week" && <WeekGrid cursor={cursor} items={filtered} onSelect={setSelected} />}
          {view === "day" && <DayList cursor={cursor} items={filtered} onSelect={setSelected} />}
        </div>
      </div>

      <EventDetailDrawer item={selected} onOpenChange={(v) => !v && setSelected(null)} />
      <NewEventDialog
        open={!!newKind}
        onOpenChange={(v) => !v && setNewKind(null)}
        defaultKind={newKind ?? "meeting"}
      />
    </div>
  );
}

function MonthGrid({ cursor, items, onSelect }: { cursor: Date; items: UnifiedCalendarItem[]; onSelect: (it: UnifiedCalendarItem) => void }) {
  const monthStart = startOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  return (
    <Card className="p-2">
      <div className="grid grid-cols-7 gap-1 text-[11px]">
        {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((d) => (
          <div key={d} className="text-center font-semibold py-1 text-muted-foreground">{d}</div>
        ))}
        {days.map((d) => {
          const dayItems = items.filter((it) => isSameDay(new Date(it.starts_at), d));
          const dim = !isSameMonth(d, cursor);
          const today = isSameDay(d, new Date());
          return (
            <div
              key={d.toISOString()}
              className={cn("border rounded p-1 min-h-[88px]", dim && "opacity-40", today && "ring-1 ring-primary")}
            >
              <div className="text-[10px] font-bold mb-1">{format(d, "d")}</div>
              {dayItems.slice(0, 4).map((it) => (
                <button
                  key={it.id}
                  onClick={() => onSelect(it)}
                  className={cn(
                    "block w-full text-left text-[10px] truncate px-1 py-0.5 rounded mb-0.5 border",
                    KIND_META[it.kind].color
                  )}
                  title={it.title}
                >
                  {format(new Date(it.starts_at), "HH:mm")} {it.title}
                </button>
              ))}
              {dayItems.length > 4 && (
                <div className="text-[10px] text-muted-foreground">+{dayItems.length - 4}</div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function WeekGrid({ cursor, items, onSelect }: { cursor: Date; items: UnifiedCalendarItem[]; onSelect: (it: UnifiedCalendarItem) => void }) {
  const start = startOfWeek(cursor, { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const hours = Array.from({ length: 15 }, (_, i) => 8 + i);
  return (
    <Card className="p-2 overflow-auto">
      <div className="grid grid-cols-[60px_repeat(7,minmax(120px,1fr))] gap-px bg-border min-w-[800px]">
        <div className="bg-background" />
        {days.map((d) => (
          <div key={d.toISOString()} className="bg-background text-center text-xs font-semibold py-1">
            <div>{format(d, "EEE", { locale: ptBR })}</div>
            <div className={cn("text-[11px]", isSameDay(d, new Date()) && "text-primary font-bold")}>
              {format(d, "dd/MM")}
            </div>
          </div>
        ))}
        {hours.map((h) => (
          <>
            <div key={`h-${h}`} className="bg-background text-[10px] text-muted-foreground text-right pr-1 py-2">{h}:00</div>
            {days.map((d) => {
              const slotItems = items.filter((it) => {
                const dt = new Date(it.starts_at);
                return isSameDay(dt, d) && dt.getHours() === h;
              });
              return (
                <div key={`${h}-${d.toISOString()}`} className="bg-background min-h-[44px] p-0.5 space-y-0.5">
                  {slotItems.map((it) => (
                    <button
                      key={it.id}
                      onClick={() => onSelect(it)}
                      className={cn("block w-full text-left text-[10px] truncate px-1 py-0.5 rounded border", KIND_META[it.kind].color)}
                    >
                      {it.title}
                    </button>
                  ))}
                </div>
              );
            })}
          </>
        ))}
      </div>
    </Card>
  );
}

function DayList({ cursor, items, onSelect }: { cursor: Date; items: UnifiedCalendarItem[]; onSelect: (it: UnifiedCalendarItem) => void }) {
  const dayItems = items
    .filter((it) => isSameDay(new Date(it.starts_at), cursor))
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  return (
    <Card className="p-3 space-y-2">
      {dayItems.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-12">Nada agendado para hoje.</div>
      ) : (
        dayItems.map((it) => (
          <button
            key={it.id}
            onClick={() => onSelect(it)}
            className={cn("block w-full text-left rounded-md border p-3 hover:bg-muted/30 transition", KIND_META[it.kind].color)}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-sm">{it.title}</span>
              <span className="text-xs tabular-nums">{format(new Date(it.starts_at), "HH:mm")}</span>
            </div>
          </button>
        ))
      )}
    </Card>
  );
}
