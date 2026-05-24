export type CadenceTriggerType = "manual" | "lead_created" | "tag_added" | "stage_change" | "no_response";

export type CadenceStepType = "message" | "wait" | "condition";

export type CadenceStep = {
  id: string;
  cadence_id: string;
  order: number;
  type: CadenceStepType;
  content: Record<string, unknown>;
  delay_minutes: number;
  created_at: string;
};

export type Cadence = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  channel_id: string | null;
  trigger_type: CadenceTriggerType;
  enabled: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export const TRIGGER_LABEL: Record<CadenceTriggerType, string> = {
  manual: "Manual",
  lead_created: "Lead criado",
  tag_added: "Tag adicionada",
  stage_change: "Mudança de etapa",
  no_response: "Sem resposta",
};

export const STEP_LABEL: Record<CadenceStepType, string> = {
  message: "Mensagem",
  wait: "Espera",
  condition: "Condição",
};
