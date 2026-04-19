import { useCallback, useEffect, useRef, useState } from "react";

// Web Speech API recognition wrapper. Falls back gracefully if unsupported.
type RecogState = "idle" | "listening" | "error" | "unsupported";

export function useVoiceInput(opts?: { lang?: string; onFinal?: (text: string) => void }) {
  const [state, setState] = useState<RecogState>("idle");
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const recogRef = useRef<any>(null);
  const onFinalRef = useRef(opts?.onFinal);
  onFinalRef.current = opts?.onFinal;

  useEffect(() => {
    const W = window as any;
    const SR = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!SR) {
      setState("unsupported");
      return;
    }
    const r = new SR();
    r.lang = opts?.lang || "ru-RU";
    r.continuous = false;
    r.interimResults = true;
    r.onresult = (e: any) => {
      let final = "";
      let inter = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const txt = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += txt;
        else inter += txt;
      }
      if (final) {
        setTranscript((prev) => (prev ? prev + " " : "") + final.trim());
        onFinalRef.current?.(final.trim());
      }
      setInterim(inter);
    };
    r.onerror = () => setState("error");
    r.onend = () => {
      setState("idle");
      setInterim("");
    };
    recogRef.current = r;
    return () => {
      try { r.stop(); } catch { /* noop */ }
    };
  }, [opts?.lang]);

  const start = useCallback(() => {
    if (!recogRef.current) return;
    setTranscript("");
    setInterim("");
    setState("listening");
    try { recogRef.current.start(); } catch { /* already started */ }
  }, []);

  const stop = useCallback(() => {
    try { recogRef.current?.stop(); } catch { /* noop */ }
  }, []);

  return { state, transcript, interim, start, stop, supported: state !== "unsupported" };
}
