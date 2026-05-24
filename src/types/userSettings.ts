export type UserSettings = {
  user_id: string;
  language: string;
  timezone: string;
  theme: "light" | "dark" | "system";
  notif_modal_auto: boolean;
  notif_sound: boolean;
  notif_browser: boolean;
  notif_lead_new: boolean;
  notif_advance_minutes: number;
  updated_at?: string;
};

export const DEFAULT_USER_SETTINGS: Omit<UserSettings, "user_id"> = {
  language: "pt-BR",
  timezone: "America/Sao_Paulo",
  theme: "system",
  notif_modal_auto: true,
  notif_sound: true,
  notif_browser: false,
  notif_lead_new: true,
  notif_advance_minutes: 15,
};

export const ADVANCE_OPTIONS = [5, 10, 15, 30, 60] as const;
export const LANGUAGES = [
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "en-US", label: "English (US)" },
  { value: "es-ES", label: "Español" },
];
export const TIMEZONES = [
  { value: "America/Sao_Paulo", label: "São Paulo (GMT-3)" },
  { value: "America/New_York", label: "New York (GMT-5)" },
  { value: "Europe/Lisbon", label: "Lisboa (GMT+0)" },
  { value: "Europe/London", label: "London (GMT+0)" },
  { value: "America/Los_Angeles", label: "Los Angeles (GMT-8)" },
];
