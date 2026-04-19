import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function dateToDayOfWeek(d: string) {
  const dt = new Date(d);
  const dow = dt.getDay(); // 0 Sun ... 6 Sat
  const map: Record<number, string> = { 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat", 0: "mon" };
  return map[dow] || "mon";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const { absence_id, date, period } = body;
    if (!absence_id && !(date && period)) {
      return new Response(JSON.stringify({ error: "missing absence_id or date+period" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: absence } = await supabase.from("absences").select("id,staff_id,staff_name,absence_date").eq("id", absence_id).maybeSingle();
    const targetDate = (absence?.absence_date && absence.absence_date) || date;
    const day_of_week = dateToDayOfWeek(targetDate);

    // find affected slots
    const { data: slots } = await supabase.from("schedule_slots").select("id,class_name,period,subject_raw,subject_norm,teacher_id,teacher_raw,room").eq("day_of_week", day_of_week).eq("period", period).limit(100);

    const results: any[] = [];

    for (const slot of (slots || [])) {
      // check if slot is assigned to absent teacher
      if (absence?.staff_id && slot.teacher_id !== absence.staff_id && !(slot.teacher_raw && slot.teacher_raw.includes(absence.staff_name))) continue;

      // attempt to find candidate teachers for slot
      const subj = (slot.subject_norm || slot.subject_raw || "").split(/\s|\//)[0];
      const { data: candidates } = await supabase.from("staff").select("id,full_name,subjects,phone,phone_number").eq("is_active", true).ilike("subjects", `%${subj}%`).limit(50);

      // compute daily load for candidates and sort by least loaded (include confirmed substitutions and tasks)
      const candLoads: Array<{ cand: any; count: number }> = [];
      await Promise.all((candidates || []).map(async (c: any) => {
        try {
          const slotsRes = await supabase.from("schedule_slots").select("id", { count: "exact" }).eq("day_of_week", day_of_week).eq("teacher_id", c.id).limit(1);
          const slotsCount = (slotsRes && (slotsRes.count || 0)) as number;

          const subsRes = await supabase.from("substitutions").select("id", { count: "exact" }).eq("for_date", targetDate).eq("substitute_staff_id", c.id).eq("status", "confirmed").limit(1);
          const subsCount = (subsRes && (subsRes.count || 0)) as number;

          const tasksRes = await supabase.from("tasks").select("id", { count: "exact" }).eq("assignee_staff_id", c.id).gte("created_at", `${targetDate} 00:00:00`).lte("created_at", `${targetDate} 23:59:59`).limit(1);
          const tasksCount = (tasksRes && (tasksRes.count || 0)) as number;

          const total = slotsCount + subsCount + tasksCount;
          candLoads.push({ cand: c, count: total });
        } catch (e) {
          candLoads.push({ cand: c, count: 0 });
        }
      }));
      candLoads.sort((a, b) => a.count - b.count);

      let assigned = null;
      for (const entry of candLoads) {
        const cand = entry.cand;
        // skip overloaded teachers
        if ((entry.count || 0) >= 6) continue;
        // check if candidate is free in same period/day
        const { data: busy } = await supabase.from("schedule_slots").select("id").eq("day_of_week", day_of_week).eq("period", slot.period).eq("teacher_id", cand.id).limit(1);
        if (busy && busy.length) continue; // busy

        // assign candidate
        await supabase.from("schedule_slots").update({ teacher_id: cand.id }).eq("id", slot.id);
        const { data: subIns } = await supabase.from("substitutions").insert({ slot_id: slot.id, absence_id: absence?.id || null, substitute_staff_id: cand.id, status: 'confirmed', ai_reasoning: 'Auto-assigned by quick-reschedule', for_date: targetDate }).select().maybeSingle();
        // create task/notification
        await supabase.from("tasks").insert({ title: `Замена подтверждена: ${slot.subject_raw} ${slot.class_name}`, description: `Вы назначены на замену вместо ${absence?.staff_name || 'unknown'}`, assignee_staff_id: cand.id, assignee_name: cand.full_name, source: 'auto-reschedule' });
        await supabase.from("notifications").insert({ type: 'substitution', title: 'Подтверждена замена', body: `Вам назначена замена в ${slot.class_name}, период ${slot.period}`, related_entity: 'substitution', related_id: subIns?.id });

        // notify via Twilio
        const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
        const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
        const TWILIO_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM");
        const phone = cand.phone || cand.phone_number || null;
        // Notify via Green API webhook (centralized sender)
        try {
          const sendUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/greenapi-webhook?action=send`;
          await fetch(sendUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` }, body: JSON.stringify({ chatId: phone, message: `Вам назначена замена: ${slot.subject_raw} класс ${slot.class_name}, период ${slot.period}.` }) });
        } catch (e) {
          console.error('greenapi quick-res', e);
        }

        assigned = { candidate: cand, substitution: subIns, slot };
        results.push(assigned);
        break;
      }

      if (!assigned) {
        results.push({ slot, assigned: null, reason: 'no available candidate' });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('quick-res fatal', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
