import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAlemEmbeddings } from "../_shared/llm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function chunkText(text: string, chunkSize = 800) {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + chunkSize));
    i += chunkSize;
  }
  return chunks;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: orders } = await supabase.from("legal_orders").select("id,number,title,full_text").limit(200);
    if (!orders?.length) return new Response(JSON.stringify({ ok: true, count: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const ALEM = Deno.env.get("ALEM_API_KEY");
    if (!ALEM) {
      console.warn('ALEM_API_KEY not set — skipping ingest');
      return new Response(JSON.stringify({ ok: true, count: 0, note: 'ALEM not configured — ingest skipped' }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let totalInserted = 0;
    for (const o of orders) {
      const text = o.full_text || o.title || "";
      const chunks = chunkText(text, 800);
      // call embeddings in batches
      for (let i = 0; i < chunks.length; i += 10) {
        const batch = chunks.slice(i, i + 10);
        let j: any;
        try {
          j = await callAlemEmbeddings({ model: "text-embedding-3-large", input: batch });
        } catch (e) {
          console.error("embeddings error", e);
          continue;
        }
        const embs = j.data?.map((d: any) => d.embedding) || [];
        for (let k = 0; k < embs.length; k++) {
          const content = batch[k];
          const embedding = embs[k];
          const { error } = await supabase.from("legal_chunks").insert({ order_id: o.id, chunk_index: k, content, embedding }).select().maybeSingle();
          if (error) console.error("insert chunk", error);
          else totalInserted++;
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, count: totalInserted }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("rag-ingest fatal", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
