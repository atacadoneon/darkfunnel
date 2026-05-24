import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useMeetingMutations } from "@/hooks/useMeetings";
import type { Meeting, MeetingInput } from "@/types/meeting";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  meeting: Meeting | null;
  defaultDate?: Date;
};

function isoLocal(d: Date) {
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

export function MeetingDialog({ open, onOpenChange, meeting, defaultDate }: Props) {
  const { create, update } = useMeetingMutations();
  const [form, setForm] = useState<MeetingInput>({});

  useEffect(() => {
    if (meeting) {
      setForm({
        title: meeting.title,
        description: meeting.description,
        starts_at: meeting.starts_at,
        ends_at: meeting.ends_at,
        location: meeting.location,
        meeting_url: meeting.meeting_url,
      });
    } else {
      const base = defaultDate ? new Date(defaultDate) : new Date();
      base.setHours(9, 0, 0, 0);
      const end = new Date(base);
      end.setHours(end.getHours() + 1);
      setForm({
        title: "",
        starts_at: base.toISOString(),
        ends_at: end.toISOString(),
      });
    }
  }, [meeting, defaultDate, open]);

  const save = async () => {
    if (!form.title?.trim()) return toast.error("Título obrigatório");
    if (!form.starts_at || !form.ends_at) return toast.error("Datas obrigatórias");
    try {
      if (meeting) await update.mutateAsync({ id: meeting.id, patch: form });
      else await create.mutateAsync(form);
      toast.success(meeting ? "Reunião atualizada" : "Reunião criada");
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{meeting ? "Editar evento" : "Novo evento"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-6">
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Início</Label>
              <Input
                type="datetime-local"
                value={form.starts_at ? isoLocal(new Date(form.starts_at)) : ""}
                onChange={(e) => setForm({ ...form, starts_at: new Date(e.target.value).toISOString() })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Fim</Label>
              <Input
                type="datetime-local"
                value={form.ends_at ? isoLocal(new Date(form.ends_at)) : ""}
                onChange={(e) => setForm({ ...form, ends_at: new Date(e.target.value).toISOString() })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Local</Label>
            <Input value={form.location ?? ""} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Sala, endereço..." />
          </div>
          <div className="space-y-1.5">
            <Label>Link da reunião</Label>
            <Input value={form.meeting_url ?? ""} onChange={(e) => setForm({ ...form, meeting_url: e.target.value })} placeholder="https://meet..." />
          </div>
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={create.isPending || update.isPending}>
            {meeting ? "Salvar" : "Criar"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
