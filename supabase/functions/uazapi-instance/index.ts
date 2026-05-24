// Gerencia instâncias uazapi: init, connect (QR), status, disconnect
// Requer JWT (usuário logado). Valida que user é membro do workspace do canal.
// redeploy: 2026-05-23T19:25Z v4 — força redeploy para registrar refresh_contact
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-region, x-retry-count, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SUPPORTED_ACTIONS = [
  "init", "attach_instance", "connect", "status", "disconnect", "delete",
  "set_profile_name", "set_profile_picture",
  "get_privacy", "set_privacy",
  "save_n8n", "generate_api_key",
  "sync_history", "refresh_contacts", "refresh_contact",
  "reconfigure_webhook",
] as const;

type Body = {
  channel_id: string;
  action:
    | "init" | "attach_instance" | "connect" | "status" | "disconnect" | "delete"
    | "set_profile_name" | "set_profile_picture"
    | "get_privacy" | "set_privacy"
    | "save_n8n" | "generate_api_key"
    | "sync_history" | "refresh_contacts" | "refresh_contact"
    | "reconfigure_webhook";
  phone?: string;
  force?: boolean;
  contact_id?: string;
  instance_host?: string;
  instance_token?: string;
  instance_id?: string;
  // payloads
  profile_name?: string;
  profile_picture_url?: string;
  privacy?: Record<string, string>;
  n8n?: { enabled: boolean; url?: string | null; secret?: string | null };
  // sync_history
  chat_limit?: number;
  per_chat_limit?: number;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? value as Record<string, unknown> : {};

const instanceFrom = (data: unknown) => {
  const root = asRecord(data);
  return asRecord(root.instance ?? asRecord(root.data).instance ?? root.data ?? data);
};

function normalizeQr(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const qr = value.trim();
  if (!qr) return null;
  if (qr.startsWith("data:") || qr.startsWith("http")) return qr;
  const compact = qr.replace(/\s/g, "");
  if (compact.startsWith("iVBORw0KGgo")) return `data:image/png;base64,${compact}`;
  if (compact.startsWith("/9j/")) return `data:image/jpeg;base64,${compact}`;
  if (compact.startsWith("PHN2Zy")) return `data:image/svg+xml;base64,${compact}`;
  return qr;
}

function extractQr(data: unknown): string | null {
  const root = asRecord(data);
  const inst = instanceFrom(data);
  return normalizeQr(inst.qrcode ?? inst.qrCode ?? inst.qr ?? root.qrcode ?? root.qrCode ?? root.qr);
}

function extractPaircode(data: unknown): string | null {
  const root = asRecord(data);
  const inst = instanceFrom(data);
  const paircode = inst.paircode ?? inst.pairCode ?? root.paircode ?? root.pairCode;
  return typeof paircode === "string" && paircode.trim() ? paircode.trim() : null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function normalizePhone(value: unknown): string | null {
  const digits = String(value ?? "").split("@")[0].replace(/\D/g, "");
  return digits.length >= 8 ? `+${digits}` : null;
}

function firstPhone(...values: unknown[]): string | null {
  for (const value of values) {
    const phone = normalizePhone(value);
    if (phone) return phone;
  }
  return null;
}

function statusFrom(data: unknown): string {
  const root = asRecord(data);
  const inst = instanceFrom(data);
  return mapStatus(inst.status ?? root.status ?? root);
}

function phoneFrom(data: unknown): string | null {
  const root = asRecord(data);
  const inst = instanceFrom(data);
  const status = asRecord(root.status);
  const jid = asRecord(status.jid ?? root.jid);
  const raw = firstString(inst.owner, inst.wid, jid.user, root.owner, root.wid);
  const digits = raw?.replace(/\D/g, "") ?? "";
  return digits ? `+${digits}` : null;
}

function normalizeHost(raw: string): string {
  let h = (raw || "").trim().replace(/\/$/, "");
  if (!h) return "";
  if (!/^https?:\/\//i.test(h)) h = `https://${h}`;
  return h;
}

async function uaz(host: string, path: string, init: RequestInit & { token?: string; admintoken?: string }) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (init.token) headers["token"] = init.token;
  if (init.admintoken) headers["admintoken"] = init.admintoken;
  const base = normalizeHost(host);
  if (!base) throw new Error("UAZAPI_HOST vazio ou inválido");
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  try {
    const res = await fetch(url, { ...init, headers });
    const text = await res.text();
    let data: unknown = text;
    try { data = JSON.parse(text); } catch { /* keep text */ }
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    throw new Error(`Falha ao chamar UAZAPI (${url}): ${(e as Error).message}`);
  }
}

async function findExistingUazInstance(host: string, adminToken: string, displayName: string) {
  const listRes = await uaz(host, "/instance/all", { method: "GET", admintoken: adminToken });
  if (!listRes.ok) return null;
  const root = asRecord(listRes.data);
  const arr: unknown[] = Array.isArray(listRes.data)
    ? listRes.data as unknown[]
    : Array.isArray(root.instances) ? root.instances as unknown[]
    : Array.isArray(root.data) ? root.data as unknown[]
    : [];
  const expected = displayName.trim().toLowerCase();
  const target = arr.map(asRecord).find((it) => {
    const name = firstString(it.name, it.systemName, it.system_name, it.instanceName)?.toLowerCase();
    return !!name && name === expected;
  });
  if (!target) return null;
  const token = firstString(target.token, target.instance_token, target.instanceToken);
  if (!token) return null;
  const id = firstString(target.id, target.instanceId, target.instance_id);
  return { token, id };
}

function mapStatus(connStatus: unknown): string {
  if (connStatus && typeof connStatus === "object") {
    const status = asRecord(connStatus);
    if (status.connected || status.loggedIn) return "connected";
  }
  switch (String(connStatus || "").toLowerCase()) {
    case "connected": return "connected";
    case "open": return "connected";
    case "connecting": return "qr_pending";
    case "disconnected": return "disconnected";
    case "close": return "disconnected";
    default: return "pending";
  }
}

const INIT_LOCK_TTL_MS = 90_000;

async function waitForInitializedCredentials(admin: any, channelId: string) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const creds = await loadCredentials(admin, channelId);
    if (creds?.instance_token) return creds;
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  return null;
}

async function loadCredentials(admin: any, channelId: string) {
  const { data, error } = await admin
    .from("channel_credentials")
    .select("*")
    .eq("channel_id", channelId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!error) return data ?? null;

  const fallback = await admin
    .from("channel_credentials")
    .select("*")
    .eq("channel_id", channelId)
    .limit(1)
    .maybeSingle();
  return fallback.data ?? null;
}

async function cleanupDuplicateCredentials(admin: any, channelId: string, keepId: unknown) {
  if (!keepId) return;
  try {
    await admin.from("channel_credentials").delete().eq("channel_id", channelId).neq("id", keepId);
  } catch (_) { /* best-effort */ }
}

function randomSecret(bytes = 24) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function saveCredentials(admin: any, channelId: string, values: Record<string, unknown>) {
  const existing = await loadCredentials(admin, channelId);
  const payload: Record<string, unknown> = { channel_id: channelId, ...values, updated_at: new Date().toISOString() };
  if (!existing?.webhook_secret && payload.webhook_secret === undefined) {
    payload.webhook_secret = randomSecret();
  }

  if (existing?.id) {
    const { error } = await admin.from("channel_credentials").update(payload).eq("id", existing.id);
    if (error) throw error;
    await cleanupDuplicateCredentials(admin, channelId, existing.id);
    return await loadCredentials(admin, channelId);
  }

  if (existing) {
    const { error } = await admin.from("channel_credentials").update(payload).eq("channel_id", channelId);
    if (error) throw error;
    return await loadCredentials(admin, channelId);
  }

  const { error } = await admin.from("channel_credentials").insert(payload);
  if (error) throw error;
  return await loadCredentials(admin, channelId);
}

async function configureWebhook(projectUrl: string, channelId: string, host: string, token: string, webhookSecret: string) {
  const webhook = `${projectUrl}/functions/v1/uazapi-webhook?secret=${webhookSecret}&channel=${channelId}`;
  const payload = {
    url: webhook,
    enabled: true,
    events: ["messages", "messages_update", "connection", "contacts", "groups"],
    excludeMessages: [] as string[],
    addUrlEvents: false,
    addUrlTypesMessages: false,
  };
  let result = await uaz(host, "/webhook", { method: "POST", token, body: JSON.stringify(payload) });
  if (!result.ok) {
    const fallback = await uaz(host, "/instance/webhook", { method: "POST", token, body: JSON.stringify(payload) });
    if (fallback.ok) result = fallback;
  }
  return result;
}

async function attachExistingCredentialsForChannel(admin: any, channel: any, channelId: string, projectUrl: string) {
  const host = (Deno.env.get("UAZAPI_HOST") || "").trim();
  const adminToken = (Deno.env.get("UAZAPI_ADMIN_TOKEN") || "").trim();
  if (!host || !adminToken) return null;

  const existing = await findExistingUazInstance(host, adminToken, channel.display_name);
  if (!existing?.token) return null;

  const saved = await saveCredentials(admin, channelId, {
    host,
    admin_token: adminToken,
    instance_token: existing.token,
    instance_id: existing.id ?? null,
  });

  if (saved?.webhook_secret) {
    await configureWebhook(projectUrl, channelId, host, existing.token, saved.webhook_secret);
  }
  await admin.from("channels").update({ status: "pending" }).eq("id", channelId);
  return saved;
}

async function claimInitLock(admin: any, channel: any, channelId: string) {
  const metadata = asRecord(channel.metadata);
  const startedAt = typeof metadata.uazapi_init_started_at === "string"
    ? Date.parse(metadata.uazapi_init_started_at)
    : 0;
  const lockIsFresh = typeof metadata.uazapi_init_lock === "string"
    && Number.isFinite(startedAt)
    && Date.now() - startedAt < INIT_LOCK_TTL_MS;
  if (lockIsFresh) return { acquired: false as const, lockId: null };

  const lockId = crypto.randomUUID();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("channels")
    .update({
      metadata: { ...metadata, uazapi_init_lock: lockId, uazapi_init_started_at: now },
      updated_at: now,
    })
    .eq("id", channelId)
    .eq("updated_at", channel.updated_at)
    .select("id")
    .maybeSingle();

  if (error || !data) return { acquired: false as const, lockId: null };
  return { acquired: true as const, lockId };
}

async function releaseInitLock(admin: any, channelId: string, lockId: string) {
  const { data } = await admin
    .from("channels")
    .select("metadata")
    .eq("id", channelId)
    .maybeSingle();
  const metadata = asRecord(data?.metadata);
  if (metadata.uazapi_init_lock !== lockId) return;
  delete metadata.uazapi_init_lock;
  delete metadata.uazapi_init_started_at;
  await admin.from("channels").update({ metadata }).eq("id", channelId);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "missing auth" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("DARKFUNNEL_SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !anon || !service) return json({ error: "Configuração do banco incompleta na função" }, 500);

  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const admin = createClient(url, service, { auth: { persistSession: false } });

  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return json({ error: "unauthorized" }, 401);

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }
  if (!body.channel_id || !body.action) return json({ error: "missing fields" }, 400);
  body.action = String(body.action).trim() as Body["action"];

  // valida acesso ao canal
  const { data: channel, error: chErr } = await admin
    .from("channels").select("*").eq("id", body.channel_id).maybeSingle();
  if (chErr || !channel) return json({ error: "channel not found" }, 404);

  const { data: member } = await admin
    .from("workspace_members").select("user_id").eq("workspace_id", channel.workspace_id).eq("user_id", u.user.id).maybeSingle();
  if (!member) return json({ error: "forbidden" }, 403);

  // load creds (se existirem). Usa helper tolerante a registros duplicados legados.
  let creds = await loadCredentials(admin, body.channel_id);

  try {
    if (body.action === "init") {
      const host = (Deno.env.get("UAZAPI_HOST") || "").trim();
      const adminToken = (Deno.env.get("UAZAPI_ADMIN_TOKEN") || "").trim();
      const fallbackInstanceToken = (Deno.env.get("UAZAPI_INSTANCE_TOKEN") || "").trim();
      if (!host || !adminToken) return json({ error: "UAZAPI_HOST/UAZAPI_ADMIN_TOKEN não configurados" }, 500);

      // 1) Reutiliza credenciais existentes se ainda válidas
      if (creds?.instance_token && !body.force) {
        const statusCheck = await uaz(creds.host || host, "/instance/status", { method: "GET", token: creds.instance_token });
        if (statusCheck.ok) {
          return json({ ok: true, instance_id: creds.instance_id ?? null, reused: true });
        }
        await admin.from("channel_credentials").delete().eq("channel_id", body.channel_id);
        await admin.from("channels").update({ status: "disconnected" }).eq("id", body.channel_id);
      }

      if (creds?.instance_token && body.force) {
        try { await uaz(creds.host || host, "/instance", { method: "DELETE", token: creds.instance_token }); } catch (_) { /* noop */ }
        await admin.from("channel_credentials").delete().eq("channel_id", body.channel_id);
        creds = null;
      }

      const lock = await claimInitLock(admin, channel, body.channel_id);
      if (!lock.acquired) {
        const initialized = await waitForInitializedCredentials(admin, body.channel_id);
        if (initialized?.instance_token) {
          return json({ ok: true, instance_id: initialized.instance_id ?? null, reused: true, waited: true });
        }
        return json({ error: "inicialização da instância já está em andamento" }, 409);
      }

      try {

      // Helper: registra credenciais existentes + webhook
      const registerExisting = async (existingHost: string, existingToken: string, existingId: string | null) => {
        const saved = await saveCredentials(admin, body.channel_id, {
          host: existingHost,
          admin_token: adminToken,
          instance_token: existingToken,
          instance_id: existingId,
        });
        await admin.from("channels").update({ status: "pending" }).eq("id", body.channel_id);
        const webhook = `${url}/functions/v1/uazapi-webhook?secret=${saved?.webhook_secret}&channel=${body.channel_id}`;
        const webhookResult = await uaz(existingHost, "/webhook", {
          method: "POST", token: existingToken,
          body: JSON.stringify({
            url: webhook, enabled: true,
            events: ["messages", "messages_update", "connection", "contacts", "groups"],
            excludeMessages: [], addUrlEvents: false, addUrlTypesMessages: false,
          }),
        });
        return { ok: true, instance_id: existingId, reused: true, webhook_configured: webhookResult.ok };
      };

      const existingByName = !body.force ? await findExistingUazInstance(host, adminToken, channel.display_name) : null;
      if (existingByName) return json(await registerExisting(host, existingByName.token, existingByName.id));

      // 2) Cria nova instância (endpoint /instance/init)
      const r = await uaz(host, "/instance/init", {
        method: "POST",
        admintoken: adminToken,
        body: JSON.stringify({ name: channel.display_name, systemName: channel.display_name }),
      });

      const limitReached = !r.ok && (
        /maximum number of instances/i.test(JSON.stringify(r.data)) || r.status === 429
      );

      if (limitReached) {
        // 2a) Lista instâncias existentes e tenta reutilizar pelo nome
        const listRes = await uaz(host, "/instance/all", { method: "GET", admintoken: adminToken });
        const arr: unknown[] = Array.isArray(listRes.data)
          ? listRes.data as unknown[]
          : Array.isArray(asRecord(listRes.data).instances) ? asRecord(listRes.data).instances as unknown[]
          : [];
        const items = arr.map(asRecord);
        const target = items.find((it) => {
          const name = String(it.name ?? it.systemName ?? "").toLowerCase();
          return name === String(channel.display_name).toLowerCase();
        }) ?? items[0];
        const existingToken = String(target?.token ?? "").trim();
        const existingId = (target?.id ?? target?.instanceId ?? null) as string | null;
        if (existingToken) return json(await registerExisting(host, existingToken, existingId));
        if (fallbackInstanceToken) return json(await registerExisting(host, fallbackInstanceToken, null));
        return json({
          error: "uazapi init failed",
          detail: r.data,
          hint: "Limite de instâncias atingido. Exclua instâncias não usadas no painel UAZAPI ou configure a secret UAZAPI_INSTANCE_TOKEN.",
        }, 502);
      }

      if (!r.ok) {
        if (fallbackInstanceToken) return json(await registerExisting(host, fallbackInstanceToken, null));
        return json({ error: "uazapi init failed", detail: r.data }, 502);
      }

      const inst = instanceFrom(r.data);
      const instance_token = (inst?.token ?? asRecord(r.data)?.token) as string | undefined;
      const instance_id = (inst?.id ?? inst?.instanceId ?? asRecord(r.data)?.id ?? null) as string | null;
      if (!instance_token) {
        if (fallbackInstanceToken) return json(await registerExisting(host, fallbackInstanceToken, null));
        return json({ error: "uazapi: token não retornado", detail: r.data }, 502);
      }

      const saved = await saveCredentials(admin, body.channel_id, {
        host, admin_token: adminToken, instance_token, instance_id,
      });
      await admin.from("channels").update({ status: "pending" }).eq("id", body.channel_id);

      const webhook = `${url}/functions/v1/uazapi-webhook?secret=${saved?.webhook_secret}&channel=${body.channel_id}`;
      const webhookResult = await uaz(host, "/webhook", {
        method: "POST", token: instance_token,
        body: JSON.stringify({
          url: webhook, enabled: true,
          events: ["messages", "messages_update", "connection", "contacts", "groups"],
          excludeMessages: [], addUrlEvents: false, addUrlTypesMessages: false,
        }),
      });

      return json({ ok: true, instance_id, webhook_configured: webhookResult.ok, webhook_detail: webhookResult.ok ? undefined : webhookResult.data });
      } finally {
        await releaseInitLock(admin, body.channel_id, lock.lockId);
      }
    }

    if (body.action === "attach_instance") {
      const host = normalizeHost(String(body.instance_host ?? ""));
      const instanceToken = String(body.instance_token ?? "").trim();
      if (!host || !instanceToken) return json({ error: "Informe Server URL e Instance Token" }, 400);

      const statusCheck = await uaz(host, "/instance/status", { method: "GET", token: instanceToken });
      if (!statusCheck.ok) return json({ error: "uazapi status failed", detail: statusCheck.data }, 502);

      const saved = await saveCredentials(admin, body.channel_id, {
        host,
        admin_token: null,
        instance_token: instanceToken,
        instance_id: body.instance_id?.trim() || creds?.instance_id || null,
      });

      const webhook = `${url}/functions/v1/uazapi-webhook?secret=${saved?.webhook_secret}&channel=${body.channel_id}`;
      const webhookResult = await uaz(host, "/webhook", {
        method: "POST",
        token: instanceToken,
        body: JSON.stringify({
          url: webhook,
          enabled: true,
          events: ["messages", "messages_update", "connection", "contacts", "groups"],
          excludeMessages: [],
          addUrlEvents: false,
          addUrlTypesMessages: false,
        }),
      });

      const status = statusFrom(statusCheck.data);
      const phone = phoneFrom(statusCheck.data);
      const channelUpdate: Record<string, unknown> = { status };
      if (phone) channelUpdate.phone_e164 = phone;
      await admin.from("channels").update(channelUpdate).eq("id", body.channel_id);

      return json({ ok: true, status, phone, webhook_configured: webhookResult.ok, webhook_detail: webhookResult.ok ? undefined : webhookResult.data });
    }

    if (!creds) {
      if (body.action === "delete") {
        await admin.from("channels").update({ status: "disconnected" }).eq("id", body.channel_id);
        return json({ ok: true, no_instance: true });
      }
      return json({ error: "instância não inicializada" }, 400);
    }

    if (body.action === "reconfigure_webhook") {
      const c3 = await loadCredentials(admin, body.channel_id);
      if (!c3?.webhook_secret) return json({ error: "webhook_secret ausente; reconecte o canal" }, 400);
      const webhook = `${url}/functions/v1/uazapi-webhook?secret=${c3.webhook_secret}&channel=${body.channel_id}`;
      const payload = {
        url: webhook,
        enabled: true,
        events: ["messages", "messages_update", "connection", "contacts", "groups"],
        excludeMessages: [] as string[],
        addUrlEvents: false,
        addUrlTypesMessages: false,
      };
      let r = await uaz(creds.host, "/webhook", {
        method: "POST",
        token: creds.instance_token,
        body: JSON.stringify(payload),
      });
      // fallback: algumas versões da uazapi expõem em /instance/webhook
      if (!r.ok) {
        const r2 = await uaz(creds.host, "/instance/webhook", {
          method: "POST",
          token: creds.instance_token,
          body: JSON.stringify(payload),
        });
        if (r2.ok) r = r2;
      }
      if (!r.ok) {
        const detailStr = typeof r.data === "string" ? r.data : JSON.stringify(r.data);
        return json({ error: `uazapi webhook falhou: ${detailStr?.slice(0, 300)}`, detail: r.data }, 502);
      }
      return json({ ok: true, webhook });
    }

    if (body.action === "connect") {
      const r = await uaz(creds.host, "/instance/connect", {
        method: "POST",
        token: creds.instance_token,
        body: JSON.stringify(body.phone ? { phone: body.phone } : {}),
      });
      if (!r.ok) return json({ error: "uazapi connect failed", detail: r.data }, 502);
      const qr = extractQr(r.data);
      const paircode = extractPaircode(r.data);
      const status = statusFrom(r.data);
      await admin.from("channel_credentials").update({ last_qr: qr, last_qr_at: new Date().toISOString() }).eq("channel_id", body.channel_id);
      await admin.from("channels").update({ status: status === "connected" ? "connected" : "qr_pending" }).eq("id", body.channel_id);
      // Garante grupos sempre habilitados no webhook (best-effort)
      try {
        const cw = await loadCredentials(admin, body.channel_id);
        if (cw?.webhook_secret) {
          const webhook = `${url}/functions/v1/uazapi-webhook?secret=${cw.webhook_secret}&channel=${body.channel_id}`;
          const payload = {
            url: webhook,
            enabled: true,
            events: ["messages", "messages_update", "connection", "contacts", "groups"],
            excludeMessages: [] as string[],
            addUrlEvents: false,
            addUrlTypesMessages: false,
          };
          const rw = await uaz(creds.host, "/webhook", { method: "POST", token: creds.instance_token, body: JSON.stringify(payload) });
          if (!rw.ok) await uaz(creds.host, "/instance/webhook", { method: "POST", token: creds.instance_token, body: JSON.stringify(payload) });
        }
      } catch (_) { /* best-effort */ }
      return json({ ok: true, qr, paircode, status });
    }

    if (body.action === "status") {
      const r = await uaz(creds.host, "/instance/status", { method: "GET", token: creds.instance_token });
      if (!r.ok) return json({ error: "uazapi status failed", detail: r.data }, 502);
      const status = statusFrom(r.data);
      const phone = phoneFrom(r.data);
      const update: Record<string, unknown> = { status };
      if (phone) update.phone_e164 = phone;
      await admin.from("channels").update(update).eq("id", body.channel_id);
      return json({ ok: true, status, raw: instanceFrom(r.data) });
    }

    if (body.action === "disconnect") {
      const r = await uaz(creds.host, "/instance/disconnect", { method: "POST", token: creds.instance_token });
      await admin.from("channels").update({ status: "disconnected" }).eq("id", body.channel_id);
      return json({ ok: r.ok, detail: r.data });
    }

    if (body.action === "delete") {
      let deleted = true;
      let detail: unknown = undefined;
      try {
        const r = await uaz(creds.host, "/instance", { method: "DELETE", token: creds.instance_token });
        deleted = r.ok;
        detail = r.ok ? undefined : r.data;
      } catch (e) {
        deleted = false;
        detail = (e as Error).message;
      }
      await admin.from("channel_credentials").delete().eq("channel_id", body.channel_id);
      await admin.from("channels").update({ status: "disconnected" }).eq("id", body.channel_id);
      return json({ ok: true, uazapi_deleted: deleted, detail });
    }

    if (body.action === "set_profile_name") {
      const name = (body.profile_name ?? "").trim();
      if (!name) return json({ error: "profile_name vazio" }, 400);
      const r = await uaz(creds.host, "/profile/name", { method: "POST", token: creds.instance_token, body: JSON.stringify({ name }) });
      if (!r.ok) return json({ error: "uazapi profile name failed", detail: r.data }, 502);
      return json({ ok: true });
    }

    if (body.action === "set_profile_picture") {
      const u = (body.profile_picture_url ?? "").trim();
      if (!u) return json({ error: "profile_picture_url vazio" }, 400);
      const r = await uaz(creds.host, "/profile/picture", { method: "POST", token: creds.instance_token, body: JSON.stringify({ url: u, image: u }) });
      if (!r.ok) return json({ error: "uazapi profile picture failed", detail: r.data }, 502);
      return json({ ok: true });
    }

    if (body.action === "get_privacy") {
      const r = await uaz(creds.host, "/profile/privacy", { method: "GET", token: creds.instance_token });
      if (!r.ok) return json({ error: "uazapi privacy get failed", detail: r.data }, 502);
      return json({ ok: true, privacy: r.data });
    }

    if (body.action === "set_privacy") {
      if (!body.privacy) return json({ error: "privacy vazio" }, 400);
      const r = await uaz(creds.host, "/profile/privacy", { method: "POST", token: creds.instance_token, body: JSON.stringify(body.privacy) });
      if (!r.ok) return json({ error: "uazapi privacy set failed", detail: r.data }, 502);
      return json({ ok: true });
    }

    if (body.action === "save_n8n") {
      const n = body.n8n ?? { enabled: false };
      await admin.from("channel_credentials").update({
        n8n_enabled: !!n.enabled,
        n8n_webhook_url: n.url ?? null,
        n8n_webhook_secret: n.secret ?? null,
        updated_at: new Date().toISOString(),
      }).eq("channel_id", body.channel_id);
      return json({ ok: true });
    }

    if (body.action === "generate_api_key") {
      const bytes = new Uint8Array(24);
      crypto.getRandomValues(bytes);
      const key = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
      await admin.from("channel_credentials").update({ send_api_key: key, updated_at: new Date().toISOString() }).eq("channel_id", body.channel_id);
      return json({ ok: true, api_key: key });
    }

    if (body.action === "sync_history") {
      const chatLimit = Math.min(body.chat_limit ?? 200, 500);
      const perChatLimit = Math.min(body.per_chat_limit ?? 100, 300);

      // 1) busca lista de chats
      const chatRes = await uaz(creds.host, "/chat/find", {
        method: "POST",
        token: creds.instance_token,
        body: JSON.stringify({ operator: "AND", sort: "-wa_lastMsgTimestamp", limit: chatLimit }),
      });
      if (!chatRes.ok) return json({ error: "uazapi chat/find failed", detail: chatRes.data }, 502);

      const chatsRoot = asRecord(chatRes.data);
      const chats: any[] = Array.isArray(chatRes.data) ? chatRes.data as any[]
        : Array.isArray(chatsRoot.chats) ? chatsRoot.chats as any[]
        : Array.isArray(chatsRoot.data) ? chatsRoot.data as any[]
        : [];

      let imported = 0;
      let chatsProcessed = 0;
      const errors: string[] = [];

      for (const ch of chats) {
        const chatid = ch.wa_chatid ?? ch.chatid ?? ch.id ?? ch.remoteJid;
        if (!chatid || String(chatid).includes("@g.us")) continue; // pula grupos
        chatsProcessed++;

        // 2) busca mensagens do chat
        const msgRes = await uaz(creds.host, "/message/find", {
          method: "POST",
          token: creds.instance_token,
          body: JSON.stringify({ operator: "AND", sort: "-messageTimestamp", chatid, limit: perChatLimit }),
        });
        if (!msgRes.ok) { errors.push(`chat ${chatid}: ${JSON.stringify(msgRes.data).slice(0,120)}`); continue; }

        const msgsRoot = asRecord(msgRes.data);
        const msgs: any[] = Array.isArray(msgRes.data) ? msgRes.data as any[]
          : Array.isArray(msgsRoot.messages) ? msgsRoot.messages as any[]
          : Array.isArray(msgsRoot.data) ? msgsRoot.data as any[]
          : [];

        // ordena cronologicamente para inserir do mais antigo ao mais novo
        msgs.sort((a, b) => (a.messageTimestamp ?? 0) - (b.messageTimestamp ?? 0));

        for (const m of msgs) {
          try {
            const fromMe = !!(m.fromMe ?? m.key?.fromMe);
            const remote = m.chatid ?? m.key?.remoteJid ?? m.remoteJid ?? chatid;
            const routePhone = firstPhone(remote, chatid, m.chatid, m.key?.remoteJid, m.remoteJid, m.chatJid, m.jid);
            const inboundPhone = firstPhone(routePhone, m.sender_pn, m.sender, m.from);
            const outboundPhone = firstPhone(m.toNumber, m.to, m.recipient, m.recipient_pn, m.destination, m.toJid, routePhone);
            const contactPhone = fromMe ? outboundPhone : inboundPhone;
            if (!contactPhone) continue;

            const ts = m.messageTimestamp ?? m.timestamp ?? Math.floor(Date.now() / 1000);
            const tsIso = new Date((typeof ts === "number" && ts < 2e10 ? ts * 1000 : ts)).toISOString();
            const externalId = m.id ?? m.key?.id ?? null;
            const pushName = m.pushName ?? m.sender_name ?? ch.wa_name ?? ch.name ?? null;
            const profilePic = m.profilePic ?? ch.image ?? ch.imagePreview ?? null;

            // upsert contact
            let { data: contact } = await admin
              .from("contacts").select("id,display_name,profile_pic_url")
              .eq("workspace_id", channel.workspace_id)
              .eq("phone_e164", contactPhone)
              .maybeSingle();
            if (!contact) {
              const { data: identity } = await admin
                .from("contact_identities").select("contact_id")
                .eq("workspace_id", channel.workspace_id)
                .eq("kind", "whatsapp").eq("value", contactPhone)
                .maybeSingle();
              if (identity?.contact_id) {
                const { data: c2 } = await admin.from("contacts")
                  .select("id,display_name,profile_pic_url")
                  .eq("id", identity.contact_id).maybeSingle();
                if (c2) contact = c2;
              }
            }
            if (!contact) {
              const { data: created } = await admin.from("contacts").insert({
                workspace_id: channel.workspace_id,
                display_name: pushName || contactPhone,
                phone_e164: contactPhone,
                profile_pic_url: profilePic,
              }).select("id,display_name,profile_pic_url").single();
              contact = created;
              if (contact) await admin.from("contact_identities").insert({
                workspace_id: channel.workspace_id, contact_id: contact.id,
                kind: "whatsapp", value: contactPhone, is_primary: true,
              });
            } else {
              const update: Record<string, unknown> = {};
              if (!fromMe && pushName && (!contact.display_name || contact.display_name === contactPhone)) {
                update.display_name = pushName;
              }
              if (profilePic && profilePic !== contact.profile_pic_url) {
                update.profile_pic_url = profilePic;
              }
              if (Object.keys(update).length > 0) {
                await admin.from("contacts").update(update).eq("id", contact.id);
              }
            }
            if (!contact) continue;

            // upsert conversation
            let { data: conv } = await admin.from("conversations").select("id,unread_count")
              .eq("workspace_id", channel.workspace_id)
              .eq("contact_id", contact.id).eq("channel_id", body.channel_id)
              .maybeSingle();
            if (!conv) {
              const { data: createdConv } = await admin.from("conversations").insert({
                workspace_id: channel.workspace_id,
                contact_id: contact.id, channel_id: body.channel_id,
                status: "open", unread_count: 0, last_message_at: tsIso,
              }).select("id,unread_count").single();
              conv = createdConv;
            }
            if (!conv) continue;

            // dedupe por external_id
            if (externalId) {
              const { data: exists } = await admin.from("messages").select("id")
                .eq("conversation_id", conv.id)
                .eq("payload->>external_id", externalId).maybeSingle();
              if (exists) continue;
            }

            const content = m?.message ?? m;
            const text = m?.text ?? m?.body ?? m?.content ?? content?.conversation
              ?? content?.extendedTextMessage?.text
              ?? content?.imageMessage?.caption ?? content?.videoMessage?.caption ?? "";
            const t = (m?.messageType ?? m?.type ?? content?.messageType ?? "text").toString().toLowerCase();

            const { error: msgErr } = await admin.from("messages").insert({
              workspace_id: channel.workspace_id,
              conversation_id: conv.id,
              direction: fromMe ? "out" : "in",
              type: t,
              payload: { body: text, external_id: externalId },
              status: fromMe ? "sent" : "received",
              created_at: tsIso,
              sent_at: fromMe ? tsIso : null,
            });
            if (msgErr) { errors.push(`msg ${externalId}: ${msgErr.message}`); continue; }

            await admin.from("conversations")
              .update({ last_message_at: tsIso }).eq("id", conv.id);
            imported++;
          } catch (err) {
            errors.push(`msg err: ${(err as Error).message}`);
          }
        }
      }

      return json({ ok: true, chats_processed: chatsProcessed, messages_imported: imported, errors: errors.slice(0, 10) });
    }

    if (body.action === "refresh_contacts") {
      // Lista contatos que têm conversa neste canal
      const { data: convs, error: convsErr } = await admin
        .from("conversations")
        .select("contact_id, contacts:contact_id(id, phone_e164, display_name, profile_pic_url, bio)")
        .eq("workspace_id", channel.workspace_id)
        .eq("channel_id", body.channel_id);
      if (convsErr) return json({ error: "convs query failed", detail: convsErr.message }, 500);

      const seen = new Set<string>();
      const targets: { id: string; phone: string; name: string | null; pic: string | null; bio: string | null }[] = [];
      for (const c of (convs ?? []) as any[]) {
        const ct = c.contacts;
        if (!ct || !ct.phone_e164) continue;
        if (seen.has(ct.id)) continue;
        seen.add(ct.id);
        targets.push({ id: ct.id, phone: ct.phone_e164, name: ct.display_name, pic: ct.profile_pic_url, bio: ct.bio });
      }

      let updated = 0;
      const errors: string[] = [];
      const nowIso = new Date().toISOString();

      for (const t of targets) {
        try {
          const digits = t.phone.replace(/\D/g, "");
          // Tenta /chat/details (uazapiGO v2)
          const r = await uaz(creds.host, "/chat/details", {
            method: "POST",
            token: creds.instance_token,
            body: JSON.stringify({ number: digits, preview: false }),
          });
          if (!r.ok) { errors.push(`${digits}: ${JSON.stringify(r.data).slice(0,120)}`); continue; }

          const root = asRecord(r.data);
          const chat = asRecord(root.chat ?? root.data ?? root);
          const name = firstString(chat.wa_name, chat.name, chat.pushName, chat.pushname, root.name as string);
          const image = firstString(chat.image, chat.imagePreview, chat.profilePicUrl, chat.profile_pic_url, root.image as string);
          const bio = firstString(chat.wa_status, chat.status, chat.about, chat.bio, chat.description, root.status as string);

          const update: Record<string, unknown> = { profile_synced_at: nowIso };
          if (name && (!t.name || t.name === t.phone || t.name !== name)) update.display_name = name;
          if (image && image !== t.pic) update.profile_pic_url = image;
          if (bio && bio !== t.bio) update.bio = bio;

          if (Object.keys(update).length > 0) {
            const { error: upErr } = await admin.from("contacts").update(update).eq("id", t.id);
            if (upErr) { errors.push(`${digits} upd: ${upErr.message}`); continue; }
            updated++;
          }
        } catch (err) {
          errors.push(`${t.phone}: ${(err as Error).message}`);
        }
      }

      return json({ ok: true, contacts_total: targets.length, contacts_updated: updated, errors: errors.slice(0, 10) });
    }

    if (body.action === "refresh_contact") {
      if (!body.contact_id) return json({ error: "contact_id obrigatório" }, 400);
      const { data: contact, error: cErr } = await admin
        .from("contacts")
        .select("id, phone_e164, display_name, profile_pic_url, bio, workspace_id")
        .eq("id", body.contact_id)
        .maybeSingle();
      if (cErr || !contact) return json({ error: "contato não encontrado" }, 404);
      if (contact.workspace_id !== channel.workspace_id) return json({ error: "forbidden" }, 403);
      if (!contact.phone_e164) return json({ error: "contato sem telefone" }, 400);

      const digits = contact.phone_e164.replace(/\D/g, "");
      const r = await uaz(creds.host, "/chat/details", {
        method: "POST",
        token: creds.instance_token,
        body: JSON.stringify({ number: digits, preview: false }),
      });
      if (!r.ok) return json({ error: "uazapi falhou", detail: r.data }, 502);

      const root = asRecord(r.data);
      const chat = asRecord(root.chat ?? root.data ?? root);
      const name = firstString(chat.wa_name, chat.name, chat.pushName, chat.pushname, root.name as string);
      const image = firstString(chat.image, chat.imagePreview, chat.profilePicUrl, chat.profile_pic_url, root.image as string);
      const bio = firstString(chat.wa_status, chat.status, chat.about, chat.bio, chat.description, root.status as string);

      const update: Record<string, unknown> = { profile_synced_at: new Date().toISOString() };
      if (name) update.display_name = name;
      if (image) update.profile_pic_url = image;
      if (bio) update.bio = bio;

      const { error: upErr } = await admin.from("contacts").update(update).eq("id", contact.id);
      if (upErr) return json({ error: "update falhou", detail: upErr.message }, 500);

      return json({ ok: true, name: name ?? null, image: image ?? null, bio: bio ?? null });
    }

    return json({ error: "invalid action", action: body.action, supported_actions: SUPPORTED_ACTIONS }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
