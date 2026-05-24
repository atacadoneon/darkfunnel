import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, ChevronLeft, ChevronRight, Plus, Video } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { addDays, addMonths, endOfMonth, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from "date-fns";

export default function Agenda() {
  const { current } = useWorkspace();
  const wsId = current?.id;
  const qc = useQueryClient();
  const [cursor, setCursor] = useState(new Date());
  const [openNew, setOpenNew] = useState(false);

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });

  const { data: events = [] } = useQuery({
    queryKey: ["calendar-events", wsId, monthStart.toISOString()],
    enabled: !!wsId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_events").select("*")
        .eq("workspace_id", wsId)
        .gte("starts_at", monthStart.toISOString())
        .lte("starts_at", monthEnd.toISOString())
        .order("starts_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const days = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)), [gridStart]);

  return (
    <div className="h-full overflow-y-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Calendar className="h-6 w-6" /> Agenda</h1>
          <p className="text-sm text-muted-foreground">Reuniões e eventos do workspace</p>
        </div>
        <Button onClick={() => setOpenNew(true)}><Plus className="h-4 w-4 mr-1" /> Nova reunião</Button>
      </div>

      <Card className="p-3 flex items-center justify-between bg-muted/30">
        <div className="text-sm">
          <span className="font-medium">Conecte seu Google Calendar</span>
          <span className="text-muted-foreground ml-2">para sincronizar eventos automaticamente.</span>
        </div>
        <Button size="sm" variant="outline" onClick={() => toast.info("Em breve")}>Conectar Google</Button>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">{format(cursor, "MMMM yyyy")}</h2>
          <div className="flex gap-1">
            <Button size="icon" variant="outline" onClick={() => setCursor(c => addMonths(c, -1))}><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" onClick={() => setCursor(new Date())}>Hoje</Button>
            <Button size="icon" variant="outline" onClick={() => setCursor(c => addMonths(c, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-xs">
          {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(d => <div key={d} className="text-center font-semibold py-1 text-muted-foreground">{d}</div>)}
          {days.map(d => {
            const dayEvents = (events as any[]).filter(e => isSameDay(new Date(e.starts_at), d));
            const dim = !isSameMonth(d, cursor);
            const today = isSameDay(d, new Date());
            return (
              <div key={d.toISOString()} className={`border rounded p-1 min-h-[80px] ${dim ? "opacity-40" : ""} ${today ? "ring-1 ring-primary" : ""}`}>
                <div className="text-[10px] font-bold mb-1">{format(d, "d")}</div>
                {dayEvents.slice(0, 3).map(e => (
                  <div key={e.id} className="text-[10px] truncate px-1 py-0.5 rounded bg-primary/10 text-primary mb-0.5 flex items-center gap-1">
                    {e.conference_url && <Video className="h-2.5 w-2.5 shrink-0" />}
                    <span className="truncate">{e.title}</span>
                  </div>
                ))}
                {dayEvents.length > 3 && <div className="text-[10px] text-muted-foreground">+{dayEvents.length - 3}</div>}
              </div>
            );
          })}
        </div>
      </Card>

      <NewMeetingDialog open={openNew} onOpenChange={setOpenNew} onCreated={() => qc.invalidateQueries({ queryKey: ["calendar-events"] })} />
    </div>
  );
}

function NewMeetingDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const { current } = useWorkspace();
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [withMeet, setWithMeet] = useState(true);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!current?.id || !title || !start) return toast.error("Preencha título e horário");
    setLoading(true);
    try {
      const { error } = await supabase.from("calendar_events").insert({
        workspace_id: current.id,
        title,
        starts_at: new Date(start).toISOString(),
        ends_at: end ? new Date(end).toISOString() : null,
        conference_url: withMeet ? `https://meet.google.com/new-${Date.now()}` : null,
      });
      if (error) throw error;
      toast.success("Reunião criada");
      onCreated();
      onOpenChange(false);
      setTitle(""); setStart(""); setEnd("");
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova reunião</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Título</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Início</Label><Input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} /></div>
            <div><Label>Fim</Label><Input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} /></div>
          </div>
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2"><Video className="h-4 w-4" /> Adicionar Google Meet</Label>
            <Switch checked={withMeet} onCheckedChange={setWithMeet} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>{loading ? "Criando…" : "Criar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { Badge };
