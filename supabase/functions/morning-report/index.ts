import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Today midnight
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    // Collect WhatsApp chat messages since midnight
    const { data: msgs } = await supabase
      .from("chat_messages")
      .select("id, text, metadata, created_at, sender_name, chat_room, source")
      .gte("created_at", start)
      .order("created_at", { ascending: true });

    // Parse cafeteria reports
    const perClass: Record<string, { present: number; sick: number }> = {};
    let total = 0;
    let totalSick = 0;

    for (const m of msgs || []) {
      try {
        if (m.metadata?.type === "cafeteria_report" && Array.isArray(m.metadata?.details)) {
          for (const p of m.metadata.details) {
            const cn = p.class_name || "unknown";
            perClass[cn] = perClass[cn] || { present: 0, sick: 0 };
            perClass[cn].present += Number(p.present || 0);
            perClass[cn].sick += Number(p.sick || 0);
            total += Number(p.present || 0);
            totalSick += Number(p.sick || 0);
          }
          continue;
        }

        // Fallback parse: find patterns like "1А - 25 детей, 2 болеют"
        const classEntryRe = /([0-9]{1,2}[A-Za-zА-Яа-яЁё]?)[\s-–:—]*?(\d+)\s*(?:дет|учен|учени)/gi;
        let m2: RegExpExecArray | null;
        while ((m2 = classEntryRe.exec(m.text || "") )) {
          const cls = m2[1];
          const cnt = Number(m2[2] || 0);
          const after = (m.text || "").slice(m2.index, Math.min((m.text || "").length, m2.index + 140));
          const sickMatch = after.match(/(\d+)\s*(?:боле|отсутств|нет)/i);
          const sick = sickMatch ? Number(sickMatch[1]) : 0;
          perClass[cls] = perClass[cls] || { present: 0, sick: 0 };
          perClass[cls].present += cnt;
          perClass[cls].sick += sick;
          total += cnt;
          totalSick += sick;
        }
      } catch (e) { console.error('parse msg', e); }
    }

    // Build CSV
    const rows = Object.keys(perClass).map((k) => `${k},${perClass[k].present},${perClass[k].sick}`);
    const csv = ["class,present,sick", ...rows, `total,${total},${totalSick}`].join("\n");

    // Insert system message for director
    await supabase.from("chat_messages").insert({
      text: `Ежедневный отчёт столовой: Всего порций: ${total}. Отсутствуют: ${totalSick}.`,
      sender_name: "system",
      source: "system",
      chat_room: "reports-cafeteria",
      metadata: { type: "cafeteria_report", details: Object.keys(perClass).map(k => ({ class_name: k, present: perClass[k].present, sick: perClass[k].sick })) },
    }).catch(() => null);

    // Incident detection: find messages mentioning поломка/слом* etc.
    const incidentRe = /(слом(а|о|ал|алась|ался)|не работает|поломк|пробил|пробита|утечка|прорв|запах газа)/i;
    const incidents: any[] = [];
    for (const m of msgs || []) {
      if (m.text && incidentRe.test(m.text)) {
        const title = `Инцидент: ${((m.text || "").slice(0, 80))}`;
        const description = m.text;
        // find zavhoz
        const { data: possible } = await supabase.from("staff").select("id,full_name,position").ilike("position", "%зав%").limit(1).maybeSingle();
        const assignee = possible || null;
        const insert = await supabase.from("tasks").insert({
          title,
          description,
          assignee_staff_id: assignee?.id || null,
          assignee_name: assignee?.full_name || "Завхоз",
          source: "chat",
          created_by: null,
        }).select().maybeSingle();
        incidents.push({ message_id: m.id, task: insert.data || null });
      }
    }

    return new Response(JSON.stringify({ ok: true, csv, total, totalSick, incidents }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("morning-report fatal", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
