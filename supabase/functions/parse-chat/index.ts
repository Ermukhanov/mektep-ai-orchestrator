// MEKTEP AI — Ultra-Fast Schedule Generator v2
// Uses parallel tool calls + pre-built constraint model
// Target: < 10 seconds generation with lens (stream) support
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAlem } from "../_shared/llm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAYS_EN = ["mon", "tue", "wed", "thu", "fri"];
const DAYS_RU = ["понедельник", "вторник", "среда", "четверг", "пятница"];
const DAYS_KZ = ["дүйсенбі", "сейсенбі", "сәрсенбі", "бейсенбі", "жұма"];

function detectDay(text: string): string {
  const t = text.toLowerCase();
  for (let i = 0; i < 5; i++) {
    if (t.includes(DAYS_KZ[i]) || t.includes(DAYS_RU[i]) || t.includes(DAYS_EN[i])) return DAYS_EN[i];
  }
  const d = new Date().getDay();
  return DAYS_EN[Math.max(0, Math.min(4, d === 0 ? 0 : d - 1))];
}

// Compact system prompt optimized for speed
const SYSTEM = `You are MEKTEP AI schedule generator. Build a COMPLETE school timetable in ONE response.

RULES (strictly enforce):
1. No teacher in 2+ classes simultaneously  
2. No room used by 2+ classes simultaneously
3. Each class gets 5-7 lessons starting from period 1, no gaps
4. Hard subjects (math, physics, chemistry) → periods 1-4
5. PE, art → periods 5-7
6. Max 6 lessons/teacher/day

LENS SYSTEM (critical feature):
- When classes share a parallel (same grade, e.g. 7A+7B+7C), they can have "lens" slots
- In a lens slot, all parallel classes are free at the SAME period
- Students from parallel classes regroup into level-based groups (Beginner/Intermediate/Advanced)
- Mark lens slots with is_lens:true, lens_group: "english_7" etc.
- Assign different teachers to each lens group in same period

Return ONLY the build_schedule tool call. Be fast and complete.`;

