import { useState } from "react";
import { Calendar as CalIcon, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useScheduledMessages, useScheduleMessage, useCancelScheduled } from "./inboxFeatureHooks";
import type { ConversationRow } from "./hooks";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversation: ConversationRow;
  initialBody?: string;
};

function pad(n: number) { return n.toString().padStart(2, "0"); }
function defaultLocal(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ScheduleMessageDialog({ open, onOpenChange, conversation, initialBody }: Props) {
  const [body, setBody] = useState(initialBody ?? "");
  const [when, setWhen] = useState(defaultLocal());
  const schedule = useScheduleMessage();
  const cancel = useCancelScheduled();
  const { data: pendings = [] } = useScheduledMessages(conversation.id);

  const submit = async () => {
    if (!body.trim()) return;
    await schedule.mutateAsync({
      conversation_id: conversation.id,
      contact_id: conversation.contact_id,
      channel_id: conversation.channel_id,
      body: body.trim(),
      scheduled_for: new Date(when).toISOString(),
    });
    setBody("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CalIcon className="h-4 w-4" /> Agendar mensagem</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Mensagem</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Digite a mensagem..." />
          </div>
          <div>
            <Label className="text-xs">Enviar em</Label>
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>

          {pendings.length > 0 && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Agendamentos pendentes ({pendings.length})
              </div>
              <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                {pendings.map((p) => (
                  <li key={p.id} className="flex items-start gap-2 text-xs">
                    <span className="tabular-nums text-muted-foreground shrink-0">
                      {new Date(p.scheduled_for).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                    <span className="flex-1 line-clamp-2">{p.payload?.body}</span>
                    <button onClick={() => cancel.mutate(p.id)} className="text-muted-foreground hover:text-destructive shrink-0" title="Cancelar">
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!body.trim() || schedule.isPending}>Agendar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
