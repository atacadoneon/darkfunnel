import type { ConversationRow, MessageRow } from "@/features/inbox/hooks";

/**
 * Conversa enriquecida com contact, channel e a última mensagem da thread.
 * Usada pela inbox/lista quando precisamos do preview da última mensagem em formato completo
 * (e não apenas a string `last_message_preview`).
 */
export type ConversationWithLastMsg = ConversationRow & {
  last_message: MessageRow[];
};

export type { ConversationRow, MessageRow };