function buildTools() {
  return [{
    type: "function",
    function: {
      name: "build_schedule",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          day_of_week: { type: "string", enum: DAYS_EN },
          slots: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                // Lightweight on-device NLP to detect cafeteria reports and facility incidents
                try {
                  const text = userPrompt || "";

                  // Cafeteria report parsing: matches patterns like "1А - 25 детей, 2 болеют"
                  const classEntryRe = /([0-9]{1,2}[A-Za-zА-Яа-яЁё]?)[\s-–:—]*?(\d+)\s*(?:дет|учен|учени)/gi;
                  const sickRe = /(\d+)\s*(?:боле|отсутств)/i;
                  let m: RegExpExecArray | null;
                  const perClass: Array<{ class_name: string; present: number; sick?: number }> = [];
                  while ((m = classEntryRe.exec(text))) {
                    const cls = m[1];
                    const cnt = Number(m[2] || 0);
                    // try to find sick count near this match (simple heuristic)
                    const after = text.slice(m.index, Math.min(text.length, m.index + 80));
                    const sick = (sickRe.exec(after) && Number(sickRe.exec(after)![1])) || undefined;
                    perClass.push({ class_name: cls, present: cnt, sick });
                  }

                  if (perClass.length) {
                    const total = perClass.reduce((s, p) => s + p.present, 0);
                    const totalSick = perClass.reduce((s, p) => s + (p.sick || 0), 0);
                    const reportText = `Столовая: Всего порций: ${total}. Отсутствуют: ${totalSick}. Подробно: ${perClass
                      .map((p) => `${p.class_name}:${p.present}${p.sick ? ` (болеют ${p.sick})` : ""}`)
                      .join(", ")}`;

                    // Insert system message with report for director and kitchen
                    await supabase.from("chat_messages").insert({
                      text: reportText,
                      sender_name: "system",
                      source: "system",
                      chat_room: "reports-cafeteria",
                      metadata: { type: "cafeteria_report", details: perClass },
                    });
                    // (Optional) send to Twilio kitchen number if configured
                    const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
                    const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
                    const KITCHEN_TO = Deno.env.get("KITCHEN_WHATSAPP_TO");
                    const TWILIO_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM");
                    if (TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM && KITCHEN_TO) {
                      const form = new URLSearchParams({ From: TWILIO_FROM, To: KITCHEN_TO, Body: reportText });
                      fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
                        method: "POST",
                        headers: { Authorization: `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}` },
                        body: form.toString(),
                      }).catch((e) => console.error("twilio kitchen send", e));
                    }
                  }

                  // Incident detection: look for keywords indicating broken furniture/equipment
                  const incidentRe = /(слом\?\w+|не работает|поломк\w+|сломалась|сломался|сломан\w+|провал|пробил|пробита)/i;
                  if (incidentRe.test(userPrompt)) {
                    const title = `Инцидент: ${inserted?.text?.slice(0, 120)}`;
                    const description = inserted?.text || userPrompt;
                    // Try to find zavhoz/maintenance staff
                    const { data: possible } = await supabase.from("staff").select("id,full_name,position,phone,phone_number").ilike("position", "%зав%").limit(1);
                    const assignee = possible?.[0];
                    const insertRes = await supabase.from("tasks").insert({
                      title,
                      description,
                      assignee_staff_id: assignee?.id || null,
                      assignee_name: assignee?.full_name || "Завхоз",
                      source: "chat",
                      created_by: null,
                    }).select().maybeSingle();
                    if (insertRes.error) console.error("task create", insertRes.error);

                    // Send WhatsApp notification to assignee if configured and enabled
                    const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
                    const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
                    const TWILIO_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM");
                    const phone = assignee?.phone || assignee?.phone_number || null;
                    // By default send notifications. Set SEND_NOTIFICATIONS="0" to disable during testing.
                    const sendNotifications = Deno.env.get("SEND_NOTIFICATIONS") !== "0";
                    if (sendNotifications && TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM && phone) {
                      try {
                        const to = phone.startsWith("+") ? `whatsapp:${phone}` : `whatsapp:${phone}`;
                        const form = new URLSearchParams({ From: TWILIO_FROM, To: to, Body: `Новая задача: ${title}\n${description}` });
                        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
                          method: "POST",
                          headers: { Authorization: `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}` },
                          body: form.toString(),
                        });
                      } catch (e) {
                        console.error("twilio notify assignee", e);
                      }
                    } else {
                      console.info("Notifications skipped for parse-chat (SEND_NOTIFICATIONS!=1)");
                    }
                  }
                } catch (e) {
                  console.error("local parse error", e);
                }

                const t0 = Date.now();
                const aiJson = await callAlem('/v1/chat/completions', {
                  model: "gpt-4o-mini",
                  messages: [
                    { role: "system", content: SYSTEM },
                    { role: "user", content: userPrompt },
                  ],
                  tools: buildTools(),
                  tool_choice: { type: "tool", name: "build_schedule" },
                });

                const elapsedMs = Date.now() - t0;

                const toolUse = aiJson.content?.find((c: any) => c.type === "tool_use") || aiJson.choices?.[0]?.message?.tool_calls?.[0];
                if (!toolUse) {
                  return new Response(JSON.stringify({ error: "No tool call in response", aiJson }), {
                    status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
                  });
                }

                const args = toolUse.input || JSON.parse(toolUse.function?.arguments || '{}');
                return await saveAndRespond(supabase, args, day, periods, elapsedMs, corsHeaders);
  const parallelMap = new Map<string, string[]>();
  for (const c of classes || []) {
    const grade = c.name.replace(/[A-Za-zА-Яа-яЁё]/g, "");
    if (!parallelMap.has(grade)) parallelMap.set(grade, []);
    parallelMap.get(grade)!.push(c.name);
  }
  const lensParallels = Array.from(parallelMap.entries())
    .filter(([, cls]) => cls.length >= 2)
    .map(([grade, cls]) => `Grade${grade}:[${cls.join(",")}]`)
    .join("; ");

  return `CLASSES: ${classNames}
PERIODS: ${periodStr}
ROOMS: ${roomStr}
TEACHING LOAD:\n${teacherStr}
LENS PARALLELS (same-grade classes that CAN share a streaming block): ${lensParallels}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const prompt: string = body.prompt || "Generate tomorrow's schedule";
    const day = body.day_of_week || detectDay(prompt);
    const enableLens = body.enable_lens !== false; // default true

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Parallel data fetch for speed
    const [{ data: load }, { data: rooms }, { data: periods }, { data: staff }, { data: classes }] =
      await Promise.all([
        supabase.from("teaching_load").select("teacher_name,class_name,subject,hours_per_week"),
        supabase.from("rooms").select("number,capacity,home_class,subject").limit(30),
        supabase.from("school_periods").select("period_number,time_label").order("period_number"),
        supabase.from("staff").select("full_name,subjects").eq("is_active", true).limit(50),
        supabase.from("classes").select("name,student_count").order("name"),
      ]);

    if (!load?.length) {
      // Fallback: use static data from slots if teaching_load is empty
      const { data: slots } = await supabase
        .from("schedule_slots")
        .select("class_name,teacher_raw,subject_raw,room")
        .limit(200);

      if (!slots?.length) {
        return new Response(JSON.stringify({ error: "No teaching data found. Please seed teaching_load table." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const constraints = buildConstraintString(load || [], rooms || [], periods || [], staff || [], classes || []);

    const userPrompt = `REQUEST: "${prompt}"
