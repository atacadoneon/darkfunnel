import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { TaskCard } from "./TaskCard";
import type { Task, TaskStatus } from "@/types/task";

type Props = {
  status: TaskStatus;
  label: string;
  dotClass: string;
  tasks: Task[];
  onOpenTask: (task: Task) => void;
};

export function TaskColumn({ status, label, dotClass, tasks, onOpenTask }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { type: "column", status } });

  return (
    <div className="flex flex-col w-80 shrink-0">
      <div className="flex items-center gap-2 px-1 pb-3">
        <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", dotClass)} />
        <div className="font-semibold text-sm flex-1">{label}</div>
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground tabular-nums">
          {tasks.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2 overflow-y-auto min-h-40 transition-colors rounded-lg p-2 bg-muted/20",
          isOver && "bg-primary/5 ring-1 ring-primary/30"
        )}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} onClick={() => onOpenTask(t)} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-8 border border-dashed rounded-lg">
            Sem tarefas
          </div>
        )}
      </div>
    </div>
  );
}
