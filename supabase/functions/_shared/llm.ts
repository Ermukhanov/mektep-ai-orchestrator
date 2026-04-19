export async function callAlem(path: string, body: any, opts: { method?: string } = {}) {
  const key = Deno.env.get("ALEM_API_KEY") || Deno.env.get("VITE_ALEM_API_KEY");
  if (!key) throw new Error("ALEM_API_KEY not set in environment");

  const res = await fetch(`https://llm.alem.ai${path}`, {
    method: opts.method || "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    const err = new Error(`ALEM API error ${res.status}: ${txt}`);
    // attach status for callers
    // @ts-ignore
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function callAlemEmbeddings(body: any) {
  return callAlem('/v1/embeddings', body);
}
