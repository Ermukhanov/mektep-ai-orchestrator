// Parses an incoming chat message with Gemini, extracts intent & entities,
// and inserts proposals into pending_actions for director approval.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are MEKTEP AI — the operations brain of "Aqbobek" school.
You read every chat message that staff send (in Kazakh, Russian, or English) and decide what should happen.

Possible intents:
- attendance_report   → teacher says "7A — 22 пришли, 3 нет" / "8B қатысты 25, жоқ 1"
- teacher_absence     → "I'm sick today", "Ауырып қалдым", "не приду завтра"
- student_absence     → a student didn't come; reporter mentions student names
- incident            → broken chair, leaking pipe, fight, anything wrong with the building
- task_request        → "order water for the gym", "Айгерим, prepare hall"
- question            → asks about a regulation, schedule, etc.
- chitchat            → no action needed

Always:
1. Detect language ("kk" | "ru" | "en") and respond in the SAME language as the message.
2. Be concise, polite, professional.
3. Propose a single best action with high confidence, OR no action.
4. Never invent staff names; pick from the provided staff list when needed.

Return STRICTLY a tool call to "propose_action".`;

function tools() {
  return [
    {
      type: "function",
      function: {
        name: "propose_action",
        description:
          "Decide what action MEKTEP AI should take after reading the message.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            language: { type: "string", enum: ["kk", "ru", "en"] },
            intent: {
              type: "string",
              enum: [
                "attendance_report",
                "teacher_absence",
                "student_absence",
                "incident",
                "task_request",
                "question",
                "chitchat",
              ],
            },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            ai_reply: {
              type: "string",
              description:
                "Short reply to send back to the chat in the same language. Keep under 280 chars.",
            },
            requires_approval: {
              type: "boolean",
              description:
                "True if director must approve before executing (substitutions, incidents, tasks).",
            },
            action_type: {
              type: "string",
              enum: [
                "none",
                "log_attendance",
                "mark_teacher_absent",
                "create_incident",
                "create_task",
                "send_chat_reply",
              ],
            },
            payload: {
              type: "object",
              description: "Structured fields the action needs.",
              properties: {
                class_name: { type: "string" },
                present: { type: "number" },
                absent: { type: "number" },
                absent_reason: { type: "string" },
                staff_name: { type: "string" },
                absence_reason: { type: "string" },
                absence_date: {
                  type: "string",
                  description: "YYYY-MM-DD, default today",
                },
                incident_title: { type: "string" },
                incident_description: { type: "string" },
                incident_location: { type: "string" },
                incident_severity: {
                  type: "string",
                  enum: ["low", "medium", "high"],
                },
                task_title: { type: "string" },
                task_description: { type: "string" },
                task_assignee_name: { type: "string" },
              },
            },
          },
          required: [
            "language",
            "intent",
            "confidence",
            "ai_reply",
            "requires_approval",
            "action_type",
            "payload",
          ],
        },
      },
    },
  ];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { message_id } = await req.json();
    if (!message_id) {
      return new Response(JSON.stringify({ error: "message_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: msg, error: msgErr } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("id", message_id)
      .single();
    if (msgErr || !msg) {
      return new Response(JSON.stringify({ error: "message not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (msg.processed) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load staff names so the model can pick correct names.
    const { data: staff } = await supabase
      .from("staff")
      .select("full_name, short_name, subjects");

    const staffList = (staff || [])
      .map((s) => `- ${s.full_name} (${s.subjects?.join(", ") || ""})`)
      .join("\n");

    const userPrompt = `Message from ${msg.sender_name} (source: ${msg.source}):
"""${msg.text}"""

Staff directory (use these exact names if you reference anyone):
${staffList}

Decide one action by calling propose_action.`;

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
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          tools: tools(),
          tool_choice: {
            type: "function",
            function: { name: "propose_action" },
          },
        }),
      },
    );

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("AI error", aiRes.status, txt);
      if (aiRes.status === 429 || aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "AI quota / rate limit" }), {
          status: aiRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiRes.json();
    const call = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) {
      console.error("No tool call", JSON.stringify(aiJson));
      return new Response(JSON.stringify({ error: "no tool call" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const args = JSON.parse(call.function.arguments);

    // Save the parse trace
    await supabase.from("message_parses").insert({
      message_id: msg.id,
      intent: args.intent,
      entities: args.payload || {},
      confidence: args.confidence,
      ai_reply: args.ai_reply,
    });

    // Auto-execute attendance reports (low risk, frequent) — but still log a
    // pending_action so director sees the AI worked.
    let autoExecuted = false;
    if (args.action_type === "log_attendance" && args.payload?.class_name) {
      await supabase.from("attendance_reports").insert({
        class_name: args.payload.class_name,
        present: args.payload.present || 0,
        absent: args.payload.absent || 0,
        absent_reason: args.payload.absent_reason || null,
        reported_by_name: msg.sender_name,
        reported_by_staff_id: msg.sender_staff_id,
        source_message_id: msg.id,
      });
      autoExecuted = true;
    }

    // Always queue a pending_action for director visibility (except chitchat).
    if (args.action_type !== "none" && args.intent !== "chitchat") {
      await supabase.from("pending_actions").insert({
        source_message_id: msg.id,
        action_type: args.action_type,
        payload: { ...args.payload, language: args.language },
        ai_summary: args.ai_reply,
        ai_reasoning: `Intent: ${args.intent}, confidence: ${args.confidence}`,
        status: autoExecuted ? "executed" : "pending",
      });
    }

    // Mark the message as processed
    await supabase
      .from("chat_messages")
      .update({ processed: true, language: args.language })
      .eq("id", msg.id);

    return new Response(
      JSON.stringify({ ok: true, intent: args.intent, autoExecuted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("parse-chat fatal", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
