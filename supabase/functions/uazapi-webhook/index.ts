// Webhook público que a uazapi chama com eventos.
// redeploy: 2026-05-04T17:25Z (force publish)
// URL: /functions/v1/uazapi-webhook?secret=XXX&channel=YYY
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-region, x-retry-count, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function inferType(msg: any): string {
  const content = msg?.message ?? msg;
  const t = msg?.messageType ?? msg?.type ?? content?.messageType ?? content?.type;
  if (t) return String(t).toLowerCase();
  if (content?.imageMessage) return "image";
  if (content?.audioMessage) return "audio";
  if (content?.videoMessage) return "video";
  if (content?.documentMessage) return "document";
  if (content?.stickerMessage) return "sticker";
  return "text";
}
function extractText(msg: any): string {
  const content = msg?.message ?? msg;
  return (
    msg?.text ?? msg?.body ?? content?.conversation ??
    content?.extendedTextMessage?.text ??
    content?.imageMessage?.caption ?? content?.videoMessage?.caption ?? ""
  );
}

function normalizePhone(value: unknown): string | null {
  const digits = String(value ?? "").split("@")[0].replace(/\D/g, "");
  return digits.length >= 8 ? `+${digits}` : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  const channelId = url.searchParams.get("channel");
  if (!secret || !channelId) return json({ error: "missing params" }, 400);

  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("DARKFUNNEL_SUPABASE_SERVICE_ROLE_KEY") || "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, service, { auth: { persistSession: false } });

  const { data: creds } = await sb.from("channel_credentials").select("channel_id,webhook_secret,n8n_enabled,n8n_webhook_url,n8n_webhook_secret").eq("channel_id", channelId).maybeSingle();
  if (!creds || creds.webhook_secret !== secret) return json({ error: "invalid secret" }, 401);

  const { data: channel } = await sb.from("channels").select("id,workspace_id").eq("id", channelId).maybeSingle();
  if (!channel) return json({ error: "channel not found" }, 404);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }

  // Forward para n8n se habilitado (best-effort)
  if (creds.n8n_enabled && creds.n8n_webhook_url) {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (creds.n8n_webhook_secret) headers["x-webhook-secret"] = creds.n8n_webhook_secret as string;
      fetch(creds.n8n_webhook_url as string, { method: "POST", headers, body: JSON.stringify({ channel_id: channelId, event: body }) })
        .catch((e) => console.error("n8n forward error", e));
    } catch (e) { console.error("n8n forward setup error", e); }
  }

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
      : Array.isArray(body?.data?.messages) ? body.data.messages
      : Array.isArray(body?.data) ? body.data
      : body?.message && (body?.key || body?.from || body?.sender || body?.chatid || body?.messageType) ? [body]
      : body?.message ? [body.message]
      : body?.messageType || body?.key ? [body]
      : [];

    for (const m of msgs) {
      const fromMe = !!(m.fromMe ?? m.key?.fromMe);
      const remote = m.chatid ?? m.key?.remoteJid ?? m.from ?? m.sender ?? "";
      const isGroup = String(remote).includes("@g.us") || !!m.isGroup;
      const participant = m.participant ?? m.key?.participant ?? m.sender ?? null;
      const phone = normalizePhone(remote);
      const myNumber = m.owner ?? m.toNumber ?? null;
      const ts = m.messageTimestamp ?? m.timestamp ?? Math.floor(Date.now() / 1000);
      const tsIso = new Date((typeof ts === "number" && ts < 2e10 ? ts * 1000 : ts)).toISOString();
      const externalId = m.id ?? m.key?.id ?? null;
      const groupName = m.groupName ?? m.chatName ?? m.subject ?? null;
      const pushName = isGroup ? (groupName || m.pushName || m.notify || null) : (m.pushName ?? m.notify ?? null);
      const profilePic = isGroup ? (m.groupPic ?? m.chatPic ?? null) : (m.profilePic ?? null);

      const contactPhone = fromMe && !isGroup ? normalizePhone(phone) : phone;
      if (!contactPhone) continue;

      let { data: contact } = await sb
        .from("contacts")
        .select("id,display_name,profile_pic_url")
        .eq("workspace_id", channel.workspace_id)
        .eq("phone_e164", contactPhone)
        .maybeSingle();
      if (!contact) {
        const { data: identity } = await sb
          .from("contact_identities")
          .select("contact_id")
          .eq("workspace_id", channel.workspace_id)
          .eq("kind", "whatsapp")
          .eq("value", contactPhone)
          .maybeSingle();
        if (identity?.contact_id) {
          const { data: c2 } = await sb
            .from("contacts")
            .select("id,display_name,profile_pic_url")
            .eq("id", identity.contact_id)
            .maybeSingle();
          if (c2) contact = c2;
        }
      }
      if (!contact) {
        const { data: created, error: contactError } = await sb.from("contacts").insert({
          workspace_id: channel.workspace_id,
          display_name: pushName || contactPhone,
          phone_e164: contactPhone,
          profile_pic_url: profilePic,
        }).select("id,display_name,profile_pic_url").single();
        if (contactError) throw contactError;
        contact = created;
        await sb.from("contact_identities").insert({
          workspace_id: channel.workspace_id,
          contact_id: contact.id,
          kind: "whatsapp",
          value: contactPhone,
          is_primary: true,
        });
      } else {
        // Atualiza nome/foto se mudaram ou estavam vazios
        const update: Record<string, unknown> = {};
        if (!fromMe && pushName && pushName !== contact.display_name) {
          // só sobrescreve se o nome atual estava vazio, igual ao telefone, ou diferente do pushName recebido
          if (!contact.display_name || contact.display_name === contactPhone || contact.display_name !== pushName) {
            update.display_name = pushName;
          }
        }
        if (profilePic && profilePic !== contact.profile_pic_url) {
          update.profile_pic_url = profilePic;
        }
        if (Object.keys(update).length > 0) {
          await sb.from("contacts").update(update).eq("id", contact.id);
        }
      }

      let { data: conv } = await sb
        .from("conversations")
        .select("id")
        .eq("workspace_id", channel.workspace_id)
        .eq("contact_id", contact.id)
        .eq("channel_id", channelId)
        .maybeSingle();
      if (!conv) {
        const { data: createdConv, error: convError } = await sb.from("conversations").insert({
          workspace_id: channel.workspace_id,
          contact_id: contact.id,
          channel_id: channelId,
          status: "open",
          unread_count: 0,
          last_message_at: tsIso,
        }).select("id").single();
        if (convError) throw convError;
        conv = createdConv;
      }
      const { data: existing } = externalId
        ? await sb.from("messages").select("id").eq("conversation_id", conv.id).eq("payload->>external_id", externalId).maybeSingle()
        : { data: null };
      if (existing) continue;
      const { error: msgError } = await sb.from("messages").insert({
        workspace_id: channel.workspace_id,
        conversation_id: conv.id,
        direction: fromMe ? "out" : "in",
        type: inferType(m),
        payload: { body: extractText(m), external_id: externalId, from_phone: fromMe ? normalizePhone(myNumber) : phone, to_phone: fromMe ? phone : normalizePhone(myNumber), is_group: isGroup, group_jid: isGroup ? String(remote) : null, participant: isGroup ? participant : null, participant_phone: isGroup ? normalizePhone(participant) : null, raw: m },
        status: fromMe ? "sent" : "received",
        created_at: tsIso,
        sent_at: fromMe ? tsIso : null,
      });
      if (msgError) throw msgError;
      const { data: currentConv } = await sb.from("conversations").select("unread_count").eq("id", conv.id).maybeSingle();
      await sb.from("conversations").update({
        last_message_at: tsIso,
        unread_count: fromMe ? (currentConv?.unread_count ?? 0) : (currentConv?.unread_count ?? 0) + 1,
      }).eq("id", conv.id);
    }
    return json({ ok: true, processed: msgs.length });
  } catch (e) {
    console.error("uazapi-webhook error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
