// MEKTEP AI — Smart Schedule Generator
// Reads teaching_load + rooms + periods + active staff,
// asks Lovable AI (gemini-2.5-pro) to produce a conflict-free day schedule
// in ~10s, persists it to generated_schedules and returns the grid.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DAYS_KZ = ["дүйсенбі", "сейсенбі", "сәрсенбі", "бейсенбі", "жұма"];
const DAYS_RU = ["понедельник", "вторник", "среда", "четверг", "пятница"];
const DAYS_EN = ["mon", "tue", "wed", "thu", "fri"];

function detectDay(text: string): string {
  const t = text.toLowerCase();
  for (let i = 0; i < 5; i++) {
    if (t.includes(DAYS_KZ[i]) || t.includes(DAYS_RU[i]) || t.includes(DAYS_EN[i])) {
      return DAYS_EN[i];
    }
  }
  return DAYS_EN[new Date().getDay() === 0 ? 0 : Math.min(new Date().getDay() - 1, 4)];
}

const SYSTEM = `Ты — генератор школьного расписания MEKTEP AI.
Твоя задача: построить расписание на ОДИН день для всех 13 классов гимназии «Ақбөбек», без конфликтов:
• Один кабинет — один класс в один период
• Один учитель — один урок в один период
• Не превышай дневную норму учителя (макс 6 уроков/день)
• Используй только реально доступную нагрузку (teaching_load)
• Распределяй сложные предметы (математика, физика, химия) на 1–4 уроки
• ИЗО, физкультура, технология — позже
• У каждого класса 5–7 уроков, начинаются с 1-го периода без окон

Возвращай ТОЛЬКО tool call build_schedule.`;

function tools() {
  return [
    {
      type: "function",
      function: {
        name: "build_schedule",
        description: "Build a conflict-free day schedule.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            day_of_week: { type: "string", enum: DAYS_EN },
            slots: {
              type: "array",
              description: "All scheduled lessons for the day",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  class_name: { type: "string" },
                  period: { type: "number" },
                  subject: { type: "string" },
                  teacher: { type: "string" },
                  room: { type: "string" },
                },
                required: ["class_name", "period", "subject", "teacher", "room"],
              },
            },
            conflicts: {
              type: "array",
              items: { type: "string" },
              description: "Detected unavoidable conflicts (should be empty)",
            },
            ai_notes: { type: "string" },
          },
          required: ["day_of_week", "slots", "conflicts", "ai_notes"],
        },
      },
    },
  ];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const prompt: string = body.prompt || "Сгенерируй расписание на завтра";
    const day = body.day_of_week || detectDay(prompt);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [{ data: load }, { data: rooms }, { data: periods }, { data: staff }, { data: classes }] =
      await Promise.all([
        supabase.from("teaching_load").select("teacher_name, class_name, subject, hours_per_week"),
        supabase.from("rooms").select("number, capacity, home_class, subject"),
        supabase.from("school_periods").select("period_number, time_label").order("period_number"),
        supabase.from("staff").select("full_name, subjects").eq("is_active", true),
        supabase.from("classes").select("name, student_count").order("name"),
      ]);

    if (!load?.length) {
      return new Response(JSON.stringify({ error: "no teaching load found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPrompt = `Запрос директора: "${prompt}"
День: ${day}

═══ Классы (${classes?.length}) ═══
${classes?.map((c) => `${c.name} — ${c.student_count} учеников`).join("\n")}

═══ Кабинеты (${rooms?.length}) ═══
${rooms?.map((r) => `№${r.number} (вмест.${r.capacity || "?"})${r.home_class ? ` дом.${r.home_class}` : ""}${r.subject ? ` спец:${r.subject}` : ""}`).join("\n")}

═══ Уроки/Периоды ═══
${periods?.map((p) => `${p.period_number}. ${p.time_label}`).join("\n")}

═══ Доступная нагрузка (teacher × class × subject × часов/неделю) ═══
${load.map((l) => `${l.teacher_name} → ${l.class_name} ${l.subject} (${l.hours_per_week}ч/нед)`).join("\n")}

ЗАДАЧА: построй расписание на день ${day}. Каждый класс получает 5–7 уроков с 1-го периода. Без конфликтов кабинет/учитель в одном периоде. Используй только пары teacher+class+subject из нагрузки выше. Дай для каждого слота: class_name, period (1–7), subject, teacher (полное имя), room (номер).`;

    const t0 = Date.now();
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userPrompt },
        ],
        tools: tools(),
        tool_choice: { type: "function", function: { name: "build_schedule" } },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("AI error", aiRes.status, txt);
      if (aiRes.status === 429 || aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "AI quota / rate limit" }), {
          status: aiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI error", detail: txt }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiRes.json();
    const call = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) {
      return new Response(JSON.stringify({ error: "no tool call", aiJson }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const args = JSON.parse(call.function.arguments);
    const elapsedMs = Date.now() - t0;

    // Build grid: { period: { class_name: slot } }
    const grid: Record<string, Record<string, any>> = {};
    for (const s of args.slots || []) {
      const p = String(s.period);
      if (!grid[p]) grid[p] = {};
      grid[p][s.class_name] = s;
    }

    // Conflict re-check on server side
    const conflicts: string[] = [...(args.conflicts || [])];
    for (const p of Object.keys(grid)) {
      const seenRoom = new Map<string, string>();
      const seenTeacher = new Map<string, string>();
      for (const cn of Object.keys(grid[p])) {
        const s = grid[p][cn];
        if (s.room && seenRoom.has(s.room)) {
          conflicts.push(`Период ${p}: кабинет ${s.room} занят дважды (${seenRoom.get(s.room)} и ${cn})`);
        } else if (s.room) seenRoom.set(s.room, cn);
        if (s.teacher && seenTeacher.has(s.teacher)) {
          conflicts.push(`Период ${p}: учитель ${s.teacher} ведёт два класса (${seenTeacher.get(s.teacher)} и ${cn})`);
        } else if (s.teacher) seenTeacher.set(s.teacher, cn);
      }
    }

    const { data: saved } = await supabase
      .from("generated_schedules")
      .insert({
        day_of_week: args.day_of_week || day,
        for_date: new Date().toISOString().slice(0, 10),
        grid: { periods: grid, slots: args.slots, periodsMeta: periods },
        conflicts,
        ai_notes: `${args.ai_notes || ""}\n\n⏱ Сгенерировано за ${(elapsedMs / 1000).toFixed(1)}с`,
      })
      .select("id")
      .single();

    return new Response(
      JSON.stringify({
        ok: true,
        id: saved?.id,
        day_of_week: args.day_of_week || day,
        elapsedMs,
        slots: args.slots,
        conflicts,
        ai_notes: args.ai_notes,
        periods,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-schedule fatal", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
