// GREEN-API WhatsApp webhook + outbound sender.
// Inbound: GREEN-API POSTs message → we insert into chat_messages → parse-chat reacts.
// Outbound: when AI inserts a reply (source='ai') in a wa room, we forward via sendMessage.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INSTANCE = Deno.env.get("GREENAPI_INSTANCE_ID")!;
const TOKEN = Deno.env.get("GREENAPI_TOKEN")!;
const BASE = (Deno.env.get("GREENAPI_BASE_URL") || "https://api.green-api.com").replace(/\/$/, "");

async function sendWa(chatId: string, text: string) {
  const url = `${BASE}/waInstance${INSTANCE}/sendMessage/${TOKEN}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, message: text }),
  });
  return r.json().catch(() => ({}));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // --- Outbound from our app (used by parse-chat or manual) ---
    if (action === "send") {
      const { chatId, message } = await req.json();
      const j = await sendWa(chatId, message);
      return new Response(JSON.stringify(j), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Inbound webhook from GREEN-API ---
    const body = await req.json().catch(() => null);
    if (!body) return new Response("ok", { headers: corsHeaders });

    // Ignore non-message events (status, outgoingMessage etc.)
    const type = body.typeWebhook;
    if (type !== "incomingMessageReceived") {
      return new Response("ok", { headers: corsHeaders });
    }

    const senderData = body.senderData || {};
    const md = body.messageData || {};
    const chatId: string = senderData.chatId || "";
    const senderName: string = senderData.senderName || senderData.sender || chatId;
    const text: string =
      md.textMessageData?.textMessage ||
      md.extendedTextMessageData?.text ||
      md.quotedMessage?.textMessage ||
      "";

    if (!chatId || !text) return new Response("ok", { headers: corsHeaders });

    // Find or create chat room per WhatsApp chat
    const slug = `wa-${chatId.replace(/[^0-9]/g, "")}`;
    const { data: room } = await supabase
      .from("chat_rooms").select("slug").eq("slug", slug).maybeSingle();
    if (!room) {
      await supabase.from("chat_rooms").insert({
        slug,
        name: `WhatsApp · ${senderName}`,
        source: "whatsapp",
        external_chat_id: chatId,
      });
    }

    const { data: inserted } = await supabase
      .from("chat_messages")
      .insert({
        text,
        sender_name: senderName,
        source: "whatsapp",
        chat_room: slug,
        external_id: `${chatId}-${body.idMessage || Date.now()}`,
        metadata: { wa_chat_id: chatId, green_api: true },
      })
      .select()
      .single();

    // Trigger AI parser
    if (inserted?.id) {
      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/parse-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ message_id: inserted.id }),
      }).catch((e) => console.error("parse-chat fire", e));

      // Wait briefly for AI reply, then send back to WhatsApp
      (async () => {
        for (let i = 0; i < 10; i++) {
          await new Promise((r) => setTimeout(r, 1200));
          const { data: ai } = await supabase
            .from("chat_messages")
            .select("text")
            .eq("source", "ai")
            .eq("reply_to_message_id", inserted.id)
            .maybeSingle();
          if (ai?.text) {
            await sendWa(chatId, ai.text).catch((e) => console.error("wa send", e));
            break;
          }
        }
      })();
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("greenapi-webhook fatal", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
