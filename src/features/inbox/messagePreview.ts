export type MessageDirection = "in" | "out";

const TYPE_FALLBACK: Record<string, string> = {
  image: "📷 Foto",
  video: "🎥 Vídeo",
  audio: "🎤 Áudio",
  ptt: "🎤 Mensagem de voz",
  document: "📄 Documento",
  sticker: "Figurinha",
  location: "📍 Localização",
  contact: "👤 Contato",
  vcard: "👤 Contato",
  call: "📞 Chamada",
  reaction: "Reagiu a uma mensagem",
};

export function previewBodyFromPayload(
  type: string,
  payload: Record<string, unknown> | null | undefined,
): string {
  const p = (payload ?? {}) as Record<string, unknown>;
  const body = typeof p.body === "string" ? p.body : "";
  if (body) return body;
  const caption = typeof p.caption === "string" ? p.caption : "";
  if (caption) return caption;
  return TYPE_FALLBACK[type] ?? "";
}

export function formatLastMessagePreview(
  direction: MessageDirection | undefined,
  type: string,
  payload: Record<string, unknown> | null | undefined,
): string {
  const body = previewBodyFromPayload(type, payload);
  if (!body) return "";
  return `${direction === "out" ? "Você: " : ""}${body}`;
}
