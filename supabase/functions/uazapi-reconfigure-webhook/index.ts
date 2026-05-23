import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-region, x-retry-count, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? value as Record<string, unknown> : {};

function normalizeHost(raw: string): string {
  let host = raw.trim().replace(/\/$/, "");
  if (!host) return "";
  if (!/^https?:\/\//i.test(host)) host = `https://${host}`;
  return host;
}

async function uaz(host: string, path: string, token: string, payload: Record<string, unknown>) {
  const base = normalizeHost(host);
  if (!base) throw new Error("UAZAPI_HOST vazio ou inválido");
  const res = await fetch(`${base}${path.startsWith("/") ? path : `/${path}`}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", token },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let data: unknown = text;
  try { data = JSON.parse(text); } catch { /* mantém texto */ }
  return { ok: res.ok, status: res.status, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "missing auth" }, 401);

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("DARKFUNNEL_SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !anon || !service) return json({ error: "Configuração do banco incompleta na função" }, 500);

  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: auth } = await userClient.auth.getUser();
  if (!auth?.user) return json({ error: "unauthorized" }, 401);

  let body: { channel_id?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }
  if (!body.channel_id) return json({ error: "missing channel_id" }, 400);

  const { data: channel, error: chErr } = await admin
    .from("channels")
    .select("id, workspace_id")
    .eq("id", body.channel_id)
    .maybeSingle();
  if (chErr || !channel) return json({ error: "channel not found" }, 404);

  const { data: member } = await admin
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", channel.workspace_id)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!member) return json({ error: "forbidden" }, 403);

  const { data: creds, error: credsErr } = await admin
    .from("channel_credentials")
    .select("host, instance_token, webhook_secret")
    .eq("channel_id", body.channel_id)
    .maybeSingle();
  if (credsErr || !creds?.instance_token) return json({ error: "instância não inicializada" }, 400);
  if (!creds.webhook_secret) return json({ error: "webhook_secret ausente; reconecte o canal" }, 400);

  const webhook = `${url}/functions/v1/uazapi-webhook?secret=${creds.webhook_secret}&channel=${body.channel_id}`;
  const basePayload = {
    url: webhook,
    enabled: true,
    events: ["messages", "messages_update", "connection", "contacts", "groups"],
    excludeMessages: [],
    addUrlEvents: false,
    addUrlTypesMessages: false,
  };

  try {
    const host = String(creds.host || Deno.env.get("UAZAPI_HOST") || "");
    let result = await uaz(host, "/webhook", creds.instance_token, basePayload);
    if (!result.ok) result = await uaz(host, "/instance/webhook", creds.instance_token, basePayload);
    if (!result.ok) {
      const fallbackPayload = { ...basePayload, events: ["messages", "messages_update", "connection", "contacts"] };
      result = await uaz(host, "/webhook", creds.instance_token, fallbackPayload);
      if (!result.ok) result = await uaz(host, "/instance/webhook", creds.instance_token, fallbackPayload);
    }
    if (!result.ok) {
      const detail = typeof result.data === "string" ? result.data : JSON.stringify(asRecord(result.data));
      return json({ error: `uazapi webhook falhou: ${detail.slice(0, 300)}`, detail: result.data }, 502);
    }
    return json({ ok: true, webhook });
  } catch (error) {
    console.error(error);
    return json({ error: (error as Error).message }, 500);
  }
});