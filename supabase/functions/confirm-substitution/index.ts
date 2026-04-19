import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { substitution_id, action } = await req.json().catch(() => ({}));
    if (!substitution_id || !action) return new Response(JSON.stringify({ error: "missing fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    if (action === "confirm") {
      const { data: sub } = await supabase.from("substitutions").select("id,slot_id,substitute_staff_id,absence_id").eq("id", substitution_id).maybeSingle();
      if (!sub) return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      // update substitution status
      await supabase.from("substitutions").update({ status: "confirmed" }).eq("id", substitution_id);

      // optionally update schedule_slots teacher_id for that slot
      if (sub.slot_id && sub.substitute_staff_id) {
        await supabase.from("schedule_slots").update({ teacher_id: sub.substitute_staff_id }).eq("id", sub.slot_id);
      }

      // create notification
      await supabase.from("notifications").insert({ type: "substitution", title: "Подтверждена замена", body: `Вам назначена замена (ID:${substitution_id})`, related_entity: "substitution", related_id: substitution_id });

      // notify via Twilio to substitute if phone known
      const { data: staff } = await supabase.from("staff").select("phone,phone_number,full_name").eq("id", sub.substitute_staff_id).maybeSingle();
      const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
      const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
      const TWILIO_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM");
      const phone = staff?.phone || staff?.phone_number || null;
      try {
        // Use centralized Green API sender; it respects SEND_NOTIFICATIONS flag and logs
        const sendUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/greenapi-webhook?action=send`;
        await fetch(sendUrl, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` }, body: JSON.stringify({ chatId: phone, message: `Подтверждена замена: вы ведёте урок. Подробности в дашборде.` }) });
      } catch (e) { console.error("greenapi confirm", e); }

      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "reject") {
      await supabase.from("substitutions").update({ status: "rejected" }).eq("id", substitution_id);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("confirm-sub fatal", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
