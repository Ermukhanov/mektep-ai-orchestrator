// Takes a transcript (from browser SpeechRecognition) and turns it into a task
// using Gemini. Picks an assignee from real staff list. Replies in same language.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response("unauth", { status: 401, headers: corsHeaders });

    const { transcript, language } = await req.json();
    if (!transcript || typeof transcript !== "string") {
      return new Response(JSON.stringify({ error: "transcript required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response("unauth", { status: 401, headers: corsHeaders });

    const { data: staff } = await supabase
      .from("staff")
      .select("id, full_name, subjects");

    const staffList = (staff || [])
      .map((s) => `- ${s.full_name} (${s.subjects?.join(", ")})`)
      .join("\n");

    const aiRes = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                `You convert a director's voice command into a task. Reply in the SAME language as the input (${language || "auto"}).`,
            },
            {
              role: "user",
              content: `Voice command: "${transcript}"\n\nStaff:\n${staffList}\n\nReturn a structured task.`,
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "create_task",
                parameters: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                    assignee_full_name: { type: "string" },
                    confirmation: {
                      type: "string",
                      description: "Short reply to director in their language.",
                    },
                  },
                  required: ["title", "assignee_full_name", "confirmation"],
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "create_task" } },
        }),
      },
    );

    if (!aiRes.ok) {
      if (aiRes.status === 429 || aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "AI quota / rate limit" }), {
          status: aiRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "ai error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const j = await aiRes.json();
    const call = j.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) {
      return new Response(JSON.stringify({ error: "no tool call" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const args = JSON.parse(call.function.arguments);

    const { data: assignee } = await supabase
      .from("staff")
      .select("id, full_name")
      .ilike("full_name", `%${args.assignee_full_name}%`)
      .maybeSingle();

    const { data: task } = await supabase
      .from("tasks")
      .insert({
        title: args.title,
        description: args.description,
        assignee_staff_id: assignee?.id || null,
        assignee_name: assignee?.full_name || args.assignee_full_name,
        source: "voice",
        created_by: user.id,
      })
      .select()
      .single();

    return new Response(
      JSON.stringify({ ok: true, task, confirmation: args.confirmation }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("voice-task fatal", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
