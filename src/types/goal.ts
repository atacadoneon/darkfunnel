export type GoalScope = "workspace" | "sector" | "user";

export type Goal = {
  id: string;
  workspace_id: string;
  scope: GoalScope;
  scope_ref_id: string | null;
  year: number;
  month: number;
  target_amount: number;
  working_days_mask: number; // bitmask 0..6 (Dom..Sáb)
  holidays: string[]; // ISO yyyy-mm-dd
  created_at: string;
  updated_at: string;
};

export type GoalDailyActual = {
  id: string;
  goal_id: string;
  date: string; // yyyy-mm-dd
  amount: number;
  created_at: string;
  updated_at: string;
};

export const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
