// MEKTEP AI — reads every chat message, decides what to do,
// auto-replies in the chat (formal & elegant), creates incidents/tasks,
// notifies the director, and queues sensitive actions for approval.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Сен — MEKTEP AI, "Ақбөбек" мектебінің ресми цифрлық көмекшісі.
You are MEKTEP AI — the official digital chief-of-staff of "Aqbobek" school complex.

ТВОЯ РОЛЬ / YOUR ROLE:
Ты читаешь КАЖДОЕ сообщение от учителей и сотрудников в чате (WhatsApp / Telegram / внутренний чат) на казахском, русском или английском языке. Ты:
1. Понимаешь намерение (intent) и извлекаешь сущности.
2. Сразу отвечаешь в чате — красиво, официально, доброжелательно, как опытный завуч.
3. Решаешь, какое действие нужно совершить.
4. Уведомляешь директора, если случилось что-то важное.

СТИЛЬ ОТВЕТА (ai_reply) — КРИТИЧЕСКИ ВАЖНО:
• Всегда отвечай на ТОМ ЖЕ языке, что и сообщение (kk / ru / en).
• Тон — официальный, тёплый, профессиональный. Как директор школы говорит с коллегой.
• Обязательно обращайся по имени, если оно известно ("Айгүл Сериковна", "Дмитрий Петрович").
• Краткость + ясность. 1–3 предложения. До 280 символов.
• Подтверди, что ты ЗАФИКСИРОВАЛ информацию ("Принято", "Қабылданды", "Noted").
• Если нужно одобрение директора — скажи: "Передал директору на согласование" / "Директорға жіберілді" / "Forwarded to the director for approval".
• Если инцидент — добавь сочувствие и заверение, что вопрос решается.
• НИКОГДА не используй смайлы, кроме одного делового в начале (✓, 📋, 🔔). 
• НИКОГДА не пиши "как ИИ", не извиняйся за свою природу, не задавай лишних вопросов.

ПРИМЕРЫ ОТВЕТОВ:
• Учитель сообщил посещаемость "7А — 22 пришли, 1 нет (болеет)":
  → "✓ Принято, Айгүл Сериковна. По 7А: 22 присутствуют, 1 отсутствует (болезнь). Данные внесены в журнал."
• Учитель пишет "Ауырып қалдым, ертең келе алмаймын":
  → "✓ Қабылданды, Дәурен Қайратұлы. Тез арада сауығып кетіңіз. Орынбасу ұсыныстары директорға жіберілді."
• Кто-то сообщил о сломанном стуле в 12 кабинете:
  → "📋 Принято. Инцидент №зарегистрирован: сломанный стул в каб. 12. Завхоз уведомлён, директор проинформирован."
• Сообщение "доброе утро коллеги":
  → "Доброе утро! Хорошего рабочего дня."

ВОЗМОЖНЫЕ INTENT:
- attendance_report   → отчёт по посещаемости класса
- teacher_absence     → учитель сообщает о своём отсутствии
- student_absence     → ученик не пришёл
- incident            → поломка, ЧП, конфликт, проблема в здании
- task_request        → просьба что-то сделать ("закажи воду", "подготовь зал")
- question            → вопрос про регламент, расписание, приказ
- chitchat            → приветствие, благодарность — без действия

REQUIRES_APPROVAL:
• true для: teacher_absence (нужны замены), task_request (нужен исполнитель), incident с severity=high
• false для: attendance_report (низкий риск), incident с severity=low/medium (создаём сразу, директор видит в дашборде), chitchat, question

Возвращай ТОЛЬКО tool call propose_action. Никакого свободного текста.`;

function tools() {
  return [
    {
      type: "function",
      function: {
        name: "propose_action",
        description: "Decide what MEKTEP AI should do after reading the message.",
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
                "Formal, warm, concise reply in the SAME language as the message. Under 280 chars. Address the sender by name when known.",
            },
            requires_approval: { type: "boolean" },
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

    const { data: staff } = await supabase
      .from("staff")
      .select("full_name, short_name, subjects");

    const staffList = (staff || [])
      .map((s) => `- ${s.full_name} (${s.subjects?.join(", ") || ""})`)
      .join("\n");

    const userPrompt = `Сообщение от: ${msg.sender_name}
Канал: ${msg.source}
Время: ${new Date(msg.created_at).toLocaleString("ru-RU")}

Текст:
"""${msg.text}"""

Список сотрудников школы (используй ТОЧНЫЕ имена, если ссылаешься):
${staffList}

Прими решение через propose_action. Ответ (ai_reply) — обязательно официально, на языке сообщения, с обращением по имени.`;

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

    // 1. Save the parse trace
    await supabase.from("message_parses").insert({
      message_id: msg.id,
      intent: args.intent,
      entities: args.payload || {},
      confidence: args.confidence,
      ai_reply: args.ai_reply,
    });

    // 2. ALWAYS post AI reply back into the chat (visible to everyone in Inbox & Live Feed)
    if (args.ai_reply) {
      await supabase.from("chat_messages").insert({
        text: args.ai_reply,
        sender_name: "MEKTEP AI",
        source: "ai",
        language: args.language,
        processed: true,
      });
    }

    // 3. Auto-execute low-risk actions
    let autoExecuted = false;
    let createdEntityId: string | null = null;
    let createdEntityType: string | null = null;

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

    // Auto-create incidents (low/medium severity) so director sees them immediately
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

      // Notify director
      await supabase.from("notifications").insert({
        type: "incident",
        title: `🔔 Новый инцидент: ${args.payload.incident_title}`,
        body: `${args.payload.incident_location || ""} — сообщил(а) ${msg.sender_name}`,
        recipient_role: "director",
        related_entity: "incident",
        related_id: inc?.id || null,
      });
    }

    // 4. Queue pending action for director (skip chitchat & none)
    if (
      args.action_type !== "none" &&
      args.intent !== "chitchat" &&
      !(autoExecuted && args.action_type === "log_attendance")
    ) {
      const { data: pa } = await supabase.from("pending_actions").insert({
        source_message_id: msg.id,
        action_type: args.action_type,
        payload: { ...args.payload, language: args.language },
        ai_summary: args.ai_reply,
        ai_reasoning: `Intent: ${args.intent}, confidence: ${args.confidence}`,
        status: autoExecuted ? "executed" : "pending",
      }).select("id").single();

      // Notify director about new pending decision
      if (!autoExecuted) {
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

    // 5. Mark message as processed
    await supabase
      .from("chat_messages")
      .update({ processed: true, language: args.language })
      .eq("id", msg.id);

    return new Response(
      JSON.stringify({
        ok: true,
        intent: args.intent,
        autoExecuted,
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
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
