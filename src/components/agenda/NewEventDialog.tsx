import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function NewEventDialog({
  open, onOpenChange, defaultKind,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultKind: "meeting" | "event";
}) {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [duration, setDuration] = useState("60");
  const [withMeet, setWithMeet] = useState(defaultKind === "meeting");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [attendeesRaw, setAttendeesRaw] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!current?.id || !title || !start) return toast.error("Preencha título e início");
    setLoading(true);
    try {
      const startISO = new Date(start).toISOString();
      const endISO = new Date(new Date(start).getTime() + Number(duration) * 60 * 1000).toISOString();
      const attendees = attendeesRaw
        .split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
        .map((email) => ({ email }));

      if (defaultKind === "meeting" && withMeet) {
        const { error } = await supabase.functions.invoke("meet-create", {
          body: { title, starts_at: startISO, ends_at: endISO, description, attendees },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("calendar_events").insert({
          workspace_id: current.id,
          kind: defaultKind,
          title,
          description: description || null,
          starts_at: startISO,
          ends_at: endISO,
          location: location || null,
          status: "confirmed",
          attendees,
        } as any);
        if (error) throw error;
      }
      toast.success(defaultKind === "meeting" ? "Reunião criada" : "Evento criado");
      qc.invalidateQueries({ queryKey: ["unified-calendar"] });
      onOpenChange(false);
      setTitle(""); setStart(""); setDescription(""); setAttendeesRaw(""); setLocation("");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao criar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{defaultKind === "meeting" ? "Nova reunião" : "Novo evento"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Título</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Início</Label><Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div><Label>Duração (min)</Label><Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} /></div>
          </div>
          {defaultKind === "meeting" ? (
            <div className="flex items-center justify-between">
              <Label>Adicionar Google Meet</Label>
              <Switch checked={withMeet} onCheckedChange={setWithMeet} />
            </div>
          ) : (
            <div><Label>Local</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} /></div>
          )}
          <div><Label>Descrição</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
          <div><Label>Participantes (emails separados por vírgula)</Label><Textarea value={attendeesRaw} onChange={(e) => setAttendeesRaw(e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>{loading ? "Criando…" : "Criar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