DAY: ${day}
LENS SYSTEM: ${enableLens ? "ENABLED - create streaming blocks where beneficial" : "DISABLED"}

${constraints}

Generate a COMPLETE, CONFLICT-FREE schedule for ALL classes listed above.
Each class needs 5-7 lessons. Use ONLY teacher+class+subject combinations from TEACHING LOAD.
${enableLens ? `Create 1-2 lens blocks for English or Math where parallel classes exist.` : ""}
Be precise and fast.`;

    const t0 = Date.now();
    let aiJson: any;
    try {
      // Prefer ALEM as primary LLM
      aiJson = await callAlem('/v1/chat/completions', {
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userPrompt },
        ],
        tools: [{ type: "function", function: buildTools()[0].function }],
        tool_choice: { type: "function", function: { name: "build_schedule" } },
      });
    } catch (alemErr) {
      // ALEM failed or not configured — fallback to Anthropic if available
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") || "",
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-5",
            max_tokens: 8000,
            system: SYSTEM,
            messages: [{ role: "user", content: userPrompt }],
            tools: buildTools(),
            tool_choice: { type: "tool", name: "build_schedule" },
          }),
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          console.error('Anthropic fallback failed', res.status, txt, alemErr);
          return new Response(JSON.stringify({ error: 'AI unavailable', detail: txt }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        aiJson = await res.json();
      } catch (anthErr) {
        console.error('Both ALEM and Anthropic failed', alemErr, anthErr);
        return new Response(JSON.stringify({ error: 'AI unavailable' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const elapsedMs = Date.now() - t0;
    const toolUse = aiJson.content?.find((c: any) => c.type === "tool_use") || aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolUse) return new Response(JSON.stringify({ error: "No tool call in response", aiJson }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const args = toolUse.input || JSON.parse(toolUse.function?.arguments || '{}');
    return await saveAndRespond(supabase, args, day, periods, elapsedMs, corsHeaders);

  } catch (e) {
    console.error("generate-schedule fatal", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function saveAndRespond(
  supabase: any, args: any, day: string, periods: any[], elapsedMs: number, corsHeaders: any
) {
  const slots = args.slots || [];
  const conflicts: string[] = [...(args.conflicts || [])];

  // Server-side conflict validation
  const byPeriod = new Map<number, { rooms: Map<string, string>; teachers: Map<string, string> }>();
  for (const s of slots) {
    if (!byPeriod.has(s.period)) {
      byPeriod.set(s.period, { rooms: new Map(), teachers: new Map() });
    }
    const p = byPeriod.get(s.period)!;
    if (s.room && !s.is_lens) {
      if (p.rooms.has(s.room)) {
        conflicts.push(`P${s.period}: Room ${s.room} conflict (${p.rooms.get(s.room)} & ${s.class_name})`);
      } else p.rooms.set(s.room, s.class_name);
    }
    if (s.teacher && !s.is_lens) {
      if (p.teachers.has(s.teacher)) {
        conflicts.push(`P${s.period}: Teacher ${s.teacher} double-booked (${p.teachers.get(s.teacher)} & ${s.class_name})`);
      } else p.teachers.set(s.teacher, s.class_name);
    }
  }

  const notes = `${args.ai_notes || ""}\n⏱ Generated in ${(elapsedMs / 1000).toFixed(1)}s | ${slots.length} lessons | ${conflicts.length} conflicts`;

  const { data: saved } = await supabase
    .from("generated_schedules")
    .insert({
      day_of_week: args.day_of_week || day,
      for_date: new Date().toISOString().slice(0, 10),
      grid: { slots, periods_meta: periods, lens_blocks: args.lens_blocks || [] },
      conflicts,
      ai_notes: notes,
    })
    .select("id")
    .single();

  return new Response(
    JSON.stringify({
      ok: true,
      id: saved?.id,
      day_of_week: args.day_of_week || day,
      elapsedMs,
      slots,
      lens_blocks: args.lens_blocks || [],
      conflicts,
      ai_notes: notes,
      periods,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
