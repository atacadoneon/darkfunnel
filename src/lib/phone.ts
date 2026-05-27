// Utilitários de telefone E.164.
// Lead = Contato = Conversa: o telefone é obrigatório e deve ser único por workspace.

export const E164_REGEX = /^\+[1-9][0-9]{7,14}$/;

/** Normaliza para E.164: remove tudo que não é dígito e adiciona '+'. */
export function normalizePhoneE164(input: string | null | undefined): string {
  if (!input) return "";
  const digits = String(input).replace(/[^0-9]/g, "");
  return digits ? `+${digits}` : "";
}

export function isValidE164(value: string | null | undefined): boolean {
  if (!value) return false;
  return E164_REGEX.test(value);
}

/** Mensagem de erro padronizada (use em validações de form). */
export const PHONE_INVALID_MSG =
  "Telefone inválido. Use formato internacional, ex.: +55 11 99999-9999";

export const PHONE_REQUIRED_MSG = "Telefone é obrigatório";

/**
 * Formato exigido pela Zenvia: apenas dígitos no formato BR `DDD + Número`
 * (10 ou 11 dígitos). Remove `+`, country code 55 e qualquer não-dígito.
 * Ex.: "+55 48 3283-0151" -> "4832830151"
 */
export function toZenviaBR(input: string | null | undefined): string {
  if (!input) return "";
  let d = String(input).replace(/\D/g, "");
  if (d.startsWith("55") && d.length > 11) d = d.slice(2);
  return d;
}

