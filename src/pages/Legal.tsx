import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LEGAL_ORDERS, LegalOrder } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Scale, FileText, Send, Sparkles, Bot, User } from "lucide-react";

interface ChatMsg { role: "user" | "ai"; text: string; bullets?: string[] }

export default function Legal() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<LegalOrder>(LEGAL_ORDERS[0]);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);

  const send = () => {
    if (!input.trim()) return;
    const userMsg: ChatMsg = { role: "user", text: input };
    setMessages((m) => [...m, userMsg]);
    const q = input.toLowerCase();
    setInput("");
    setLoading(true);

    setTimeout(() => {
      // Simple matcher: find order mentioned, return its bullets
      const matched = LEGAL_ORDERS.find((o) => q.includes(o.id) || q.includes(o.number.toLowerCase())) || selected;
      const reply: ChatMsg = {
        role: "ai",
        text: `Here's a simplified breakdown of ${matched.number}:`,
        bullets: matched.bullets,
      };
      setMessages((m) => [...m, reply]);
      setLoading(false);
    }, 1100);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-1 flex items-center gap-3">
          <Scale className="h-8 w-8 text-accent" />
          {t("legal.title")}
        </h1>
        <p className="text-muted-foreground">{t("legal.subtitle")}</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Orders list */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="font-display font-bold text-sm uppercase text-muted-foreground tracking-wider mb-2">{t("legal.orders")}</h2>
          {LEGAL_ORDERS.map((o, i) => (
            <motion.button
              key={o.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setSelected(o)}
              className={`w-full text-left p-5 rounded-2xl border-2 transition-smooth ${
                selected.id === o.id ? "border-accent bg-accent-soft shadow-md" : "border-border bg-card hover:border-accent/50"
              }`}
            >
              <div className="flex items-start gap-3">
                <FileText className={`h-5 w-5 mt-0.5 ${selected.id === o.id ? "text-accent" : "text-muted-foreground"}`} />
                <div className="flex-1">
                  <div className="font-display font-bold">{o.number}</div>
                  <div className="text-sm font-medium mt-1">{o.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">{o.date}</div>
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Detail + Chat */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div
            key={selected.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-2xl p-6 shadow-soft"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-accent uppercase mb-2">
              <Sparkles className="h-3 w-3" /> AI-Simplified
            </div>
            <h3 className="font-display text-xl font-bold mb-1">{selected.number}</h3>
            <p className="text-sm text-muted-foreground mb-4">{selected.summary}</p>
            <ul className="space-y-2">
              {selected.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <div className="h-5 w-5 rounded-full bg-accent-soft flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-accent" />
                  </div>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Chat */}
          <div className="bg-card border border-border rounded-2xl shadow-soft flex flex-col h-[420px]">
            <div className="p-4 border-b border-border flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg gradient-success flex items-center justify-center">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div>
                <div className="font-display font-bold text-sm">{t("legal.simplify")}</div>
                <div className="text-xs text-muted-foreground">Powered by AI</div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
              {messages.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-12">{t("legal.emptyChat")}</div>
              )}
              <AnimatePresence>
                {messages.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}
                  >
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${m.role === "ai" ? "gradient-success" : "bg-secondary"}`}>
                      {m.role === "ai" ? <Bot className="h-4 w-4 text-white" /> : <User className="h-4 w-4" />}
                    </div>
                    <div className={`max-w-[80%] rounded-2xl p-3 text-sm ${m.role === "ai" ? "bg-secondary" : "bg-primary text-primary-foreground"}`}>
                      <div>{m.text}</div>
                      {m.bullets && (
                        <ul className="mt-2 space-y-1.5">
                          {m.bullets.map((b, j) => (
                            <li key={j} className="flex items-start gap-2 text-xs">
                              <span className="text-accent mt-0.5">▸</span>
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {loading && (
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-full gradient-success flex items-center justify-center">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-secondary rounded-2xl p-3 flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0.15s" }} />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0.3s" }} />
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 border-t border-border flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder={t("legal.chatPlaceholder")}
                className="flex-1"
              />
              <Button onClick={send} disabled={!input.trim() || loading} className="gradient-primary text-primary-foreground">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
