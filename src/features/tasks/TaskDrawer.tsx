import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TASK_STATUSES, TASK_PRIORITIES, type Task, type TaskInput, type TaskStatus, type TaskPriority } from "@/types/task";
import { useTaskMutations } from "@/hooks/useTasks";
import { useWorkspaceMembers } from "@/features/workspace/permissions";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  task: Task | null;
  defaultStatus?: TaskStatus;
};

export function TaskDrawer({ open, onOpenChange, task, defaultStatus = "open" }: Props) {
  const { create, update } = useTaskMutations();
  const { data: members = [] } = useWorkspaceMembers();
  const [form, setForm] = useState<TaskInput>({});

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        assigned_to: task.assigned_to,
        due_date: task.due_date,
        tags: task.tags ?? [],
      });
    } else {
      setForm({ title: "", status: defaultStatus, priority: "medium", tags: [] });
    }
  }, [task, defaultStatus, open]);

  const save = async () => {
    if (!form.title?.trim()) {
      toast.error("Título é obrigatório");
      return;
    }
    try {
      if (task) await update.mutateAsync({ id: task.id, patch: form });
      else await create.mutateAsync(form);
      toast.success(task ? "Tarefa atualizada" : "Tarefa criada");
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{task ? "Editar tarefa" : "Nova tarefa"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-6">
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input
              value={form.title ?? ""}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="O que precisa ser feito?"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea
              value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={4}
              placeholder="Detalhes opcionais..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as TaskStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as TaskPriority })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Responsável</Label>
            <Select
              value={form.assigned_to ?? "none"}
              onValueChange={(v) => setForm({ ...form, assigned_to: v === "none" ? null : v })}
            >
              <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem responsável</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.display_name ?? m.email ?? m.user_id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Vencimento</Label>
            <Input
              type="datetime-local"
              value={form.due_date ? format(new Date(form.due_date), "yyyy-MM-dd'T'HH:mm") : ""}
              onChange={(e) =>
                setForm({ ...form, due_date: e.target.value ? new Date(e.target.value).toISOString() : null })
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tags (separadas por vírgula)</Label>
            <Input
              value={(form.tags ?? []).join(", ")}
              onChange={(e) =>
                setForm({
                  ...form,
                  tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                })
              }
              placeholder="ex: urgente, cliente-vip"
            />
          </div>
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={create.isPending || update.isPending}>
            {task ? "Salvar" : "Criar"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
