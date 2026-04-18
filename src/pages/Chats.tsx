import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, Bot, MessageSquare, Hash } from "lucide-react";
import { useApp } from "@/store/appStore";
import { toast } from "sonner";

interface Room { slug: string; name: string; source: string; description: string | null; }
interface Msg {
  id: string; text: string; sender_name: string; source: string;
  chat_room: string; created_at: string; processed: boolean;
  metadata: any;
}

const sourceBadge = (s: string) =>
  s === "telegram" ? "bg-sky-500/10 text-sky-600 border-sky-500/30" :
  s === "whatsapp" ? "bg-green-500/10 text-green-600 border-green-500/30" :
  "bg-secondary text-foreground/70 border-border";

export default function Chats() {
  const { t } = useTranslation();
  const { user, profile } = useApp();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [active, setActive] = useState<string>("general");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("chat_rooms").select("*").order("source").order("name");
      setRooms(data || []);
    })();
    const ch = supabase.channel("rooms-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_rooms" },
        async () => {
          const { data } = await supabase.from("chat_rooms").select("*").order("source").order("name");
          setRooms(data || []);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("chat_messages").select("*")
        .eq("chat_room", active).order("created_at", { ascending: true }).limit(200);
      setMessages(data || []);
    };
    load();
    const ch = supabase.channel(`room-${active}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "chat_messages", filter: `chat_room=eq.${active}` },
        load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [active]);

  const send = async () => {
    if (!text.trim() || !user) return;
    setSending(true);
    try {
      const { error } = await supabase.from("chat_messages").insert({
        text: text.trim(),
        sender_name: profile?.full_name || user.email || "Me",
        sender_user_id: user.id,
        source: "internal",
        chat_room: active,
      });
      if (error) throw error;
      setText("");
    } catch (e: any) { toast.error(e.message); }
    finally { setSending(false); }
  };

  const grouped = useMemo(() => {
    const g: Record<string, Room[]> = { internal: [], telegram: [], whatsapp: [] };
    rooms.forEach((r) => { (g[r.source] ||= []).push(r); });
    return g;
  }, [rooms]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-1">{t("chats.title", "Все чаты")}</h1>
        <p className="text-muted-foreground">{t("chats.subtitle", "Единый дашборд из внутреннего чата, Telegram и WhatsApp")}</p>
      </div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-4 h-[72vh]">
        {/* Rooms sidebar */}
        <div className="bg-card border border-border rounded-2xl shadow-soft overflow-y-auto p-3 space-y-4 scrollbar-thin">
          {(["internal", "telegram", "whatsapp"] as const).map((src) => (
            <div key={src}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 mb-1">
                {src === "internal" ? "Внутренние" : src === "telegram" ? "Telegram" : "WhatsApp"}
              </div>
              <div className="space-y-0.5">
                {(grouped[src] || []).length === 0 && (
                  <div className="text-xs text-muted-foreground px-2 py-1 italic">— пусто —</div>
                )}
                {(grouped[src] || []).map((r) => (
                  <button key={r.slug} onClick={() => setActive(r.slug)}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-sm flex items-center gap-2 transition-smooth ${
                      active === r.slug ? "bg-accent-soft text-accent font-semibold" : "hover:bg-secondary"
                    }`}>
                    <Hash className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
                    <span className="truncate">{r.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Active room */}
        <div className="bg-card border border-border rounded-2xl shadow-soft flex flex-col">
          <div className="p-4 border-b border-border flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-accent" />
            <div className="flex-1 min-w-0">
              <div className="font-display font-bold truncate">{rooms.find(r => r.slug === active)?.name || active}</div>
              <div className="text-xs text-muted-foreground">{messages.length} сообщений · MEKTEP AI слушает в реальном времени</div>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${sourceBadge(rooms.find(r => r.slug === active)?.source || "internal")}`}>
              {rooms.find(r => r.slug === active)?.source || "internal"}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin">
            {messages.length === 0 ? (
              <div className="text-sm text-center text-muted-foreground py-12">Пока нет сообщений в этом канале.</div>
            ) : messages.map((m) => {
              const isAi = m.source === "ai";
              const isMe = m.sender_name === (profile?.full_name || user?.email);
              return (
                <motion.div key={m.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 ${
                    isAi ? "bg-accent-soft border border-accent/30" :
                    isMe ? "bg-primary text-primary-foreground" : "bg-secondary"
                  }`}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {isAi && <Bot className="h-3 w-3 text-accent" />}
                      <span className={`text-[11px] font-semibold ${isAi ? "text-accent" : ""}`}>
                        {isAi ? "MEKTEP AI" : m.sender_name}
                      </span>
                      {m.metadata?.memory_applied && (
                        <span className="text-[9px] uppercase bg-accent/20 text-accent px-1 rounded">memory</span>
                      )}
                    </div>
                    <div className="text-sm whitespace-pre-wrap">{m.text}</div>
                    <div className={`text-[10px] mt-0.5 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                      {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {!m.processed && !isAi && <span className="ml-1 italic">· обработка…</span>}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
          <div className="p-3 border-t border-border flex gap-2">
            <Input value={text} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              placeholder="Написать в этот канал…" disabled={sending} />
            <Button onClick={send} disabled={sending || !text.trim()} className="gradient-primary text-primary-foreground">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
