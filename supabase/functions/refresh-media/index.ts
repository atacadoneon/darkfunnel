// Recarrega URL de mídia de uma mensagem inbound expirada via uazapi.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

  const body = await req.json().catch(() => null) as { message_id?: string } | null;
  if (!body?.message_id) return json({ error: "missing message_id" }, 400);

  const { data: msg } = await admin
    .from("messages")
    .select("id, conversation_id, workspace_id, type, payload, conversations(channel_id)")
    .eq("id", body.message_id)
    .maybeSingle();
  if (!msg) return json({ error: "message not found" }, 404);

  const { data: member } = await admin
    .from("workspace_members").select("user_id")
    .eq("workspace_id", msg.workspace_id).eq("user_id", u.user.id).maybeSingle();
  if (!member) return json({ error: "forbidden" }, 403);

  const channelId = (msg as any).conversations?.channel_id;
  const { data: creds } = await admin
    .from("channel_credentials").select("*").eq("channel_id", channelId).maybeSingle();
  if (!creds?.instance_token) return json({ error: "canal sem credenciais uazapi" }, 400);

  const payload = (msg.payload ?? {}) as Record<string, unknown>;
  const externalId = payload.external_id as string | undefined;
  if (!externalId) return json({ error: "mensagem sem external_id" }, 400);

  const host = String(creds.host).replace(/\/$/, "");
  const r = await fetch(`${host}/message/download`, {
    method: "POST",
    headers: { "Content-Type": "application/json", token: creds.instance_token },
    body: JSON.stringify({ id: externalId }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return json({ error: "uazapi download failed", detail: data }, 502);

  const newUrl = (data?.fileURL ?? data?.url ?? data?.mediaUrl ?? data?.file_url) as string | undefined;
  if (!newUrl) return json({ error: "sem URL no retorno", detail: data }, 502);

  const nextPayload = { ...payload, media_url: newUrl, refreshed_at: new Date().toISOString() };
  await admin.from("messages").update({ payload: nextPayload }).eq("id", msg.id);

  return json({ ok: true, media_url: newUrl });
});
