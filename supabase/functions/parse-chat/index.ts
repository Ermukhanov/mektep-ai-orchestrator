// MEKTEP AI — reads every chat message, applies learned patterns from ai_memory,
// replies ONLY for critical events (teacher absence, high-severity incidents),
// always creates incidents/tasks on dashboard, notifies director.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Ты — MEKTEP AI, цифровой завуч школы «Ақбөбек».

ТВОЯ ГЛАВНАЯ ЗАДАЧА:
1. Понять намерение сообщения и извлечь данные
2. Зафиксировать всё важное в системе (посещаемость, инциденты, задачи)
3. Отвечать в чате ТОЛЬКО в критических случаях — не засорять чат

КОГДА ОТВЕЧАТЬ В ЧАТ (should_reply = true):
✓ Учитель сообщает о СВОЕЙ болезни / отсутствии
✓ Инцидент с severity = high (ЧП, травма, пожар, серьёзная поломка)
✓ Сообщение требует срочного подтверждения директора

КОГДА НЕ ОТВЕЧАТЬ (should_reply = false):
✗ Обычный отчёт по посещаемости — просто фиксируем молча
✗ Приветствия, болтовня
✗ Вопросы без срочности
✗ Инциденты low/medium — создаём задачу, директор увидит в панели
✗ Любое рутинное сообщение

СТИЛЬ ОТВЕТА (когда всё же отвечаем):
• На том же языке что и сообщение (kk / ru / en)
• Официальный, деловой тон
• 1–2 предложения максимум, до 200 символов
• Начинать с: ✓ (подтверждение) или 🔔 (срочно)
• "Передано директору" / "Директорға жіберілді"

INTENT классификация:
- attendance_report   → посещаемость класса (НЕ отвечаем)
- teacher_absence     → учитель болен/отсутствует (ОТВЕЧАЕМ)
- student_absence     → ученик не пришёл (НЕ отвечаем)
- incident            → проблема/поломка (отвечаем ТОЛЬКО если high)
- task_request        → просьба что-то сделать (НЕ отвечаем, создаём задачу)
- question            → вопрос (НЕ отвечаем в чат)
- chitchat            → приветствие (НЕ отвечаем)

Возвращай ТОЛЬКО tool call propose_action.`;

function tools() {
  return [
    {
      type: "function",
      function: {
        name: "propose_action",
        description: "Decide what MEKTEP AI should do with this message.",
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
            should_reply: {
              type: "boolean",
              description: "Only true for teacher_absence or high-severity incidents. False for routine messages.",
            },
            ai_reply: {
              type: "string",
              description: "Short reply ONLY if should_reply=true. Empty string otherwise.",
            },
            requires_approval: { type: "boolean" },
            memory_applied: { type: "boolean" },
            pattern_key: { type: "string" },
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
              properties: {
                class_name: { type: "string" },
                present: { type: "number" },
                absent: { type: "number" },
                absent_reason: { type: "string" },
                staff_name: { type: "string" },
                absence_reason: { type: "string" },
                absence_date: { type: "string" },
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
            "should_reply",
            "ai_reply",
            "requires_approval",
            "memory_applied",
            "pattern_key",
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

    // Skip if already processed or if it's an AI message
    if (msg.processed || msg.source === "ai") {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load staff + recent AI memory in parallel
    const [{ data: staff }, { data: memories }] = await Promise.all([
      supabase.from("staff").select("full_name, short_name, subjects"),
      supabase
        .from("ai_memory")
        .select("pattern_type, pattern_key, decision, outcome, director_note, usage_count")
        .order("last_used_at", { ascending: false })
        .limit(20),
    ]);

    const staffList = (staff || [])
      .map((s) => `- ${s.full_name} (${s.subjects?.join(", ") || ""})`)
      .join("\n");

    const memoryList = (memories || []).length
      ? (memories || [])
          .map(
            (m) =>
              `- [${m.outcome || "unknown"}] ${m.pattern_key} → ${
                JSON.stringify(m.decision).slice(0, 100)
              }${m.director_note ? ` | note: ${m.director_note}` : ""} (used ${m.usage_count}×)`,
          )
          .join("\n")
      : "(нет прошлых решений)";

    const userPrompt = `Канал: ${msg.chat_room || "general"}
Источник: ${msg.source}
Отправитель: ${msg.sender_name}
Время: ${new Date(msg.created_at).toLocaleString("ru-RU")}

Сообщение:
"""${msg.text}"""

═══ Сотрудники школы ═══
${staffList}

═══ ПРОШЛЫЕ РЕШЕНИЯ ДИРЕКТОРА ═══
${memoryList}

