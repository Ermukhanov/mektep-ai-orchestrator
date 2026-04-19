import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const { slot_id, new_period, new_class, new_room, new_teacher_id } = body;
    if (!slot_id || !new_period || !new_class) return new Response(JSON.stringify({ error: "slot_id, new_period and new_class required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const updateObj: any = { period: new_period, class_name: new_class };
    if (new_room) updateObj.room = new_room;
    if (new_teacher_id) updateObj.teacher_id = new_teacher_id;

    const { error } = await supabase.from("schedule_slots").update(updateObj).eq("id", slot_id);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // log action
    await supabase.from("wa_outbound_logs").insert({ chat_id: 'system', message: `slot ${slot_id} moved to ${new_class} period ${new_period}`, skipped: true }).catch(() => null);

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("update-slot fatal", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
