export type TaskStatus = "open" | "in_progress" | "blocked" | "completed";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type Task = {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_to: string | null;
  created_by: string | null;
  due_date: string | null;
  completed_at: string | null;
  tags: string[] | null;
  related_contact_id: string | null;
  related_deal_id: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

export type TaskInput = Partial<Omit<Task, "id" | "workspace_id" | "created_at" | "updated_at">>;

export const TASK_STATUSES: { value: TaskStatus; label: string; color: string; dot: string }[] = [
  { value: "open", label: "Abertas", color: "bg-blue-500/10 text-blue-700 dark:text-blue-300", dot: "bg-blue-500" },
  { value: "in_progress", label: "Em Progresso", color: "bg-amber-500/10 text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  { value: "blocked", label: "Bloqueadas", color: "bg-red-500/10 text-red-700 dark:text-red-300", dot: "bg-red-500" },
  { value: "completed", label: "Concluídas", color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
];

export const TASK_PRIORITIES: { value: TaskPriority; label: string; className: string }[] = [
  { value: "low", label: "Baixa", className: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30" },
  { value: "medium", label: "Média", className: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30" },
  { value: "high", label: "Alta", className: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  { value: "urgent", label: "Urgente", className: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30" },
];
