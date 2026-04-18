// Director approves or rejects a pending_action; we then execute it,
// post the AI reply back to chat (in original language), and notify everyone.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response("unauth", { status: 401, headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );

    // Identify caller
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response("unauth", { status: 401, headers: corsHeaders });

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "director")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "director only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action_id, decision } = await req.json();
    if (!action_id || !["approve", "reject"].includes(decision)) {
      return new Response(JSON.stringify({ error: "bad input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: action } = await supabase
      .from("pending_actions")
      .select("*")
      .eq("id", action_id)
      .single();
    if (!action) return new Response("not found", { status: 404, headers: corsHeaders });

    if (decision === "reject") {
      await supabase
        .from("pending_actions")
        .update({ status: "rejected", decided_by: user.id, decided_at: new Date().toISOString() })
        .eq("id", action_id);
      return new Response(JSON.stringify({ ok: true, status: "rejected" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const p = action.payload || {};
    let result: Record<string, unknown> = {};

    try {
      if (action.action_type === "mark_teacher_absent") {
        // 1) find staff
        const { data: staff } = await supabase
          .from("staff")
          .select("id, full_name")
          .ilike("full_name", `%${p.staff_name || ""}%`)
          .limit(1)
          .maybeSingle();

        const absDate = p.absence_date || new Date().toISOString().slice(0, 10);
        const { data: absence } = await supabase
          .from("absences")
          .insert({
            staff_id: staff?.id || null,
            staff_name: p.staff_name || action.ai_summary || "Unknown",
            reason: p.absence_reason || null,
            absence_date: absDate,
            source_message_id: action.source_message_id,
          })
          .select()
          .single();

        // 2) find that day's slots & propose substitutes
        if (staff?.id) {
          const dayName = new Date(absDate).toLocaleDateString("en-US", { weekday: "short" }).toLowerCase().slice(0, 3);
          const { data: slots } = await supabase
            .from("schedule_slots")
            .select("*")
            .eq("teacher_id", staff.id)
            .eq("day_of_week", dayName);

          for (const slot of slots || []) {
            // find a free same-subject teacher
            const { data: busy } = await supabase
              .from("schedule_slots")
              .select("teacher_id")
              .eq("day_of_week", dayName)
              .eq("period", slot.period);
            const busyIds = new Set((busy || []).map((b) => b.teacher_id).filter(Boolean));
            const { data: candidates } = await supabase
              .from("staff")
              .select("id, full_name, subjects")
              .neq("id", staff.id)
              .eq("is_active", true);
            const sub = (candidates || []).find(
              (c) =>
                !busyIds.has(c.id) &&
                c.subjects?.some((s: string) => slot.subject_norm?.includes(s.toLowerCase())),
            ) || (candidates || []).find((c) => !busyIds.has(c.id));
            if (sub) {
              await supabase.from("substitutions").insert({
                slot_id: slot.id,
                absence_id: absence?.id,
                substitute_staff_id: sub.id,
                for_date: absDate,
                status: "suggested",
                ai_reasoning: `Free at period ${slot.period}; subject match: ${
                  sub.subjects?.some((x: string) => slot.subject_norm?.includes(x.toLowerCase())) ? "yes" : "no"
                }`,
              });
            }
          }
        }
        result = { absence_id: absence?.id };
      } else if (action.action_type === "create_incident") {
        const { data: inc } = await supabase
          .from("incidents")
          .insert({
            title: p.incident_title || "Incident",
            description: p.incident_description,
            location: p.incident_location,
            severity: p.incident_severity || "medium",
            source_message_id: action.source_message_id,
          })
          .select()
          .single();
        result = { incident_id: inc?.id };
        await supabase.from("notifications").insert({
          type: "incident",
          title: "New incident",
          body: p.incident_title,
          recipient_role: "director",
          related_entity: "incidents",
          related_id: inc?.id,
        });
      } else if (action.action_type === "create_task") {
        const { data: assignee } = p.task_assignee_name
          ? await supabase
              .from("staff")
              .select("id, full_name")
              .ilike("full_name", `%${p.task_assignee_name}%`)
              .maybeSingle()
          : { data: null };
        const { data: task } = await supabase
          .from("tasks")
          .select()
          .limit(0); // noop
        const { data: created } = await supabase
          .from("tasks")
          .insert({
            title: p.task_title || "Task",
            description: p.task_description,
            assignee_staff_id: assignee?.id || null,
            assignee_name: assignee?.full_name || p.task_assignee_name || null,
            source: "ai_chat",
            created_by: user.id,
          })
          .select()
          .single();
        result = { task_id: created?.id };
      } else if (action.action_type === "send_chat_reply" || action.action_type === "log_attendance") {
        // nothing extra to do; reply is handled below
      }

      // Post AI reply back to the chat in user's language (already in ai_summary)
      if (action.ai_summary) {
        await supabase.from("chat_messages").insert({
          text: action.ai_summary,
          sender_name: "MEKTEP AI",
          sender_user_id: user.id, // bypass RLS check (director)
          source: "ai",
          processed: true,
          language: p.language || null,
        });
      }

      await supabase
        .from("pending_actions")
        .update({
          status: "executed",
          decided_by: user.id,
          decided_at: new Date().toISOString(),
          result,
        })
        .eq("id", action_id);

      return new Response(JSON.stringify({ ok: true, status: "executed", result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (execErr) {
      console.error("exec error", execErr);
      await supabase
        .from("pending_actions")
        .update({
          status: "failed",
          decided_by: user.id,
          decided_at: new Date().toISOString(),
          result: { error: String(execErr) },
        })
        .eq("id", action_id);
      return new Response(
        JSON.stringify({ error: String(execErr) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  } catch (e) {
    console.error("decide-action fatal", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
