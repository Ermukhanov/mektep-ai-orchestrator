import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple smart-substitute: find candidate teacher with same subject and an available flag (improved by daily load check)
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { absent_teacher_full_name, subject, date, period } = await req.json().catch(() => ({}));
    if (!absent_teacher_full_name || !subject || !date || !period) return new Response(JSON.stringify({ error: "missing fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // Simplified: find active teacher that teaches this subject and not absent today
    const { data: candidates } = await supabase.from("staff").select("id,full_name,subjects,phone,phone_number").ilike("subjects", `%${subject}%`).eq("is_active", true).limit(100);

    // map candidates to their current daily assignment count and filter/sort by load (prefer lower load)
    const day_of_week = (new Date(date)).getDay();
    const dowMap: Record<number, string> = {1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat", 0: "mon"};
    const dow = dowMap[day_of_week] || "mon";

    const candLoads: Array<{ cand: any; count: number }> = [];
    for (const c of (candidates || [])) {
      try {
        const slotsRes = await supabase.from("schedule_slots").select("id", { count: "exact" }).eq("day_of_week", dow).eq("teacher_id", c.id).limit(1);
        const slotsCount = (slotsRes && (slotsRes.count || 0)) as number;

        const subsRes = await supabase.from("substitutions").select("id", { count: "exact" }).eq("for_date", date).eq("substitute_staff_id", c.id).eq("status", "confirmed").limit(1);
        const subsCount = (subsRes && (subsRes.count || 0)) as number;

        const tasksRes = await supabase.from("tasks").select("id", { count: "exact" }).eq("assignee_staff_id", c.id).gte("created_at", `${date} 00:00:00`).lte("created_at", `${date} 23:59:59`).limit(1);
        const tasksCount = (tasksRes && (tasksRes.count || 0)) as number;

        const total = slotsCount + subsCount + tasksCount;
        candLoads.push({ cand: c, count: total });
      } catch (e) {
        candLoads.push({ cand: c, count: 0 });
      }
    }

    // prefer candidates with load < 6 and lowest load first
    candLoads.sort((a, b) => a.count - b.count);
    const feasible = candLoads.filter((x) => x.count < 6).slice(0, 10);

    // create an absence record for the absent teacher
    const { data: absentStaff } = await supabase.from("staff").select("id,full_name").ilike("full_name", `%${absent_teacher_full_name}%`).limit(1).maybeSingle();
    const absentId = absentStaff?.id || null;
    const { data: absenceIns, error: absenceErr } = await supabase.from("absences").insert({ staff_id: absentId, staff_name: absent_teacher_full_name, absence_date: date, reason: "sick/absent", source_message_id: null }).select().maybeSingle();
    if (absenceErr) console.error("create absence", absenceErr);

    // find a slot pattern that matches (best-effort)
    const { data: slots } = await supabase.from("schedule_slots").select("id,class_name,period,teacher_id,teacher_raw,room").eq("period", period).limit(50);

    const subsInserted: any[] = [];
    for (const item of feasible) {
      const cand = item.cand;
      // skip if same as absent
      if (cand.full_name === absent_teacher_full_name) continue;

      // insert substitution suggestion (attach to first matching slot as best-effort)
      const { data: subIns, error: subErr } = await supabase.from("substitutions").insert({ slot_id: slots?.[0]?.id || null, absence_id: absenceIns?.id || null, substitute_staff_id: cand.id, status: 'suggested', ai_reasoning: `Candidate selected by subject match (${subject}) with current daily load ${item.count}` }).select().maybeSingle();
      if (subErr) console.error("insert substitution", subErr);
      else subsInserted.push({ candidate: cand, substitution: subIns, load: item.count });

      // create task
      await supabase.from("tasks").insert({ title: `Замена: ${subject} (${date} P${period})`, description: `Просьба заменить ${absent_teacher_full_name}. Период ${period}, класс ${slots?.[0]?.class_name || 'unknown'}`, assignee_staff_id: cand.id, assignee_name: cand.full_name, source: "auto-substitute" });

      // notify via Twilio
      const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
      const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
      const TWILIO_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM");
      const phone = cand.phone || cand.phone_number || null;
      if (TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM && phone) {
        try {
          const to = phone.startsWith("+") ? `whatsapp:${phone}` : `whatsapp:${phone}`;
          const form = new URLSearchParams({ From: TWILIO_FROM, To: to, Body: `Срочная замена: через 15 минут вы ведете урок (${subject}) вместо ${absent_teacher_full_name} (период ${period}). Ответьте "принять" для подтверждения.` });
          await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
            method: "POST",
            headers: { Authorization: `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}` },
            body: form.toString(),
          });
        } catch (e) { console.error("twilio substitute", e); }
      }
    }

    return new Response(JSON.stringify({ ok: true, suggestions: subsInserted }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("smart-substitute fatal", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