Важно: should_reply=true ТОЛЬКО если учитель болен ИЛИ incident severity=high. Для посещаемости и рутины — should_reply=false, ai_reply="".`;

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
          tool_choice: { type: "function", function: { name: "propose_action" } },
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

    // Save parse trace
    await supabase.from("message_parses").insert({
      message_id: msg.id,
      intent: args.intent,
      entities: { ...(args.payload || {}), pattern_key: args.pattern_key, memory_applied: args.memory_applied },
      confidence: args.confidence,
      ai_reply: args.should_reply ? args.ai_reply : null,
    });

    // Post AI reply to chat ONLY if should_reply=true AND reply is not empty
    if (args.should_reply && args.ai_reply && args.ai_reply.trim().length > 0) {
      await supabase.from("chat_messages").insert({
        text: args.ai_reply,
        sender_name: "MEKTEP AI",
        source: "ai",
        chat_room: msg.chat_room || "general",
        reply_to_message_id: msg.id,
        language: args.language,
        processed: true,
        metadata: { memory_applied: !!args.memory_applied, intent: args.intent },
      });
    }

    let autoExecuted = false;
    let createdEntityId: string | null = null;
    let createdEntityType: string | null = null;

    // Auto-log attendance silently (no reply needed)
    if (args.action_type === "log_attendance" && args.payload?.class_name) {
      const { data: ar } = await supabase.from("attendance_reports").insert({
        class_name: args.payload.class_name,
        present: args.payload.present || 0,
        absent: args.payload.absent || 0,
        absent_reason: args.payload.absent_reason || null,
        reported_by_name: msg.sender_name,
        reported_by_staff_id: msg.sender_staff_id,
        source_message_id: msg.id,
      }).select("id").single();
      autoExecuted = true;
      createdEntityId = ar?.id || null;
      createdEntityType = "attendance";
    }

    // Auto-create incidents (low and medium automatically, high needs approval)
    if (
      args.action_type === "create_incident" &&
      args.payload?.incident_title
    ) {
      const severity = args.payload?.incident_severity || "medium";
      const shouldAutoCreate = severity !== "high";

      if (shouldAutoCreate) {
        const { data: inc } = await supabase.from("incidents").insert({
          title: args.payload.incident_title,
          description: args.payload.incident_description || null,
          location: args.payload.incident_location || null,
          severity,
          status: "open",
          reporter_name: msg.sender_name,
          reporter_staff_id: msg.sender_staff_id,
          source_message_id: msg.id,
        }).select("id").single();
        autoExecuted = true;
        createdEntityId = inc?.id || null;
        createdEntityType = "incident";

        // Notify director on dashboard
        await supabase.from("notifications").insert({
          type: "incident",
          title: `🔔 Инцидент: ${args.payload.incident_title}`,
          body: `${args.payload.incident_location ? args.payload.incident_location + " — " : ""}${msg.sender_name}`,
          recipient_role: "director",
          related_entity: "incident",
          related_id: inc?.id || null,
        });
      }
    }

    // Memory shortcut: if AI confidently applied a past approved pattern
    const memoryAutoApprove =
      args.memory_applied && args.confidence >= 0.85 && args.action_type !== "none";

    if (memoryAutoApprove && !autoExecuted) {
      const { data: existing } = await supabase
        .from("ai_memory")
        .select("id, usage_count")
        .eq("pattern_key", args.pattern_key)
        .eq("outcome", "approved")
        .maybeSingle();
      if (existing) {
        await supabase
          .from("ai_memory")
          .update({ usage_count: (existing.usage_count || 1) + 1, last_used_at: new Date().toISOString() })
          .eq("id", existing.id);
      }
    }

    // Queue pending action for director (skip: chitchat, none, already executed attendance)
    if (
      args.action_type !== "none" &&
      args.intent !== "chitchat" &&
      !(autoExecuted && args.action_type === "log_attendance") &&
      !(autoExecuted && args.action_type === "create_incident")
    ) {
      const status = autoExecuted || memoryAutoApprove ? "executed" : "pending";
      const { data: pa } = await supabase.from("pending_actions").insert({
        source_message_id: msg.id,
        action_type: args.action_type,
        payload: {
          ...args.payload,
          language: args.language,
          pattern_key: args.pattern_key,
          memory_applied: args.memory_applied,
          chat_room: msg.chat_room,
        },
        ai_summary: args.should_reply && args.ai_reply ? args.ai_reply : `${args.intent}: ${msg.text.slice(0, 100)}`,
        ai_reasoning: `Intent: ${args.intent}, confidence: ${args.confidence}${
          args.memory_applied ? " — applied learned pattern" : ""
        }`,
        status,
      }).select("id").single();

      // Notify director only for pending (needs decision)
      if (status === "pending") {
        const notifTitle = args.intent === "teacher_absence"
          ? `👤 Учитель отсутствует: требуется замена`
          : args.intent === "incident"
          ? `🚨 Инцидент требует решения`
          : `📋 Требуется решение директора`;

        await supabase.from("notifications").insert({
          type: args.intent === "incident" ? "incident" : "task",
          title: notifTitle,
          body: args.ai_reply || `От ${msg.sender_name}`,
          recipient_role: "director",
          related_entity: "pending_action",
          related_id: pa?.id || null,
        });
      }
    }

    // Mark message as processed
    await supabase
      .from("chat_messages")
      .update({ processed: true, language: args.language })
      .eq("id", msg.id);

    return new Response(
      JSON.stringify({
        ok: true,
        intent: args.intent,
        autoExecuted,
        memoryApplied: args.memory_applied,
        repliedInChat: args.should_reply && !!args.ai_reply,
        createdEntityType,
        createdEntityId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("parse-chat fatal", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
