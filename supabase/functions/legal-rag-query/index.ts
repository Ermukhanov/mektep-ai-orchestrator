import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAlemEmbeddings } from "../_shared/llm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function cosine(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-12);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { q } = await req.json().catch(() => ({}));
    if (!q) return new Response(JSON.stringify({ error: "q required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const ALEM = Deno.env.get("ALEM_API_KEY");
    if (!ALEM) {
      console.warn('ALEM_API_KEY not set — returning empty results');
      return new Response(JSON.stringify({ query: q, top: [], orders: [], note: 'ALEM not configured (fallback)' }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let ej: any;
    try {
      ej = await callAlemEmbeddings({ model: "text-embedding-3-large", input: [q] });
    } catch (e) {
      console.error("emb err", e);
      return new Response(JSON.stringify({ error: "embedding failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const qemb = ej.data?.[0]?.embedding;

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: chunks } = await supabase.from("legal_chunks").select("id,order_id,content,embedding").limit(1000);
    if (!chunks) return new Response(JSON.stringify({ results: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" }); }

    const scored = (chunks as any[]).map((c) => ({ ...c, score: cosine(qemb, c.embedding || []) }));
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 6);

    // Join with orders
    const orderIds = Array.from(new Set(top.map((t) => t.order_id)));
    const { data: orders } = await supabase.from("legal_orders").select("id,number,title,summary").in("id", orderIds);

    return new Response(JSON.stringify({ query: q, top, orders }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("legal-rag-query fatal", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
