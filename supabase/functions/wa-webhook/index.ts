// WhatsApp webhook via Twilio Sandbox or Business API.
// Same flow as tg-webhook: insert into chat_messages → parse-chat → send reply back.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
  const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
  const TWILIO_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM"); // e.g. "whatsapp:+14155238886"

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // Internal: send a WhatsApp message
    if (action === "send") {
      if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
        return new Response(
          JSON.stringify({ error: "Twilio secrets not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const { to, body } = await req.json();
      const form = new URLSearchParams({ From: TWILIO_FROM, To: to, Body: body });
      const twRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form.toString(),
        },
      );
      const j = await twRes.json();
      return new Response(JSON.stringify(j), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Twilio webhook: form-encoded (or JSON if Meta Cloud API)
    let from = "";
    let body = "";
    let profileName = "";

    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      from = params.get("From") || "";
      body = params.get("Body") || "";
      profileName = params.get("ProfileName") || "";
    } else {
      const j = await req.json();
      from = j.From || j.from || "";
      body = j.Body || j.body || j.message?.text || "";
      profileName = j.ProfileName || j.profile_name || "";
    }

    if (!from || !body) return new Response("ok", { headers: corsHeaders });

    // Find or create whatsapp room per phone
    const slug = `wa-${from.replace(/[^0-9]/g, "")}`;
    let { data: room } = await supabase
      .from("chat_rooms")
      .select("slug")
      .eq("slug", slug)
      .maybeSingle();
    if (!room) {
      await supabase.from("chat_rooms").insert({
        slug,
        name: profileName ? `WhatsApp · ${profileName}` : `WhatsApp · ${from}`,
        source: "whatsapp",
        external_chat_id: from,
      });
    }

    const { data: inserted } = await supabase
      .from("chat_messages")
      .insert({
        text: body,
        sender_name: profileName || from,
        source: "whatsapp",
        chat_room: slug,
        external_id: from + "-" + Date.now(),
        metadata: { wa_from: from },
      })
      .select()
      .single();

    if (inserted?.id) {
      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/parse-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ message_id: inserted.id }),
      }).catch((e) => console.error("parse-chat fire", e));

      // Send AI reply back if Twilio is configured
      if (TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
        (async () => {
          for (let i = 0; i < 8; i++) {
            await new Promise((r) => setTimeout(r, 1000));
            const { data: ai } = await supabase
              .from("chat_messages")
              .select("text")
              .eq("source", "ai")
              .eq("reply_to_message_id", inserted.id)
              .maybeSingle();
            if (ai?.text) {
              const form = new URLSearchParams({
                From: TWILIO_FROM,
                To: from,
                Body: ai.text,
              });
              await fetch(
                `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                  },
                  body: form.toString(),
                },
              ).catch((e) => console.error("twilio send", e));
              break;
            }
          }
        })();
      }
    }

    // Twilio expects empty TwiML response
    return new Response("<Response></Response>", {
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
    });
  } catch (e) {
    console.error("wa-webhook fatal", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
