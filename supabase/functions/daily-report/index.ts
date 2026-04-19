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

    // Get cafeteria reports inserted as system messages
    const { data: reports } = await supabase
      .from("chat_messages")
      .select("id, text, metadata, created_at")
      .gte("created_at", start)
      .or("metadata->>type.eq.cafeteria_report,text.ilike.%порци%")
      .order("created_at", { ascending: true });

    const perClass: Record<string, { present: number; sick: number }> = {};
    let total = 0;
    let totalSick = 0;

    for (const r of reports || []) {
      const details = r.metadata?.details || [];
      if (Array.isArray(details) && details.length) {
        for (const p of details) {
          const cn = p.class_name || "unknown";
          perClass[cn] = perClass[cn] || { present: 0, sick: 0 };
          perClass[cn].present += Number(p.present || 0);
          perClass[cn].sick += Number(p.sick || 0);
          total += Number(p.present || 0);
          totalSick += Number(p.sick || 0);
        }
      } else if (typeof r.text === "string") {
        // fallback: try to extract numbers from text
        const mTotal = r.text.match(/Всего\s*:?[\s]*(\d+)/i);
        if (mTotal) total += Number(mTotal[1]);
        const mSick = r.text.match(/Отсутствуют\s*:?[\s]*(\d+)/i);
        if (mSick) totalSick += Number(mSick[1]);
      }
    }

    const rows = Object.keys(perClass).map((k) => `${k},${perClass[k].present},${perClass[k].sick}`);
    const csv = ["class,present,sick", ...rows, `total,${total},${totalSick}`].join("\n");

    // Optionally send to kitchen/director via Twilio
    const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM");
    const DIRECTOR_TO = Deno.env.get("DIRECTOR_WHATSAPP_TO");

    const reportText = `Ежедневный отчёт столовой:\nВсего порций: ${total}. Отсутствуют: ${totalSick}.`;

    // By default send notifications. Set SEND_NOTIFICATIONS="0" to disable during testing.
    const sendNotifications = Deno.env.get("SEND_NOTIFICATIONS") !== "0";
    if (sendNotifications && TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM && DIRECTOR_TO) {
      try {
        const form = new URLSearchParams({ From: TWILIO_FROM, To: DIRECTOR_TO, Body: reportText });
        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
          method: "POST",
          headers: { Authorization: `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}` },
          body: form.toString(),
        });
      } catch (e) {
        console.error("twilio send daily", e);
      }
    } else {
      console.info("Notifications skipped for daily-report (SEND_NOTIFICATIONS!=1)");
    }

    return new Response(csv, { headers: { ...corsHeaders, "Content-Type": "text/csv" } });
  } catch (e) {
    console.error("daily-report fatal", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
