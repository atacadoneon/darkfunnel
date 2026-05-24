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
  if (type === "text") return body.slice(0, 60);
  if (body) return body.slice(0, 60);
  const caption = typeof p.caption === "string" ? p.caption : "";
  if (caption) return caption.slice(0, 60);
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
