import type { ConversationRow, MessageRow } from "@/features/inbox/hooks";

/**
 * Conversa enriquecida com contact, channel e a última mensagem da thread.
 * Usada pela inbox/lista quando precisamos do preview da última mensagem em formato completo
 * (e não apenas a string `last_message_preview`).
 */
export type ConversationWithLastMsg = ConversationRow & {
  last_message: MessageRow[];
};

/**
 * Origem de atribuição da conversa/lead. Indica de onde o contato chegou.
 * - meta_ctwa: Click-to-WhatsApp do Meta Ads
 * - meta_link: link direto vindo de campanha Meta
 * - google_ads: Google Ads
 * - darkfunnel_ref: indicação interna via DarkFunnel
 */
export type AttributionSource =
  | "meta_ctwa"
  | "meta_link"
  | "google_ads"
  | "darkfunnel_ref"
  | null;

export type { ConversationRow, MessageRow };

