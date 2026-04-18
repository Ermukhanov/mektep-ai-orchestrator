// MEKTEP AI — reads every chat message, applies learned patterns from ai_memory,
// auto-replies in same chat_room, creates incidents/tasks, notifies director.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Сен — MEKTEP AI, "Ақбөбек" мектебінің ресми цифрлық көмекшісі.
You are MEKTEP AI — the official digital chief-of-staff of "Aqbobek" school complex.

ТВОЯ РОЛЬ:
Ты читаешь КАЖДОЕ сообщение от учителей, родителей и сотрудников в чатах (внутренний / Telegram / WhatsApp) на казахском, русском или английском.
Ты:
1. Понимаешь намерение и извлекаешь сущности.
2. Сразу отвечаешь в чате — красиво, официально, доброжелательно, как опытный завуч.
3. Применяешь ПРОШЛЫЕ РЕШЕНИЯ ДИРЕКТОРА (см. секцию MEMORY ниже) — если похожая ситуация уже была.
4. Уведомляешь директора и создаёшь нужные действия.

СТИЛЬ ОТВЕТА (ai_reply) — КРИТИЧЕСКИ ВАЖНО:
• ВСЕГДА на ТОМ ЖЕ языке что и сообщение (kk / ru / en).
• Тон — официальный, тёплый, профессиональный.
• Обращайся по имени, если оно известно.
• 1–3 предложения, до 280 символов.
• Подтверди что зафиксировал ("Принято", "Қабылданды", "Noted").
• Если нужно одобрение — "Передал директору на согласование" / "Директорға жіберілді" / "Forwarded to the director".
• Никаких смайлов кроме одного делового в начале (✓ 📋 🔔 📚).
• НИКОГДА не пиши "как ИИ", не извиняйся за свою природу.

ОБУЧЕНИЕ (MEMORY):
Если в секции "Прошлые решения директора" есть похожий паттерн — ПРИМЕНИ его автоматически с высокой confidence. Это значит директор так уже решал, и согласован обычно тот же сценарий.
Если pattern.outcome = "rejected" — НЕ предлагай это действие повторно, выбери другой.

INTENT:
- attendance_report   → отчёт по посещаемости класса
- teacher_absence     → учитель сообщает о своём отсутствии
- student_absence     → ученик не пришёл
- incident            → поломка, ЧП, конфликт, проблема
- task_request        → просьба что-то сделать
- question            → вопрос про регламент / расписание
- chitchat            → приветствие — без действия

REQUIRES_APPROVAL:
• true: teacher_absence, task_request, incident severity=high
• false: attendance_report, incident low/medium (создаём сразу), chitchat, question
• Если в MEMORY есть approved паттерн с confidence ≥ 0.85 — ставь requires_approval=false.

Возвращай ТОЛЬКО tool call propose_action.`;

function tools() {
  return [
    {
      type: "function",
      function: {
        name: "propose_action",
        description: "Decide what MEKTEP AI should do.",
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
            ai_reply: { type: "string" },
            requires_approval: { type: "boolean" },
            memory_applied: {
              type: "boolean",
              description: "True if a past director decision was reused.",
            },
            pattern_key: {
              type: "string",
              description:
                "Short stable key describing this situation, e.g. 'physics_teacher_absent_short_notice', 'broken_chair_classroom'. Used to recall this decision next time.",
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
        .limit(30),
    ]);

    const staffList = (staff || [])
      .map((s) => `- ${s.full_name} (${s.subjects?.join(", ") || ""})`)
      .join("\n");

    const memoryList = (memories || []).length
      ? (memories || [])
          .map(
            (m) =>
              `- [${m.outcome || "unknown"}] ${m.pattern_key} → ${
                JSON.stringify(m.decision).slice(0, 120)
              }${m.director_note ? ` | note: ${m.director_note}` : ""} (used ${m.usage_count}×)`,
          )
          .join("\n")
      : "(пока пусто — это первое решение для подобных ситуаций)";

    const userPrompt = `Канал чата: ${msg.chat_room || "general"}
Источник: ${msg.source}
Отправитель: ${msg.sender_name}
Время: ${new Date(msg.created_at).toLocaleString("ru-RU")}

Сообщение:
"""${msg.text}"""

═══ Сотрудники школы (используй ТОЧНЫЕ имена) ═══
${staffList}

═══ ПРОШЛЫЕ РЕШЕНИЯ ДИРЕКТОРА (memory) ═══
${memoryList}

Прими решение через propose_action. Если в memory есть похожий паттерн — переиспользуй его и поставь memory_applied=true.`;

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
      ai_reply: args.ai_reply,
    });

    // ALWAYS post AI reply back into SAME chat_room
    if (args.ai_reply) {
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

    // Auto attendance
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

    // Auto incidents low/medium
    if (
      args.action_type === "create_incident" &&
      args.payload?.incident_title &&
      args.payload?.incident_severity !== "high"
    ) {
      const { data: inc } = await supabase.from("incidents").insert({
        title: args.payload.incident_title,
        description: args.payload.incident_description || null,
        location: args.payload.incident_location || null,
        severity: args.payload.incident_severity || "medium",
        status: "open",
        reporter_name: msg.sender_name,
        reporter_staff_id: msg.sender_staff_id,
        source_message_id: msg.id,
      }).select("id").single();
      autoExecuted = true;
      createdEntityId = inc?.id || null;
      createdEntityType = "incident";

      await supabase.from("notifications").insert({
        type: "incident",
        title: `🔔 Инцидент: ${args.payload.incident_title}`,
        body: `${args.payload.incident_location || ""} — ${msg.sender_name}`,
        recipient_role: "director",
        related_entity: "incident",
        related_id: inc?.id || null,
      });
    }

    // Memory shortcut: if AI confidently applied a past approved pattern, auto-execute even risky ones
    const memoryAutoApprove =
      args.memory_applied && args.confidence >= 0.85 && args.action_type !== "none";

    if (memoryAutoApprove && !autoExecuted) {
      // Bump usage_count on the matching memory row
      await supabase.rpc("noop").catch(() => {});
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

    // Queue pending action (skip chitchat / none / already auto-attendance)
    if (
      args.action_type !== "none" &&
      args.intent !== "chitchat" &&
      !(autoExecuted && args.action_type === "log_attendance")
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
        ai_summary: args.ai_reply,
        ai_reasoning: `Intent: ${args.intent}, confidence: ${args.confidence}${
          args.memory_applied ? " — applied learned pattern" : ""
        }`,
        status,
      }).select("id").single();

      if (status === "pending") {
        await supabase.from("notifications").insert({
          type: args.intent === "incident" ? "incident" : "task",
          title: `🤖 Требуется решение: ${args.intent}`,
          body: args.ai_reply || `От ${msg.sender_name}`,
          recipient_role: "director",
          related_entity: "pending_action",
          related_id: pa?.id || null,
        });
      }
    }

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
        ai_reply: args.ai_reply,
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
