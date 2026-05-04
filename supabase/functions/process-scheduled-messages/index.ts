// Edge function — processa scheduled_messages vencidas.
// Agendada por pg_cron a cada minuto. Exige header x-cron-secret == CRON_SECRET.
// Registra cada execução em scheduled_message_runs.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const expected = Deno.env.get("CRON_SECRET");
  const provided = req.headers.get("x-cron-secret");
  if (!expected || provided !== expected) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const requestId = crypto.randomUUID();
  const startedAt = new Date();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let processed = 0;
  let errorMsg: string | null = null;
  let status = "ok";

  try {
    const { data, error } = await supabase.rpc("process_due_scheduled_messages", { p_limit: 100 });
    if (error) throw error;
    processed = Number(data ?? 0);
  } catch (e) {
    status = "error";
    errorMsg = (e as Error).message;
    console.error("[process-scheduled-messages]", requestId, e);
  }

  const finishedAt = new Date();
  // best-effort: registrar a execução
  try {
    await supabase.from("scheduled_message_runs").insert({
      request_id: requestId,
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      duration_ms: finishedAt.getTime() - startedAt.getTime(),
      processed_count: processed,
      status,
      error: errorMsg,
    });
  } catch (e) {
    console.error("[process-scheduled-messages] failed to log run", requestId, e);
  }

  if (status === "error") {
    return new Response(JSON.stringify({ error: "internal_error", request_id: requestId }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ processed, request_id: requestId }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
