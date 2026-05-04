// Cria um novo usuário e adiciona ao workspace (somente admin/owner do workspace)
// redeploy: 2026-05-04T02:30Z
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Role = "owner" | "admin" | "manager" | "member";

type Body = {
  workspace_id: string;
  email: string;
  password: string;
  display_name: string;
  client_visible_name?: string | null;
  role: Role;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "missing auth" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("DARKFUNNEL_SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !anon || !service) return json({ error: "Configuração do banco incompleta" }, 500);

  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const admin = createClient(url, service, { auth: { persistSession: false } });

  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return json({ error: "unauthorized" }, 401);

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }

  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  const displayName = (body.display_name || "").trim();
  const clientName = (body.client_visible_name ?? "").toString().trim() || null;
  const role: Role = (body.role || "member") as Role;

  if (!body.workspace_id || !email || !password || !displayName) {
    return json({ error: "Preencha email, nome e senha" }, 400);
  }
  if (password.length < 6) return json({ error: "Senha deve ter ao menos 6 caracteres" }, 400);

  // valida que o solicitante é admin/owner do workspace
  const { data: caller } = await admin
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", body.workspace_id)
    .eq("user_id", u.user.id)
    .maybeSingle();
  if (!caller || !["owner", "admin"].includes(caller.role)) {
    return json({ error: "Apenas administradores podem criar usuários" }, 403);
  }

  // cria usuário no auth (ou recupera se já existe)
  let userId: string | null = null;
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });

  if (cErr) {
    const msg = cErr.message || "";
    if (/already.*registered|exists|duplicate/i.test(msg)) {
      // pega o id do existente via profiles
      const { data: prof } = await admin
        .from("profiles").select("id").ilike("email", email).maybeSingle();
      if (prof) userId = prof.id;
      else return json({ error: "Email já cadastrado em outra conta" }, 409);
    } else {
      return json({ error: msg || "Erro ao criar usuário" }, 400);
    }
  } else {
    userId = created.user?.id ?? null;
  }
  if (!userId) return json({ error: "Falha ao identificar usuário" }, 500);

  // upsert profile
  await admin.from("profiles").upsert({
    id: userId,
    email,
    display_name: displayName,
    client_visible_name: clientName,
  }, { onConflict: "id" });

  // adiciona ao workspace
  const { error: mErr } = await admin
    .from("workspace_members")
    .insert({ workspace_id: body.workspace_id, user_id: userId, role });
  if (mErr && mErr.code !== "23505") {
    return json({ error: mErr.message }, 400);
  }

  return json({ ok: true, user_id: userId });
});
