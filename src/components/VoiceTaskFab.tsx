import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, X, Loader2, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/store/appStore";

// Use browser SpeechRecognition where available, in selected language.
type SR = any;

export function VoiceTaskFab() {
  const { t, i18n } = useTranslation();
  const { user } = useApp();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"idle" | "listening" | "processing" | "done">("idle");
  const [transcript, setTranscript] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [recognizer, setRecognizer] = useState<SR | null>(null);

  const langMap: Record<string, string> = { ru: "ru-RU", kz: "kk-KZ", en: "en-US" };

  const stop = () => {
    if (recognizer) {
      try { recognizer.stop(); } catch {}
    }
  };

  const submit = async (text: string) => {
    if (!text.trim() || !user) {
      setPhase("idle");
      return;
    }
    setPhase("processing");
    try {
      const { data, error } = await supabase.functions.invoke("voice-task", {
        body: { transcript: text, language: i18n.language },
      });
      if (error) throw error;
      setConfirmation((data as any)?.confirmation || t("voice.created"));
      setPhase("done");
      toast.success(t("voice.created"));
    } catch (e: any) {
      toast.error(e.message || "AI error");
      setPhase("idle");
    }
  };

  const start = () => {
    setOpen(true);
    setTranscript("");
    setConfirmation("");

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      // fallback: prompt typed input
      setPhase("listening");
      const typed = window.prompt(t("voice.fallbackPrompt"));
      if (typed) {
        setTranscript(typed);
        submit(typed);
      } else {
        setOpen(false);
        setPhase("idle");
      }
      return;
    }

    const r = new SR();
    r.lang = langMap[i18n.language] || "ru-RU";
    r.interimResults = true;
    r.continuous = false;
    let finalText = "";
    r.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const tr = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += tr;
        else interim += tr;
      }
      setTranscript(finalText + interim);
    };
    r.onend = () => {
      if (finalText) submit(finalText);
      else { setOpen(false); setPhase("idle"); }
    };
    r.onerror = (ev: any) => {
      console.error("SR error", ev);
      toast.error(t("voice.micError"));
      setOpen(false);
      setPhase("idle");
    };
    setPhase("listening");
    setRecognizer(r);
    try { r.start(); } catch (e) { console.error(e); }
  };

  const close = () => {
    stop();
    setOpen(false);
    setTimeout(() => setPhase("idle"), 300);
  };

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={start}
        className="fixed bottom-20 md:bottom-6 right-4 md:right-8 h-14 w-14 rounded-full gradient-success shadow-glow flex items-center justify-center z-40 animate-pulse-ring"
        aria-label={t("voice.button")}
      >
        <Mic className="h-6 w-6 text-white" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-primary/40 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4"
            onClick={close}>
            <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
              transition={{ type: "spring", damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-card rounded-3xl shadow-elegant p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="text-sm font-semibold text-muted-foreground">{t("voice.button")}</div>
                <button onClick={close} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
              </div>

              <div className="flex flex-col items-center text-center min-h-[180px]">
                {phase === "listening" && (
                  <>
                    <div className="relative h-20 w-20 rounded-full gradient-success flex items-center justify-center mb-4 animate-pulse-ring">
                      <Mic className="h-9 w-9 text-white" />
                    </div>
                    <div className="text-sm text-muted-foreground mb-3">{t("voice.listening")}</div>
                    <div className="text-base font-medium min-h-[48px] px-4">
                      {transcript}<span className="animate-pulse">|</span>
                    </div>
                    <Button onTap={() => stop()} />
                  </>
                )}
                {phase === "processing" && (
                  <>
                    <Loader2 className="h-12 w-12 text-accent animate-spin mb-4" />
                    <div className="text-sm text-muted-foreground">{t("voice.processing")}</div>
                    <div className="text-sm mt-3 italic text-foreground/70">"{transcript}"</div>
                  </>
                )}
                {phase === "done" && (
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full">
                    <div className="h-16 w-16 rounded-full bg-accent-soft flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="h-9 w-9 text-accent" />
                    </div>
                    <div className="font-semibold text-lg mb-1">{t("voice.created")}</div>
                    <div className="text-sm text-muted-foreground mb-4">"{transcript}"</div>
                    <div className="bg-secondary rounded-2xl p-4 text-left text-sm">{confirmation}</div>
                  </motion.div>
                )}
              </div>

              {phase === "listening" && (
                <p className="text-xs text-center text-muted-foreground mt-4 italic">{t("voice.example")}</p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// dummy to avoid unused-import lint
function Button(_: any) { return null; }
