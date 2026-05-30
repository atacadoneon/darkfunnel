import { useMemo, useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor, closestCorners, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { Plus, Search, LayoutGrid, List as ListIcon, Calendar as CalendarIcon, ListChecks } from "lucide-react";
import { format, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { useTasks, useTaskMutations } from "@/hooks/useTasks";
import { TASK_STATUSES, TASK_PRIORITIES, type Task, type TaskStatus } from "@/types/task";
import { TaskColumn } from "@/features/tasks/TaskColumn";
import { TaskCard } from "@/features/tasks/TaskCard";
import { TaskDrawer } from "@/features/tasks/TaskDrawer";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";

type View = "kanban" | "list" | "calendar";

export default function Tasks() {
  const { data: tasks = [], isLoading } = useTasks();
  const { move } = useTaskMutations();

  const [view, setView] = useState<View>("kanban");
  const [search, setSearch] = useState("");
  const [filterPrio, setFilterPrio] = useState<string>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>("open");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [calDate, setCalDate] = useState<Date>(new Date());

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (filterPrio !== "all" && t.priority !== filterPrio) return false;
      if (q && !t.title.toLowerCase().includes(q) && !(t.description ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks, search, filterPrio]);

  const grouped = useMemo(() => {
    const m: Record<TaskStatus, Task[]> = { open: [], in_progress: [], blocked: [], completed: [] };
    for (const t of filtered) m[t.status]?.push(t);
    return m;
  }, [filtered]);

  const handleNew = (status: TaskStatus = "open") => {
    setEditing(null);
    setDefaultStatus(status);
    setDrawerOpen(true);
  };

  const handleOpen = (t: Task) => {
    setEditing(t);
    setDrawerOpen(true);
  };

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const task = tasks.find((t) => t.id === active.id);
    if (!task) return;
    const overData = over.data.current as { type?: string; status?: TaskStatus; task?: Task } | undefined;
    const overTask = tasks.find((t) => t.id === over.id);
    const targetStatus: TaskStatus | undefined = overData?.status ?? overTask?.status;
    if (!targetStatus) return;
    if (task.status === targetStatus && task.id === over.id) return;
    const columnTasks = grouped[targetStatus];
    const newPos = columnTasks.length;
    move.mutate({ id: task.id, status: targetStatus, position: newPos });
  };

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) ?? null : null;

  const dayTasks = useMemo(
    () => filtered.filter((t) => t.due_date && format(new Date(t.due_date), "yyyy-MM-dd") === format(calDate, "yyyy-MM-dd")),
    [filtered, calDate]
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="border-b px-3 h-10 flex items-center gap-2">
        <ListChecks className="h-3.5 w-3.5 text-primary" />
        <h1 className="text-sm font-medium">Tarefas</h1>
        <span className="text-[11px] text-muted-foreground">· {tasks.length}</span>
        <div className="flex-1" />
        <Button size="sm" className="h-7 text-xs" onClick={() => handleNew("open")}>
          <Plus className="h-3 w-3 mr-1" /> Nova
        </Button>
      </div>

      <div className="border-b px-4 md:px-6 py-2 flex items-center gap-2 flex-wrap">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar tarefas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8"
          />
        </div>
        <select
          value={filterPrio}
          onChange={(e) => setFilterPrio(e.target.value)}
          className="h-8 rounded-md border bg-background px-2 text-xs"
        >
          <option value="all">Todas prioridades</option>
          {TASK_PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <div className="flex-1" />
        <div className="inline-flex rounded-md border bg-muted/40 p-0.5">
          {[
            { id: "kanban" as const, icon: LayoutGrid, label: "Kanban" },
            { id: "list" as const, icon: ListIcon, label: "Lista" },
            { id: "calendar" as const, icon: CalendarIcon, label: "Calendário" },
          ].map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded inline-flex items-center gap-1.5 transition-colors",
                view === v.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <v.icon className="h-3.5 w-3.5" /> {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {isLoading ? (
          <div className="h-full overflow-x-auto overflow-y-hidden p-4 md:p-6">
            <div className="flex gap-4 h-full">
              {TASK_STATUSES.map((s) => (
                <div key={s.value} className="w-72 shrink-0 space-y-2">
                  <Skeleton className="h-6 w-32" />
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
              ))}
            </div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <EmptyState
              icon={ListChecks}
              title="Nenhuma tarefa ainda"
              description="Crie sua primeira tarefa para começar a organizar o trabalho do time."
              action={<Button onClick={() => handleNew("open")}><Plus className="h-4 w-4 mr-1.5" /> Nova tarefa</Button>}
            />
          </div>
        ) : view === "kanban" ? (
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
            <div className="h-full overflow-x-auto overflow-y-hidden p-4 md:p-6">
              <div className="flex gap-4 h-full">
                {TASK_STATUSES.map((s) => (
                  <TaskColumn
                    key={s.value}
                    status={s.value}
                    label={s.label}
                    dotClass={s.dot}
                    tasks={grouped[s.value]}
                    onOpenTask={handleOpen}
                  />
                ))}
              </div>
            </div>
            <DragOverlay>{activeTask && <TaskCard task={activeTask} />}</DragOverlay>
          </DndContext>
        ) : view === "list" ? (
          <div className="h-full overflow-y-auto p-4 md:p-6 space-y-2">
            {filtered.map((t) => {
              const prio = TASK_PRIORITIES.find((p) => p.value === t.priority)!;
              const status = TASK_STATUSES.find((s) => s.value === t.status)!;
              const due = t.due_date ? new Date(t.due_date) : null;
              const overdue = due && t.status !== "completed" && isPast(due);
              return (
                <Card
                  key={t.id}
                  onClick={() => handleOpen(t)}
                  className="p-3 flex items-center gap-3 cursor-pointer hover:border-primary/40 transition-colors"
                >
                  <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", status.dot)} />
                  <div className="flex-1 min-w-0">
                    <div className={cn("text-sm font-medium truncate", t.status === "completed" && "line-through opacity-60")}>
                      {t.title}
                    </div>
                    {t.description && (
                      <div className="text-xs text-muted-foreground truncate">{t.description}</div>
                    )}
                  </div>
                  <Badge variant="outline" className={cn("text-[10px]", prio.className)}>{prio.label}</Badge>
                  {due && (
                    <span className={cn("text-xs text-muted-foreground tabular-nums", overdue && "text-destructive font-medium")}>
                      {format(due, "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                  )}
                </Card>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-12">Nenhuma tarefa encontrada.</div>
            )}
          </div>
        ) : (
          <div className="h-full overflow-y-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6 items-start">
            <Card className="p-2">
              <Calendar
                mode="single"
                selected={calDate}
                onSelect={(d) => d && setCalDate(d)}
                locale={ptBR}
                className={cn("p-3 pointer-events-auto")}
                modifiers={{
                  hasTask: filtered.filter((t) => t.due_date).map((t) => new Date(t.due_date!)),
                }}
                modifiersClassNames={{ hasTask: "bg-primary/20 font-bold" }}
              />
            </Card>
            <div className="space-y-2">
              <div className="text-sm font-semibold">
                {format(calDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </div>
              {dayTasks.length === 0 ? (
                <Card className="p-6 text-center text-sm text-muted-foreground border-dashed">
                  Sem tarefas neste dia
                </Card>
              ) : (
                dayTasks.map((t) => {
                  const prio = TASK_PRIORITIES.find((p) => p.value === t.priority)!;
                  return (
                    <Card key={t.id} onClick={() => handleOpen(t)} className="p-3 cursor-pointer hover:border-primary/40">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 text-sm font-medium">{t.title}</div>
                        <Badge variant="outline" className={cn("text-[10px]", prio.className)}>{prio.label}</Badge>
                      </div>
                      {t.due_date && (
                        <div className="text-xs text-muted-foreground mt-1">{format(new Date(t.due_date), "HH:mm")}</div>
                      )}
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        )}

        <Button
          size="lg"
          className="absolute bottom-6 right-6 rounded-full h-14 w-14 shadow-lg p-0"
          onClick={() => handleNew("open")}
          aria-label="Nova tarefa"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      <TaskDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        task={editing}
        defaultStatus={defaultStatus}
      />
    </div>
  );
}
