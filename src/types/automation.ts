export type AutomationCategory = "distribution" | "pipeline" | "notifications" | "other";

export type AutomationTrigger = {
  event: string;
  config?: Record<string, unknown>;
};

export type AutomationCondition = {
  field: string;
  operator: string;
  value: unknown;
};

export type AutomationAction = {
  type: string;
  config?: Record<string, unknown>;
};

export type Automation = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  active: boolean;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  category: AutomationCategory;
  pipeline_id: string | null;
  channel_id: string | null;
  created_by: string | null;
  run_count: number;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AutomationInput = Partial<Omit<Automation, "id" | "workspace_id" | "created_at" | "updated_at" | "run_count" | "last_run_at">>;

export const CATEGORY_LABEL: Record<AutomationCategory, string> = {
  distribution: "Distribuição",
  pipeline: "Pipeline",
  notifications: "Notificações",
  other: "Outras",
};

export const TRIGGER_EVENTS: { value: string; label: string }[] = [
  { value: "lead_created", label: "Lead criado" },
  { value: "stage_changed", label: "Etapa alterada" },
  { value: "tag_added", label: "Tag adicionada" },
  { value: "message_received", label: "Mensagem recebida" },
  { value: "no_response", label: "Sem resposta" },
  { value: "deal_won", label: "Negócio ganho" },
  { value: "deal_lost", label: "Negócio perdido" },
];

export const ACTION_TYPES: { value: string; label: string }[] = [
  { value: "assign_user", label: "Atribuir usuário" },
  { value: "change_stage", label: "Mudar etapa" },
  { value: "send_message", label: "Enviar mensagem" },
  { value: "send_email", label: "Enviar email" },
  { value: "add_tag", label: "Adicionar tag" },
  { value: "create_task", label: "Criar tarefa" },
  { value: "notify_user", label: "Notificar usuário" },
];
