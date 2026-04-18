// Telegram Bot webhook — receives every update from BotFather and saves
// to chat_messages. The DB realtime trigger then auto-fires parse-chat.
// ALSO: when MEKTEP AI replies (via parse-chat inserting into chat_messages
// with source='ai' and a chat_room linked to telegram), this function is
// re-used as a sender via /sendMessage.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const TG_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!TG_TOKEN) {
    return new Response(JSON.stringify({ error: "TELEGRAM_BOT_TOKEN not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Action 'send' — used internally to push AI replies back to Telegram
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "send") {
      const { chat_id, text } = await req.json();
      if (!chat_id || !text) {
        return new Response(JSON.stringify({ error: "chat_id and text required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const tgRes = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id, text, parse_mode: "HTML" }),
      });
      const j = await tgRes.json();
      return new Response(JSON.stringify(j), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action 'set_webhook' — register this URL with Telegram
    if (action === "set_webhook") {
      const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/tg-webhook`;
      const tgRes = await fetch(
        `https://api.telegram.org/bot${TG_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`,
      );
      const j = await tgRes.json();
      return new Response(JSON.stringify({ ok: true, telegram: j, webhookUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default: incoming Telegram update
    const update = await req.json();
    console.log("TG update:", JSON.stringify(update));

    const message = update.message || update.edited_message;
    if (!message?.text) {
      return new Response("ok", { headers: corsHeaders });
    }

    const senderName =
      [message.from?.first_name, message.from?.last_name].filter(Boolean).join(" ") ||
      message.from?.username ||
      "Telegram User";

    const chatId = String(message.chat.id);

    // Find or create chat_room for this Telegram chat
    let { data: room } = await supabase
      .from("chat_rooms")
      .select("slug")
      .eq("source", "telegram")
      .eq("external_chat_id", chatId)
      .maybeSingle();

    if (!room) {
      const slug = `tg-${chatId.replace("-", "n")}`;
      await supabase.from("chat_rooms").insert({
        slug,
        name: message.chat.title || `Telegram ${senderName}`,
        source: "telegram",
        external_chat_id: chatId,
      });
      room = { slug };
    }

    // Insert message — DB realtime will trigger parse-chat from the frontend
    // OR we can fire it directly here for reliability.
    const { data: inserted } = await supabase
      .from("chat_messages")
      .insert({
        text: message.text,
        sender_name: senderName,
        source: "telegram",
        chat_room: room.slug,
        external_id: String(message.message_id),
        metadata: { tg_chat_id: chatId, tg_user_id: message.from?.id },
      })
      .select()
      .single();

    // Fire parse-chat directly so AI responds without depending on a connected client
    if (inserted?.id) {
      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/parse-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ message_id: inserted.id }),
      }).catch((e) => console.error("parse-chat fire error", e));

      // Also: after a small delay, fetch the AI reply and push it BACK to Telegram
      // We do this by polling chat_messages for the AI reply linked to this message.
      // Simpler: just listen for parse-chat to insert and call sendMessage from a separate
      // listener; here we await up to 8s then send whatever AI produced.
      (async () => {
        for (let i = 0; i < 8; i++) {
          await new Promise((r) => setTimeout(r, 1000));
          const { data: aiReply } = await supabase
            .from("chat_messages")
            .select("text")
            .eq("source", "ai")
            .eq("reply_to_message_id", inserted.id)
            .maybeSingle();
          if (aiReply?.text) {
            await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text: aiReply.text,
                reply_to_message_id: message.message_id,
              }),
            }).catch((e) => console.error("tg send err", e));
            break;
          }
        }
      })();
    }

    return new Response("ok", { headers: corsHeaders });
  } catch (e) {
    console.error("tg-webhook fatal", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
