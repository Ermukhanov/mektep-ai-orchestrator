// Takes a transcript (from browser SpeechRecognition) and turns it into a task
// using Gemini. Picks an assignee from real staff list. Replies in same language.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAlem } from "../_shared/llm.ts";

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

    let args: any = {};
    try {
      const j = await callAlem('/v1/chat/completions', {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an assistant that converts a director's voice command into ONE or MORE actionable tasks. Return a single function call to create_tasks with an array of tasks. Each task should have: title, description (optional), assignee_full_name (optional), due (optional date), and confirmation (short message for the director). Reply in the same language as the input (${language || "auto"}).`,
          },
          { role: "user", content: `Voice command: "${transcript}"\n\nStaff:\n${staffList}\n\nReturn tool call create_tasks.` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_tasks",
              parameters: {
                type: "object",
                properties: {
                  tasks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        assignee_full_name: { type: "string" },
                        due: { type: "string" },
                        confirmation: { type: "string" },
                      },
                      required: ["title"],
                    },
                  },
                },
                required: ["tasks"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_tasks" } },
      });

      const call = j.choices?.[0]?.message?.tool_calls?.[0] || j.content?.find((c:any)=>c.type==='tool_use');
      if (!call) throw new Error('no tool call from ALEM');
      args = JSON.parse(call.function.arguments || "{}");
    } catch (e) {
      console.error('voice-task ALEM failed, using fallback mock', e);
      // Provide a safe mock response so UI remains functional
      args = { tasks: [{ title: `Задача (автогенерация): ${transcript.slice(0,80)}`, description: transcript, assignee_full_name: null, confirmation: 'Задача создана (mock)' }] };
    }
    const tasksInput = Array.isArray(args.tasks) ? args.tasks : [];

    const created: any[] = [];
    const confirmations: string[] = [];

    for (const t of tasksInput) {
      const title = t.title || "Задача";
      const description = t.description || null;
      const assigneeName = t.assignee_full_name || null;
      const due = t.due || null;
      const confirmation = t.confirmation || null;

      let assigneeId: string | null = null;
      let assigneeFull: string | null = assigneeName;
      if (assigneeName) {
        const { data: a } = await supabase
          .from("staff")
          .select("id, full_name")
          .ilike("full_name", `%${assigneeName}%`)
          .limit(1)
          .maybeSingle();
        if (a) { assigneeId = a.id; assigneeFull = a.full_name; }
      }

      const insertObj: any = {
        title,
        description,
        assignee_staff_id: assigneeId,
        assignee_name: assigneeFull || null,
        source: "voice",
        created_by: user.id,
      };
      if (due) insertObj.due_at = due;

      const { data: inserted } = await supabase.from("tasks").insert(insertObj).select().single();
      created.push(inserted || null);
      if (confirmation) confirmations.push(confirmation);
    }

    return new Response(JSON.stringify({ ok: true, created, confirmations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("voice-task fatal", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
