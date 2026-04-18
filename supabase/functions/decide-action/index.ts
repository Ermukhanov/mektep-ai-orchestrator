// Director approves/rejects pending_action.
// On execute: runs the action, posts AI reply to original chat_room,
// creates schedule_overrides for substitutions ("windows" or replacements),
// and SAVES the decision to ai_memory so MEKTEP AI learns.
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

    const { action_id, decision, director_note } = await req.json();
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

    const p = action.payload || {};
    const patternKey = p.pattern_key || `${action.action_type}_generic`;

    // ============ REJECT ============
    if (decision === "reject") {
      await supabase
        .from("pending_actions")
        .update({ status: "rejected", decided_by: user.id, decided_at: new Date().toISOString() })
        .eq("id", action_id);

      // Save rejection to memory so AI doesn't propose the same again
      await supabase.from("ai_memory").insert({
        pattern_type: action.action_type,
        pattern_key: patternKey,
        context: { ai_summary: action.ai_summary, payload: p },
        decision: { rejected: true },
        outcome: "rejected",
        director_note: director_note || null,
      });

      return new Response(JSON.stringify({ ok: true, status: "rejected" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ APPROVE / EXECUTE ============
    let result: Record<string, unknown> = {};

    try {
      if (action.action_type === "mark_teacher_absent") {
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

        const subsCreated: any[] = [];
        const overridesCreated: any[] = [];

        if (staff?.id) {
          const dayName = new Date(absDate)
            .toLocaleDateString("en-US", { weekday: "short" })
            .toLowerCase()
            .slice(0, 3);

          const { data: slots } = await supabase
            .from("schedule_slots")
            .select("*")
            .eq("teacher_id", staff.id)
            .eq("day_of_week", dayName);

          for (const slot of slots || []) {
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

            const subjMatch = (candidates || []).find(
              (c) =>
                !busyIds.has(c.id) &&
                c.subjects?.some((s: string) =>
                  slot.subject_norm?.includes(s.toLowerCase()),
                ),
            );
            const anyFree = (candidates || []).find((c) => !busyIds.has(c.id));
            const sub = subjMatch || anyFree;

            if (sub) {
              const { data: subRow } = await supabase
                .from("substitutions")
                .insert({
                  slot_id: slot.id,
                  absence_id: absence?.id,
                  substitute_staff_id: sub.id,
                  for_date: absDate,
                  status: "approved",
                  ai_reasoning: `Free at period ${slot.period}; subject match: ${
                    subjMatch ? "yes" : "no — fallback to any free teacher"
                  }`,
                })
                .select()
                .single();
              subsCreated.push(subRow);

              // Create schedule override so the live timetable shows the change
              const { data: ov } = await supabase
                .from("schedule_overrides")
                .insert({
                  slot_id: slot.id,
                  override_date: absDate,
                  override_type: "teacher_change",
                  new_teacher_id: sub.id,
                  note: `Замена: ${staff.full_name} → ${sub.full_name}`,
                  created_by: user.id,
                  ai_generated: true,
                  related_substitution_id: subRow?.id,
                })
                .select()
                .single();
              overridesCreated.push(ov);
            } else {
              // No substitute available → mark as free period ("окно")
              const { data: ov } = await supabase
                .from("schedule_overrides")
                .insert({
                  slot_id: slot.id,
                  override_date: absDate,
                  override_type: "free_period",
                  note: `Окно: ${staff.full_name} отсутствует, замена не найдена`,
                  created_by: user.id,
                  ai_generated: true,
                })
                .select()
                .single();
              overridesCreated.push(ov);
            }
          }
        }
        result = {
          absence_id: absence?.id,
          substitutions: subsCreated.length,
          overrides: overridesCreated.length,
        };
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
          title: "Новый инцидент",
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
      }

      // Post confirmation reply to the same chat_room
      if (action.ai_summary) {
        const { data: srcMsg } = action.source_message_id
          ? await supabase.from("chat_messages").select("chat_room").eq("id", action.source_message_id).maybeSingle()
          : { data: null };
        await supabase.from("chat_messages").insert({
          text: `✓ ${action.ai_summary} — одобрено директором.`,
          sender_name: "MEKTEP AI",
          source: "ai",
          chat_room: srcMsg?.chat_room || p.chat_room || "general",
          processed: true,
          language: p.language || null,
          metadata: { confirmation: true },
        });
      }

      // SAVE TO AI MEMORY ✨
      const { data: existingMem } = await supabase
        .from("ai_memory")
        .select("id, usage_count")
        .eq("pattern_key", patternKey)
        .eq("outcome", "approved")
        .maybeSingle();
      if (existingMem) {
        await supabase
          .from("ai_memory")
          .update({
            usage_count: (existingMem.usage_count || 1) + 1,
            last_used_at: new Date().toISOString(),
            director_note: director_note || undefined,
          })
          .eq("id", existingMem.id);
      } else {
        await supabase.from("ai_memory").insert({
          pattern_type: action.action_type,
          pattern_key: patternKey,
          context: { ai_summary: action.ai_summary, payload: p },
          decision: { approved: true, result },
          outcome: "approved",
          director_note: director_note || null,
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
