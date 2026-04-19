// Ingest built-in legal templates into `legal_orders` table if missing
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // Get templates from function endpoint
    const tplRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/legal-templates`);
    const templates = await tplRes.json();

    const inserted: any[] = [];
    for (const key of Object.keys(templates)) {
      const t = templates[key];
      // check exists by title
      const { data: exists } = await supabase.from("legal_orders").select("id").eq("number", key).maybeSingle();
      if (!exists) {
        const { data, error } = await supabase.from("legal_orders").insert({ number: key, title: t.title, summary: null, bullets: [], template: t }).select().maybeSingle();
        if (error) console.error("insert template", error);
        else inserted.push(data);
      }
    }

    return new Response(JSON.stringify({ ok: true, inserted, count: inserted.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("ingest fatal", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
