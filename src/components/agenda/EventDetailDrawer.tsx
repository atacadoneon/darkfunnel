import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ExternalLink, Video, MapPin, User, Briefcase, Calendar as CalIcon, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { KIND_META } from "./CalendarFilters";
import type { UnifiedCalendarItem } from "@/hooks/useUnifiedCalendar";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function EventDetailDrawer({
  item, onOpenChange,
}: {
  item: UnifiedCalendarItem | null;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const open = !!item;
  if (!item) {
    return (
      <Sheet open={false} onOpenChange={onOpenChange}>
        <SheetContent />
      </Sheet>
    );
  }

  const meta = KIND_META[item.kind];

  const markDone = async () => {
    if (item.kind !== "task" || !item.source_id) return;
    const { error } = await supabase.from("tasks").update({ status: "completed" }).eq("id", item.source_id);
    if (error) return toast.error(error.message);
    toast.success("Tarefa concluída");
    qc.invalidateQueries({ queryKey: ["unified-calendar"] });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[440px] sm:max-w-none overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
            <Badge variant="outline" className={`text-[10px] ${meta.color}`}>{meta.label}</Badge>
          </div>
          <SheetTitle className="mt-2">{item.title}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalIcon className="h-4 w-4" />
            {format(new Date(item.starts_at), "PPP 'às' HH:mm", { locale: ptBR })}
            {item.ends_at && <>– {format(new Date(item.ends_at), "HH:mm")}</>}
          </div>

          {item.description && (
            <Card className="p-3 text-sm whitespace-pre-wrap">{item.description}</Card>
          )}

          {item.location && (
            <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{item.location}</div>
          )}

          {item.meeting_url && (
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <a href={item.meeting_url} target="_blank" rel="noreferrer">
                  <Video className="h-3.5 w-3.5 mr-1" />
                  {item.conference_type === "google_meet" ? "Abrir no Google Meet" : "Entrar na reunião"}
                </a>
              </Button>
            </div>
          )}

          {item.contact_id && (
            <Card className="p-3 flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1">Contato vinculado</span>
              <Button size="sm" variant="ghost" onClick={() => navigate(`/funildevendas?tab=banco`)}>
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </Card>
          )}
          {item.deal_id && (
            <Card className="p-3 flex items-center gap-2 text-sm">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1">Negócio vinculado</span>
              <Button size="sm" variant="ghost" onClick={() => navigate(`/funildevendas`)}>
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </Card>
          )}

          {Array.isArray(item.attendees) && item.attendees.length > 0 && (
            <div>
              <h4 className="text-xs uppercase text-muted-foreground mb-1">Participantes</h4>
              <div className="flex flex-wrap gap-1">
                {item.attendees.map((a: any, i: number) => (
                  <Badge key={i} variant="outline" className="text-[10px]">{a.email ?? a.name ?? String(a)}</Badge>
                ))}
              </div>
            </div>
          )}

          {item.kind === "task" && (
            <Button size="sm" variant="outline" onClick={markDone}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Marcar como concluído
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
