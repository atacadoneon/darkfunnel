import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, Tag as TagIcon } from "lucide-react";
import { formatDistanceToNowStrict, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { TASK_PRIORITIES, type Task } from "@/types/task";
import { useWorkspaceMembers } from "@/features/workspace/permissions";

type Props = {
  task: Task;
  onClick?: () => void;
};

export function TaskCard({ task, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", task },
  });
  const { data: members = [] } = useWorkspaceMembers();
  const assignee = members.find((m) => m.user_id === task.assigned_to);
  const prio = TASK_PRIORITIES.find((p) => p.value === task.priority)!;

  const due = task.due_date ? new Date(task.due_date) : null;
  const overdue = due && task.status !== "completed" && isPast(due);

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="group bg-card border rounded-lg p-3 space-y-2 cursor-grab active:cursor-grabbing hover:border-primary/40 hover:shadow-sm transition-all"
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className={cn("font-medium text-sm leading-snug", task.status === "completed" && "line-through opacity-60")}>
            {task.title}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px] font-medium border", prio.className)}>
          {prio.label}
        </Badge>
        {(task.tags ?? []).slice(0, 2).map((t) => (
          <Badge key={t} variant="outline" className="h-5 px-1.5 text-[10px] gap-1 font-normal">
            <TagIcon className="h-2.5 w-2.5" />
            {t}
          </Badge>
        ))}
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          {due && (
            <span className={cn("inline-flex items-center gap-1", overdue && "text-destructive font-medium")}>
              <Calendar className="h-3 w-3" />
              {formatDistanceToNowStrict(due, { locale: ptBR, addSuffix: true })}
            </span>
          )}
        </div>
        {assignee && (
          <Avatar className="h-5 w-5">
            <AvatarFallback className="text-[9px] font-semibold">
              {(assignee.display_name ?? assignee.email ?? "?").trim().charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}
