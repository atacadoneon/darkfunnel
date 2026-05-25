import { useMemo, useState } from "react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  format, isSameMonth, isSameDay, isToday, addMonths, subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, MapPin, Link as LinkIcon, Clock, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useMeetings } from "@/hooks/useMeetings";
import { MeetingDialog } from "@/features/meetings/MeetingDialog";
import { EmptyState } from "@/components/EmptyState";
import type { Meeting } from "@/types/meeting";

export default function Meetings() {
  const { data: meetings = [] } = useMeetings();
  const [cursor, setCursor] = useState<Date>(new Date());
  const [selected, setSelected] = useState<Date>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Meeting | null>(null);

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const periodMeetings = useMemo(
    () => meetings.filter((m) => {
      const s = new Date(m.starts_at);
      return s >= monthStart && s <= monthEnd;
    }),
    [meetings, monthStart, monthEnd]
  );

  const now = new Date();
  const upcoming = useMemo(
    () => meetings.filter((m) => new Date(m.starts_at) >= now).slice(0, 50).length,
    [meetings, now]
  );
  const dayMeetings = useMemo(
    () => meetings.filter((m) => isSameDay(new Date(m.starts_at), selected))
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
    [meetings, selected]
  );
  const withLocation = useMemo(
    () => periodMeetings.filter((m) => m.location || m.meeting_url).length,
    [periodMeetings]
  );

  const handleNew = (d?: Date) => {
    setEditing(null);
    if (d) setSelected(d);
    setDialogOpen(true);
  };
  const handleEdit = (m: Meeting) => { setEditing(m); setDialogOpen(true); };

  const Kpi = ({ icon: Icon, label, value, tone = "default" }: { icon: typeof CalendarIcon; label: string; value: number; tone?: string }) => (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        <Icon className={cn("h-4 w-4", tone === "primary" ? "text-primary" : "text-muted-foreground")} />
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight">{value}</div>
    </Card>
  );

  const weekDayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="border-b px-3 h-10 flex items-center gap-2">
        <CalendarIcon className="h-3.5 w-3.5 text-primary" />
        <h1 className="text-sm font-medium">Reuniões</h1>
        <span className="text-[11px] text-muted-foreground">· {meetings.length}</span>
        <div className="flex-1" />
        <Button size="sm" className="h-7 text-xs" onClick={() => handleNew()}>
          <Plus className="h-3 w-3 mr-1" /> Novo
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi icon={CalendarIcon} label="No período" value={periodMeetings.length} tone="primary" />
          <Kpi icon={Clock} label="Próximas" value={upcoming} />
          <Kpi icon={CalendarIcon} label="Dia selecionado" value={dayMeetings.length} />
          <Kpi icon={MapPin} label="Com local" value={withLocation} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold capitalize">
                {format(cursor, "MMMM yyyy", { locale: ptBR })}
              </h3>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" onClick={() => setCursor(subMonths(cursor, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => setCursor(new Date())}>
                  Hoje
                </Button>
                <Button size="sm" variant="outline" onClick={() => setCursor(addMonths(cursor, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-px text-center text-[11px] font-medium text-muted-foreground mb-1">
              {weekDayLabels.map((w) => <div key={w} className="py-1">{w}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden">
              {days.map((d) => {
                const isCurMonth = isSameMonth(d, cursor);
                const isSel = isSameDay(d, selected);
                const dayMs = meetings.filter((m) => isSameDay(new Date(m.starts_at), d));
                return (
                  <button
                    key={d.toISOString()}
                    onClick={() => setSelected(d)}
                    className={cn(
                      "aspect-square bg-background p-1.5 flex flex-col items-start text-left transition-colors hover:bg-muted/50",
                      !isCurMonth && "opacity-40",
                      isSel && "ring-2 ring-primary ring-inset z-10"
                    )}
                  >
                    <span className={cn(
                      "text-xs font-medium h-5 w-5 rounded-full flex items-center justify-center",
                      isToday(d) && "bg-primary text-primary-foreground"
                    )}>
                      {format(d, "d")}
                    </span>
                    <div className="mt-1 space-y-0.5 w-full">
                      {dayMs.slice(0, 2).map((m) => (
                        <div key={m.id} className="truncate text-[10px] px-1 py-0.5 rounded bg-primary/15 text-primary">
                          {m.title}
                        </div>
                      ))}
                      {dayMs.length > 2 && (
                        <div className="text-[10px] text-muted-foreground">+{dayMs.length - 2}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm capitalize">
                {format(selected, "EEEE, dd 'de' MMM", { locale: ptBR })}
              </h3>
              <Button size="sm" variant="outline" onClick={() => handleNew(selected)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
              </Button>
            </div>

            {dayMeetings.length === 0 ? (
              <div className="py-6">
                <EmptyState
                  icon={CalendarIcon}
                  title="Sem eventos"
                  description="Nenhum evento agendado para este dia."
                  action={
                    <Button size="sm" onClick={() => handleNew(selected)}>
                      <Plus className="h-4 w-4 mr-1.5" /> Adicionar evento
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="space-y-2">
                {dayMeetings.map((m) => (
                  <Card
                    key={m.id}
                    onClick={() => handleEdit(m)}
                    className="p-3 cursor-pointer hover:border-primary/40 transition-colors space-y-1.5"
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 font-medium text-sm">{m.title}</div>
                      <Badge variant="outline" className="text-[10px]">{m.status}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(m.starts_at), "HH:mm")} – {format(new Date(m.ends_at), "HH:mm")}
                    </div>
                    {m.location && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {m.location}
                      </div>
                    )}
                    {m.meeting_url && (
                      <a
                        href={m.meeting_url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-primary inline-flex items-center gap-1 hover:underline"
                      >
                        <Video className="h-3 w-3" /> Entrar na reunião
                      </a>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <MeetingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        meeting={editing}
        defaultDate={selected}
      />
    </div>
  );
}
