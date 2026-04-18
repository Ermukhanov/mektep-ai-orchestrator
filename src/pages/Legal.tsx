import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, Scale, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Order { id: string; number: string; title: string; summary: string | null; bullets: any; }
interface Msg { role: "user" | "assistant"; content: string; }

export default function Legal() {
  const { t, i18n } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from("legal_orders").select("*").order("number").then(({ data }) => setOrders(data || []));
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const ask = async () => {
    if (!text.trim()) return;
    const q = text.trim();
    setText("");
    setMessages((m) => [...m, { role: "user", content: q }]);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("legal-chat", { body: { question: q, language: i18n.language } });
      if (error) throw error;
      setMessages((m) => [...m, { role: "assistant", content: (data as any)?.reply || "" }]);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-1">{t("legal.title")}</h1>
        <p className="text-muted-foreground">{t("legal.subtitle")}</p>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-2xl shadow-soft">
          <div className="p-4 border-b border-border flex items-center gap-2"><Scale className="h-4 w-4 text-accent" /><h2 className="font-display font-bold">{t("legal.orders")}</h2></div>
          <div className="divide-y divide-border max-h-[60vh] overflow-y-auto">
            {orders.length === 0 ? <div className="p-6 text-sm text-muted-foreground text-center">{t("legal.noOrders")}</div>
              : orders.map((o) => (
                <div key={o.id} className="p-4">
                  <div className="text-xs font-semibold text-accent">№ {o.number}</div>
                  <div className="font-semibold mt-0.5">{o.title}</div>
                  {o.summary && <p className="text-sm text-muted-foreground mt-1">{o.summary}</p>}
                  {Array.isArray(o.bullets) && o.bullets.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {o.bullets.slice(0, 4).map((b: string, i: number) => (
                        <li key={i} className="text-xs text-muted-foreground flex gap-1.5"><span className="text-accent">•</span><span>{b}</span></li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl shadow-soft flex flex-col h-[60vh]">
          <div className="p-4 border-b border-border flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent" /><h2 className="font-display font-bold">{t("legal.simplify")}</h2></div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
            {messages.length === 0 && <div className="text-sm text-center text-muted-foreground py-12">{t("legal.emptyChat")}</div>}
            {messages.map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{m.content}</div>
              </motion.div>
            ))}
            {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t("legal.thinking")}</div>}
            <div ref={endRef} />
          </div>
          <div className="p-3 border-t border-border flex gap-2">
            <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !loading) ask(); }} placeholder={t("legal.chatPlaceholder")} disabled={loading} />
            <Button onClick={ask} disabled={loading || !text.trim()} className="gradient-primary text-primary-foreground">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
