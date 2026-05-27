export type PaymentProvider = "pagarme" | "appmax" | "mercadopago" | "cielo";

export type PaymentGateway = {
  id: string;
  workspace_id: string;
  provider: PaymentProvider;
  display_name: string;
  credentials_encrypted: Record<string, any> | null;
  status: "configured" | "error" | "disabled";
  is_default: boolean;
  environment?: "sandbox" | "production";
  created_at: string;
  updated_at?: string;
};

export type PaymentLink = {
  id: string;
  workspace_id: string;
  gateway_id: string | null;
  provider: PaymentProvider | null;
  amount_cents: number;
  description: string | null;
  contact_id: string | null;
  deal_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_document: string | null;
  payment_methods: string[] | null;
  max_installments: number | null;
  url: string | null;
  status: "pending" | "paid" | "expired" | "cancelled" | "failed";
  expires_at: string | null;
  paid_at: string | null;
  provider_response: any;
  created_at: string;
};

export type ProviderMeta = {
  provider: PaymentProvider;
  name: string;
  subtitle: string;
  fields: { key: string; label: string; type: "text" | "password"; required?: boolean }[];
  helpUrl?: string;
  brand: string; // hex
};

export const PROVIDERS: ProviderMeta[] = [
  {
    provider: "pagarme",
    name: "Pagar.me",
    subtitle: "Receba via cartão, Pix e boleto",
    brand: "#65A300",
    helpUrl: "https://docs.pagar.me/docs/overview-chaves",
    fields: [
      { key: "api_key", label: "API Key (Secret Key)", type: "password", required: true },
      { key: "public_key", label: "Public Key", type: "text", required: true },
      { key: "recipient_id", label: "Recipient ID (opcional)", type: "text" },
    ],
  },
  {
    provider: "appmax",
    name: "AppMax",
    subtitle: "Especialista em produtos digitais e cursos",
    brand: "#FF7A00",
    helpUrl: "https://appmax.docs.apiary.io/",
    fields: [
      { key: "api_key", label: "API Key", type: "password", required: true },
      { key: "account_hash", label: "Account Hash", type: "text", required: true },
    ],
  },
  {
    provider: "mercadopago",
    name: "Mercado Pago",
    subtitle: "Maior gateway brasileiro",
    brand: "#00B1EA",
    helpUrl: "https://www.mercadopago.com.br/developers/pt/docs",
    fields: [
      { key: "access_token", label: "Access Token", type: "password", required: true },
      { key: "public_key", label: "Public Key", type: "text", required: true },
    ],
  },
  {
    provider: "cielo",
    name: "Cielo",
    subtitle: "Tradicional e seguro",
    brand: "#003DA5",
    helpUrl: "https://developercielo.github.io/",
    fields: [
      { key: "merchant_id", label: "Merchant ID", type: "text", required: true },
      { key: "merchant_key", label: "Merchant Key", type: "password", required: true },
    ],
  },
];
