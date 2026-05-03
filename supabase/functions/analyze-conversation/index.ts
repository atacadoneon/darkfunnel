// Edge function: analisa qualidade do atendimento via Lovable AI Gateway
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { conversation_id } = await req.json();
    if (!conversation_id) throw new Error("conversation_id required");

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: conv, error: cErr } = await supabase
      .from("conversations")
      .select("id, workspace_id, contacts(display_name, phone_e164)")
      .eq("id", conversation_id)
      .maybeSingle();
    if (cErr || !conv) throw new Error("conversation not found");

    const { data: msgs } = await supabase
      .from("messages")
      .select("direction, type, payload, created_at")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: true })
      .limit(200);

    const transcript = (msgs ?? []).map((m: any) => {
      const who = m.direction === "in" ? "Cliente" : "Atendente";
      const text = m?.payload?.body ?? `[${m.type}]`;
      return `${who}: ${text}`;
    }).join("\n");

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Você é um coach de vendas/atendimento. Avalie a conversa abaixo. Sempre use a ferramenta retornar_avaliacao." },
          { role: "user", content: `Contato: ${conv.contacts?.display_name ?? conv.contacts?.phone_e164 ?? "—"}\n\nTranscrição:\n${transcript || "(sem mensagens)"}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "retornar_avaliacao",
            description: "Retorna a avaliação do atendimento.",
            parameters: {
              type: "object",
              properties: {
                summary: { type: "string", description: "Resumo curto do atendimento" },
                score: { type: "integer", description: "Nota 0-100" },
                strengths: { type: "array", items: { type: "string" } },
                improvements: { type: "array", items: { type: "string" } },
                next_actions: { type: "array", items: { type: "string" } },
              },
              required: ["summary","score","strengths","improvements","next_actions"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "retornar_avaliacao" } },
      }),
    });

    if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limit. Tente novamente." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (aiResp.status === 402) return new Response(JSON.stringify({ error: "Sem créditos. Adicione em Settings > Workspace > Usage." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("ai error", aiResp.status, t);
      throw new Error("AI gateway error");
    }
    const aiJson = await aiResp.json();
    const tc = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) throw new Error("AI did not return analysis");
    const args = JSON.parse(tc.function.arguments);

    const { data: saved, error: sErr } = await supabase
      .from("conversation_ai_analyses")
      .insert({
        workspace_id: conv.workspace_id,
        conversation_id,
        requested_by: user.id,
        summary: args.summary,
        score: args.score,
        strengths: args.strengths,
        improvements: args.improvements,
        next_actions: args.next_actions,
        raw: aiJson,
      })
      .select()
      .single();
    if (sErr) throw sErr;

    return new Response(JSON.stringify({ analysis: saved }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
