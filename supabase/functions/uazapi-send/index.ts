// Envia mensagem de texto via uazapi. Cria registro em messages.
// redeploy: 2026-05-04T03:00Z
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "missing auth" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("DARKFUNNEL_SUPABASE_SERVICE_ROLE_KEY") || "";
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const admin = createClient(url, service, { auth: { persistSession: false } });

  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return json({ error: "unauthorized" }, 401);

  const body = await req.json().catch(() => null) as { conversation_id: string; text: string } | null;
  if (!body?.conversation_id || !body?.text?.trim()) return json({ error: "missing fields" }, 400);

  const { data: conv } = await admin
    .from("conversations")
    .select("id, workspace_id, channel_id, contact_id, contacts(phone_e164)")
    .eq("id", body.conversation_id).maybeSingle();
  if (!conv) return json({ error: "conversation not found" }, 404);

  const { data: member } = await admin.from("workspace_members").select("user_id").eq("workspace_id", conv.workspace_id).eq("user_id", u.user.id).maybeSingle();
  if (!member) return json({ error: "forbidden" }, 403);

  const { data: creds } = await admin.from("channel_credentials").select("*").eq("channel_id", conv.channel_id).maybeSingle();
  if (!creds?.instance_token) return json({ error: "canal sem credenciais uazapi" }, 400);

  const phone = (conv as any).contacts?.phone_e164;
  if (!phone) return json({ error: "contato sem telefone" }, 400);
  const number = phone.replace(/\D/g, "");

  const r = await fetch(`${creds.host.replace(/\/$/, "")}/send/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json", token: creds.instance_token },
    body: JSON.stringify({ number, text: body.text }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return json({ error: "uazapi send failed", detail: data }, 502);

  const externalId = (data?.id ?? data?.messageId ?? data?.key?.id ?? null) as string | null;
  const nowIso = new Date().toISOString();
  await admin.from("messages").insert({
    workspace_id: conv.workspace_id,
    conversation_id: conv.id,
    direction: "out",
    type: "text",
    payload: { body: body.text, external_id: externalId, raw: data },
    status: "sent",
    sent_at: nowIso,
  });
  await admin.from("conversations").update({ last_message_at: nowIso }).eq("id", conv.id);

  return json({ ok: true, external_id: externalId });
});
