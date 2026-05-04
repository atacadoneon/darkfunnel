// Webhook público que a uazapi chama com eventos.
// URL: /functions/v1/uazapi-webhook?secret=XXX&channel=YYY
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function inferType(msg: any): string {
  const t = msg?.messageType ?? msg?.type;
  if (t) return String(t).toLowerCase();
  if (msg?.imageMessage) return "image";
  if (msg?.audioMessage) return "audio";
  if (msg?.videoMessage) return "video";
  if (msg?.documentMessage) return "document";
  if (msg?.stickerMessage) return "sticker";
  return "text";
}
function extractText(msg: any): string {
  return (
    msg?.text ?? msg?.body ?? msg?.message?.conversation ??
    msg?.message?.extendedTextMessage?.text ??
    msg?.imageMessage?.caption ?? msg?.videoMessage?.caption ?? ""
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  const channelId = url.searchParams.get("channel");
  if (!secret || !channelId) return json({ error: "missing params" }, 400);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  const { data: creds } = await sb.from("channel_credentials").select("channel_id,webhook_secret").eq("channel_id", channelId).maybeSingle();
  if (!creds || creds.webhook_secret !== secret) return json({ error: "invalid secret" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }

  try {
    const eventType = body?.event ?? body?.EventType ?? body?.type ?? "";
    // Conexão
    if (/connection|status/i.test(eventType) || body?.connection) {
      const status = String(body?.status ?? body?.connection ?? body?.instance?.status ?? "").toLowerCase();
      const map: Record<string, string> = { connected: "connected", open: "connected", connecting: "qr_pending", disconnected: "disconnected", close: "disconnected" };
      const s = map[status];
      if (s) await sb.from("channels").update({ status: s }).eq("id", channelId);
      return json({ ok: true });
    }

    // Mensagens (uma ou várias)
    const msgs: any[] = Array.isArray(body?.messages) ? body.messages
      : Array.isArray(body?.data) ? body.data
      : body?.message ? [body.message]
      : body?.messageType || body?.key ? [body]
      : [];

    for (const m of msgs) {
      const fromMe = !!(m.fromMe ?? m.key?.fromMe);
      const remote = m.chatid ?? m.key?.remoteJid ?? m.from ?? m.sender ?? "";
      const phone = String(remote).split("@")[0];
      const myNumber = m.owner ?? m.toNumber ?? null;
      const ts = m.messageTimestamp ?? m.timestamp ?? Math.floor(Date.now() / 1000);
      const tsIso = new Date((typeof ts === "number" && ts < 2e10 ? ts * 1000 : ts)).toISOString();

      await sb.rpc("uazapi_ingest_message", {
        p_channel: channelId,
        p_external_id: m.id ?? m.key?.id ?? null,
        p_from_phone: fromMe ? (myNumber ?? null) : phone,
        p_to_phone: fromMe ? phone : (myNumber ?? null),
        p_direction: fromMe ? "out" : "in",
        p_type: inferType(m),
        p_payload: { body: extractText(m), raw: m },
        p_timestamp: tsIso,
        p_from_me: fromMe,
        p_push_name: m.pushName ?? m.notify ?? null,
        p_profile_pic: m.profilePic ?? null,
      });
    }
    return json({ ok: true, processed: msgs.length });
  } catch (e) {
    console.error("uazapi-webhook error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
