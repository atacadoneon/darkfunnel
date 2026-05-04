// Gerencia instâncias uazapi: init, connect (QR), status, disconnect
// Requer JWT (usuário logado). Valida que user é membro do workspace do canal.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Body = {
  channel_id: string;
  action: "init" | "connect" | "status" | "disconnect" | "delete";
  host?: string;          // só no init
  admin_token?: string;   // só no init
  phone?: string;         // opcional p/ pairing code
};

async function uaz(host: string, path: string, init: RequestInit & { token?: string; admintoken?: string }) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (init.token) headers["token"] = init.token;
  if (init.admintoken) headers["admintoken"] = init.admintoken;
  const res = await fetch(`${host.replace(/\/$/, "")}${path}`, { ...init, headers });
  const text = await res.text();
  let data: unknown = text;
  try { data = JSON.parse(text); } catch { /* keep text */ }
  return { ok: res.ok, status: res.status, data: data as any };
}

function mapStatus(connStatus: string | undefined): string {
  switch ((connStatus || "").toLowerCase()) {
    case "connected": return "connected";
    case "connecting": return "qr_pending";
    case "disconnected": return "disconnected";
    default: return "pending";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "missing auth" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const admin = createClient(url, service, { auth: { persistSession: false } });

  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return json({ error: "unauthorized" }, 401);

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }
  if (!body.channel_id || !body.action) return json({ error: "missing fields" }, 400);

  // valida acesso ao canal
  const { data: channel, error: chErr } = await admin
    .from("channels").select("*").eq("id", body.channel_id).maybeSingle();
  if (chErr || !channel) return json({ error: "channel not found" }, 404);

  const { data: member } = await admin
    .from("workspace_members").select("user_id").eq("workspace_id", channel.workspace_id).eq("user_id", u.user.id).maybeSingle();
  if (!member) return json({ error: "forbidden" }, 403);

  // load creds (se existirem)
  const { data: creds } = await admin
    .from("channel_credentials").select("*").eq("channel_id", body.channel_id).maybeSingle();

  try {
    if (body.action === "init") {
      const host = (body.host || creds?.host || "").trim();
      const adminToken = (body.admin_token || creds?.admin_token || "").trim();
      if (!host || !adminToken) return json({ error: "host e admin_token são obrigatórios" }, 400);

      // Tenta /instance/init (uazapi V2)
      const r = await uaz(host, "/instance/init", {
        method: "POST",
        admintoken: adminToken,
        body: JSON.stringify({ name: channel.display_name, systemName: channel.display_name }),
      });
      if (!r.ok) return json({ error: "uazapi init failed", detail: r.data }, 502);

      const inst = r.data?.instance ?? r.data;
      const instance_token = inst?.token ?? r.data?.token;
      const instance_id = inst?.id ?? inst?.instanceId ?? r.data?.id ?? null;
      if (!instance_token) return json({ error: "uazapi: token não retornado", detail: r.data }, 502);

      await admin.from("channel_credentials").upsert({
        channel_id: body.channel_id,
        host, admin_token: adminToken, instance_token, instance_id,
        updated_at: new Date().toISOString(),
      });
      await admin.from("channels").update({ status: "pending" }).eq("id", body.channel_id);

      // Configura webhook automaticamente
      const { data: c2 } = await admin.from("channel_credentials").select("webhook_secret").eq("channel_id", body.channel_id).maybeSingle();
      const webhook = `${url}/functions/v1/uazapi-webhook?secret=${c2?.webhook_secret}&channel=${body.channel_id}`;
      await uaz(host, "/webhook", {
        method: "POST",
        token: instance_token,
        body: JSON.stringify({
          url: webhook,
          enabled: true,
          events: { messages: true, messages_update: true, connection: true, contacts: true, presence: false },
        }),
      });

      return json({ ok: true, instance_id });
    }

    if (!creds) return json({ error: "instância não inicializada" }, 400);

    if (body.action === "connect") {
      const r = await uaz(creds.host, "/instance/connect", {
        method: "POST",
        token: creds.instance_token,
        body: JSON.stringify(body.phone ? { phone: body.phone } : {}),
      });
      if (!r.ok) return json({ error: "uazapi connect failed", detail: r.data }, 502);
      const qr = r.data?.instance?.qrcode ?? r.data?.qrcode ?? r.data?.qr ?? null;
      const paircode = r.data?.instance?.paircode ?? r.data?.paircode ?? null;
      const status = mapStatus(r.data?.instance?.status ?? r.data?.status);
      await admin.from("channel_credentials").update({ last_qr: qr, last_qr_at: new Date().toISOString() }).eq("channel_id", body.channel_id);
      await admin.from("channels").update({ status: status === "connected" ? "connected" : "qr_pending" }).eq("id", body.channel_id);
      return json({ ok: true, qr, paircode, status });
    }

    if (body.action === "status") {
      const r = await uaz(creds.host, "/instance/status", { method: "GET", token: creds.instance_token });
      if (!r.ok) return json({ error: "uazapi status failed", detail: r.data }, 502);
      const inst = r.data?.instance ?? r.data;
      const status = mapStatus(inst?.status);
      const phone = inst?.owner ?? inst?.wid ?? null;
      const update: Record<string, unknown> = { status };
      if (phone) update.phone_e164 = phone.replace(/[^\d+]/g, "").replace(/^/, (s: string) => s.startsWith("+") ? s : "+" + s);
      await admin.from("channels").update(update).eq("id", body.channel_id);
      return json({ ok: true, status, raw: inst });
    }

    if (body.action === "disconnect") {
      const r = await uaz(creds.host, "/instance/disconnect", { method: "POST", token: creds.instance_token });
      await admin.from("channels").update({ status: "disconnected" }).eq("id", body.channel_id);
      return json({ ok: r.ok, detail: r.data });
    }

    if (body.action === "delete") {
      await uaz(creds.host, "/instance", { method: "DELETE", admintoken: creds.admin_token ?? "" });
      await admin.from("channel_credentials").delete().eq("channel_id", body.channel_id);
      await admin.from("channels").update({ status: "disconnected" }).eq("id", body.channel_id);
      return json({ ok: true });
    }

    return json({ error: "invalid action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
