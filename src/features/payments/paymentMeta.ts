import type { LucideIcon } from "lucide-react";
import { Zap, Barcode, CreditCard, Banknote, ArrowLeftRight, HelpCircle } from "lucide-react";

export const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "border-amber-500/30 text-amber-600 bg-amber-500/10" },
  processing: { label: "Processando", cls: "border-blue-500/30 text-blue-600 bg-blue-500/10" },
  paid: { label: "Pago", cls: "border-emerald-500/30 text-emerald-600 bg-emerald-500/10" },
  partially_paid: { label: "Parcial", cls: "border-emerald-500/30 text-emerald-600 bg-emerald-500/10" },
  refunded: { label: "Estornado", cls: "border-violet-500/30 text-violet-600 bg-violet-500/10" },
  partially_refunded: { label: "Estorno parcial", cls: "border-violet-500/30 text-violet-600 bg-violet-500/10" },
  failed: { label: "Falha", cls: "border-destructive/30 text-destructive bg-destructive/10" },
  expired: { label: "Vencida", cls: "border-destructive/30 text-destructive bg-destructive/10" },
  cancelled: { label: "Cancelada", cls: "border-muted text-muted-foreground" },
  chargeback: { label: "Chargeback", cls: "border-destructive/30 text-destructive bg-destructive/10" },
  in_dispute: { label: "Em disputa", cls: "border-amber-500/30 text-amber-600 bg-amber-500/10" },
};

export const METHOD_META: Record<string, { label: string; icon: LucideIcon }> = {
  pix: { label: "PIX", icon: Zap },
  boleto: { label: "Boleto", icon: Barcode },
  credit_card: { label: "Crédito", icon: CreditCard },
  debit_card: { label: "Débito", icon: CreditCard },
  wire_transfer: { label: "Transferência", icon: ArrowLeftRight },
  cash: { label: "Dinheiro", icon: Banknote },
  other: { label: "Outros", icon: HelpCircle },
};

export const GATEWAYS = ["pagarme", "appmax", "mercadopago", "cielo", "stripe", "manual", "asaas"];
export const METHODS = Object.keys(METHOD_META);

export const STATUS_TABS: { key: string; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "pending", label: "Pendentes" },
  { key: "paid", label: "Pagas" },
  { key: "expired", label: "Vencidas" },
  { key: "failed", label: "Falhas" },
  { key: "refunded", label: "Estornadas" },
  { key: "cancelled", label: "Canceladas" },
  { key: "in_dispute", label: "Em disputa" },
];
