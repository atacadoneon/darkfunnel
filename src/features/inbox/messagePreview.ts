export type MessageDirection = "in" | "out";

const TYPE_LABEL: Record<string, string> = {
  image: "📷 Imagem",
  video: "🎬 Vídeo",
  audio: "🎙 Áudio",
  ptt: "🎤 Mensagem de voz",
  document: "📄 Documento",
  sticker: "Figurinha",
  location: "📍 Localização",
  contact: "👤 Contato",
  vcard: "👤 Contato",
  call: "📞 Chamada",
  reaction: "Reagiu a uma mensagem",
};

function pickCaption(p: Record<string, unknown>): string {
  const caption = typeof p.caption === "string" ? p.caption : "";
  if (caption) return caption;
  const body = typeof p.body === "string" ? p.body : "";
  return body;
}

export function previewBodyFromPayload(
  type: string,
  payload: Record<string, unknown> | null | undefined,
): string {
  const p = (payload ?? {}) as Record<string, unknown>;

  if (type === "text") {
    const body = typeof p.body === "string" ? p.body : "";
    return body.slice(0, 60);
  }

  if (type === "document") {
    const filename =
      (typeof p.filename === "string" && p.filename) ||
      (typeof p.file_name === "string" && p.file_name) ||
      (typeof p.name === "string" && p.name) ||
      "Documento";
    return `📎 ${String(filename).slice(0, 60)}`;
  }


  const label = TYPE_LABEL[type];
  if (label) {
    const caption = pickCaption(p).slice(0, 60);
    return caption ? `${label}: ${caption}` : label;
  }

  const fallback = (typeof p.body === "string" ? p.body : "").slice(0, 60);
  return fallback;
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
