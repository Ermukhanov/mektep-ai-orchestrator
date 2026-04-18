import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, Check, X, Loader2, Bot } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/store/appStore";

interface Msg {
  id: string;
  text: string;
  sender_name: string;
  source: string;
  created_at: string;
  language: string | null;
  processed: boolean;
}

interface PendingAction {
  id: string;
  source_message_id: string | null;
  action_type: string;
  payload: any;
  ai_summary: string | null;
  ai_reasoning: string | null;
  status: string;
  created_at: string;
}

export default function Inbox() {
  const { t, i18n } = useTranslation();
  const { profile, role, user } = useApp();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [pending, setPending] = useState<PendingAction[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [deciding, setDeciding] = useState<string | null>(null);

  const refresh = async () => {
    const [{ data: msgs }, { data: pa }] = await Promise.all([
      supabase.from("chat_messages").select("*").order("created_at", { ascending: true }).limit(80),
      supabase.from("pending_actions").select("*").eq("status", "pending").order("created_at", { ascending: false }),
    ]);
    setMessages(msgs || []);
    setPending(pa || []);
  };

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel("inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "pending_actions" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const send = async () => {
    if (!text.trim() || !user) return;
    setSending(true);
    try {
      const { data: msg, error } = await supabase
        .from("chat_messages")
        .insert({
          text: text.trim(),
          sender_name: profile?.full_name || user.email || "Me",
          sender_user_id: user.id,
          source: "internal",
          language: i18n.language,
        })
        .select()
        .single();
      if (error) throw error;
      setText("");
      // trigger AI parse
      supabase.functions.invoke("parse-chat", { body: { message_id: msg.id } }).catch((e) => console.error(e));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  const decide = async (id: string, decision: "approve" | "reject") => {
    setDeciding(id);
    try {
      const { error } = await supabase.functions.invoke("decide-action", {
        body: { action_id: id, decision },
      });
      if (error) throw error;
      toast.success(decision === "approve" ? t("inbox.approved") : t("inbox.rejected"));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeciding(null);
    }
  };

  const isDirector = role === "director";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-1 flex items-center gap-2">
            {t("inbox.title")}
          </h1>
          <p className="text-muted-foreground">{t("inbox.subtitle")}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Chat column */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl shadow-soft flex flex-col h-[70vh]">
          <div className="p-4 border-b border-border flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg gradient-primary flex items-center justify-center">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="font-display font-bold">{t("inbox.chatTitle")}</div>
              <div className="text-xs text-muted-foreground">{t("inbox.chatSub")}</div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
            {messages.length === 0 ? (
              <div className="text-sm text-center text-muted-foreground py-12">{t("inbox.empty")}</div>
            ) : messages.map((m) => {
              const isAi = m.source === "ai";
              const isMe = m.sender_name === (profile?.full_name || user?.email);
              return (
                <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    isAi ? "bg-accent-soft border border-accent/30" :
                    isMe ? "bg-primary text-primary-foreground" : "bg-secondary"
                  }`}>
                    <div className={`text-[11px] font-semibold mb-1 ${isAi ? "text-accent" : isMe ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                      {isAi ? "🤖 MEKTEP AI" : m.sender_name}
                    </div>
                    <div className="text-sm whitespace-pre-wrap">{m.text}</div>
                    <div className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                      {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {!m.processed && m.source !== "ai" && <span className="ml-1 italic">· {t("inbox.parsing")}</span>}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="p-3 border-t border-border flex gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              placeholder={t("inbox.placeholder")}
              disabled={sending}
            />
            <Button onClick={send} disabled={sending || !text.trim()} className="gradient-primary text-primary-foreground">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Pending actions */}
        <div className="bg-card border border-border rounded-2xl shadow-soft flex flex-col h-[70vh]">
          <div className="p-4 border-b border-border flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-accent-soft flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-accent" />
            </div>
            <div className="flex-1">
              <div className="font-display font-bold">{t("inbox.pendingTitle")}</div>
              <div className="text-xs text-muted-foreground">{t("inbox.pendingSub")}</div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-accent text-accent-foreground text-xs font-semibold">{pending.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
            <AnimatePresence>
              {pending.length === 0 ? (
                <div className="text-sm text-center text-muted-foreground py-12">{t("inbox.noProposals")}</div>
              ) : pending.map((p) => (
                <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="rounded-xl border border-border p-3 bg-background">
                  <div className="text-[10px] uppercase tracking-wide text-accent font-semibold mb-1">
                    {t(`inbox.action.${p.action_type}`, { defaultValue: p.action_type })}
                  </div>
                  <div className="text-sm font-medium mb-1.5">{p.ai_summary}</div>
                  {p.payload && Object.keys(p.payload).length > 0 && (
                    <div className="text-xs text-muted-foreground mb-2 space-y-0.5">
                      {Object.entries(p.payload).filter(([k]) => k !== "language").map(([k, v]) => (
                        <div key={k}><span className="font-semibold">{k}:</span> {String(v)}</div>
                      ))}
                    </div>
                  )}
                  {isDirector ? (
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" onClick={() => decide(p.id, "approve")} disabled={deciding === p.id}
                        className="flex-1 gradient-success text-white h-8">
                        {deciding === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Check className="h-3 w-3 mr-1" />{t("inbox.approve")}</>}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => decide(p.id, "reject")} disabled={deciding === p.id}
                        className="flex-1 h-8">
                        <X className="h-3 w-3 mr-1" />{t("inbox.reject")}
                      </Button>
                    </div>
                  ) : (
                    <div className="text-[11px] italic text-muted-foreground mt-1">{t("inbox.directorOnly")}</div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
