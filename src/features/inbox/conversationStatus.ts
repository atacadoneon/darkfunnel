export type ConversationStatus = "open" | "in_progress" | "waiting" | "resolved" | "closed";

export const CONVERSATION_STATUS: Record<
  ConversationStatus,
  { label: string; short: string; description: string; badge: string; dot: string }
> = {
  open: {
    label: "Aberto",
    short: "ABERTO",
    description: "Uma nova conversa ou reiniciada.",
    badge: "text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-300 dark:bg-rose-950/40 dark:border-rose-900",
    dot: "bg-rose-500",
  },
  in_progress: {
    label: "Em Atendimento",
    short: "EM ATEND",
    description: "Cliente está sendo atendido.",
    badge: "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-950/40 dark:border-blue-900",
    dot: "bg-blue-500",
  },
  waiting: {
    label: "Aguardando",
    short: "AGUARD",
    description: "Aguardando uma ação sua ou do cliente.",
    badge: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/40 dark:border-amber-900",
    dot: "bg-amber-500",
  },
  resolved: {
    label: "Resolvido",
    short: "RESOLV",
    description: "Cliente foi atendido e foi resolvido.",
    badge:
      "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-900",
    dot: "bg-emerald-500",
  },
  closed: {
    label: "Fechado",
    short: "FECHADO",
    description: "Cliente foi atendido sem conclusão.",
    badge: "text-zinc-700 bg-zinc-100 border-zinc-200 dark:text-zinc-300 dark:bg-zinc-900 dark:border-zinc-800",
    dot: "bg-zinc-500",
  },
};

export function normalizeStatus(s: string | null | undefined): ConversationStatus {
  if (s && s in CONVERSATION_STATUS) return s as ConversationStatus;
  // Legacy mapping
  if (s === "archived") return "closed";
  return "open";
}

export function formatPhone(e164?: string | null): string {
  if (!e164) return "";
  const d = e164.replace(/\D/g, "");
  if (d.length === 13) return `+${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 12) return `+${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 8)}-${d.slice(8)}`;
  if (d.length === 11) return `+55 ${d.slice(0, 2)} ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `+55 ${d.slice(0, 2)} ${d.slice(2, 6)}-${d.slice(6)}`;
  return e164;
}

export function contactLabel(c: {
  display_name?: string | null;
  phone_e164?: string | null;
} | null | undefined): string {
  const name = (c?.display_name || "").trim();
  const phone = c?.phone_e164 || "";
  if (name && name !== phone && !/^\+?\d+$/.test(name)) return name;
  return formatPhone(phone) || "Sem contato";
}
