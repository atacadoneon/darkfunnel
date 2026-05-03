// Public webhook to capture leads. No JWT required.
// URL: POST /functions/v1/capture-lead?token=XXXX
//   or header: x-webhook-token: XXXX
// Body: arbitrary JSON; field_mapping on the webhook maps incoming keys -> {name,email,phone,message,notes}
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function pickMapped(payload: Record<string, any>, mapping: Record<string, string>, key: string): string | null {
  // mapping is { incomingField: standardField }, e.g. { "full_name": "name" }
  const found = Object.entries(mapping ?? {}).find(([, v]) => v === key);
  if (found) {
    const v = payload[found[0]];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  // fallback to direct key
  const direct = payload[key];
  if (direct != null && String(direct).trim()) return String(direct).trim();
  return null;
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw;
  return digits.startsWith("+") ? digits : `+${digits}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const url = new URL(req.url);
    // Token can come from: ?token=, header x-webhook-token, or last path segment
    const pathToken = url.pathname.split("/").filter(Boolean).pop();
    const queryToken = url.searchParams.get("token");
    const headerToken = req.headers.get("x-webhook-token");
    const token = queryToken
      ?? headerToken
      ?? (pathToken && pathToken !== "capture-lead" ? pathToken : null);
    if (!token) return json({ error: "missing token" }, 401);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: webhook, error: whErr } = await sb
      .from("lead_capture_webhooks")
      .select("*")
      .eq("token", token)
      .eq("active", true)
      .maybeSingle();
    if (whErr) throw whErr;
    if (!webhook) return json({ error: "invalid token" }, 401);

    const payload = (await req.json().catch(() => ({}))) as Record<string, any>;
    const mapping = (webhook.field_mapping ?? {}) as Record<string, string>;

    const name = pickMapped(payload, mapping, "name") ?? "Lead sem nome";
    const emailRaw = pickMapped(payload, mapping, "email");
    const phoneRaw = pickMapped(payload, mapping, "phone");
    const message = pickMapped(payload, mapping, "message");
    const notes = pickMapped(payload, mapping, "notes");

    const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
    const email = emailRaw?.toLowerCase() ?? null;

    const wsId = webhook.workspace_id as string;

    // 1) Find existing contact by phone or email identity
    let contactId: string | null = null;
    if (phone) {
      const { data: c } = await sb.from("contacts")
        .select("id").eq("workspace_id", wsId).eq("phone_e164", phone).maybeSingle();
      if (c) contactId = c.id;
    }
    if (!contactId && email) {
      const { data: ident } = await sb.from("contact_identities")
        .select("contact_id").eq("workspace_id", wsId).eq("kind", "email").eq("value", email).maybeSingle();
      if (ident) contactId = ident.contact_id;
    }

    // 2) Create contact if not found
    if (!contactId) {
      const { data: newC, error: cErr } = await sb.from("contacts").insert({
        workspace_id: wsId,
        display_name: name,
        phone_e164: phone,
        internal_notes: notes,
      }).select("id").single();
      if (cErr) throw cErr;
      contactId = newC.id;

      // identities
      const idents: any[] = [];
      if (phone) idents.push({ workspace_id: wsId, contact_id: contactId, kind: "whatsapp", value: phone, is_primary: true });
      if (email) idents.push({ workspace_id: wsId, contact_id: contactId, kind: "email", value: email, is_primary: !phone });
      if (idents.length) await sb.from("contact_identities").insert(idents);
    }

    // 3) Auto tags
    if (Array.isArray(webhook.auto_tags) && webhook.auto_tags.length) {
      const rows = webhook.auto_tags.map((tag_id: string) => ({
        workspace_id: wsId, contact_id: contactId!, tag_id,
      }));
      await sb.from("contact_tags").upsert(rows, { onConflict: "contact_id,tag_id", ignoreDuplicates: true });
    }

    // 4) Resolve stage (use webhook.stage_id, else first stage of pipeline, else first stage in ws)
    let stageId: string | null = webhook.stage_id;
    if (!stageId) {
      let q = sb.from("pipeline_stages").select("id").eq("workspace_id", wsId)
        .order("position", { ascending: true }).limit(1);
      if (webhook.pipeline_id) q = q.eq("pipeline_id", webhook.pipeline_id);
      const { data: s } = await q.maybeSingle();
      stageId = s?.id ?? null;
    }

    // 5) Create deal
    let dealId: string | null = null;
    if (stageId) {
      const { data: deal, error: dErr } = await sb.from("deals").insert({
        workspace_id: wsId,
        stage_id: stageId,
        contact_id: contactId,
        title: name,
        value_cents: 0,
        currency: "BRL",
        position: 0,
        assigned_to: webhook.default_assignee,
        origin_id: webhook.origin_id,
        notes: message ?? notes ?? null,
        last_interaction_at: new Date().toISOString(),
      }).select("id").single();
      if (dErr) throw dErr;
      dealId = deal.id;
    }

    // 6) Create conversation + initial message (try to pick a channel; prefer one matching origin)
    let conversationId: string | null = null;
    const { data: channel } = await sb.from("channels")
      .select("id,kind").eq("workspace_id", wsId).is("archived_at", null)
      .order("created_at", { ascending: true }).limit(1).maybeSingle();

    if (channel) {
      const { data: conv, error: convErr } = await sb.from("conversations").insert({
        workspace_id: wsId,
        contact_id: contactId,
        channel_id: channel.id,
        status: "open",
        unread_count: message ? 1 : 0,
        last_message_at: new Date().toISOString(),
        assigned_user_id: webhook.default_assignee,
      }).select("id").single();
      if (convErr) throw convErr;
      conversationId = conv.id;

      if (message) {
        await sb.from("messages").insert({
          workspace_id: wsId,
          conversation_id: conversationId,
          contact_id: contactId,
          channel_id: channel.id,
          direction: "in",
          type: "text",
          payload: { body: message },
          status: "received",
          sent_at: new Date().toISOString(),
        });
      }
    }

    // 7) Update webhook stats
    await sb.from("lead_capture_webhooks").update({
      leads_count: (webhook.leads_count ?? 0) + 1,
      last_lead_at: new Date().toISOString(),
    }).eq("id", webhook.id);

    return json({ ok: true, contact_id: contactId, deal_id: dealId, conversation_id: conversationId });
  } catch (e) {
    console.error("capture-lead error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
