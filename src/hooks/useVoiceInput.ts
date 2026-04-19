import { useCallback, useEffect, useRef, useState } from "react";

// Web Speech API recognition wrapper. Falls back gracefully if unsupported.
type RecogState = "idle" | "listening" | "error" | "unsupported";

export function useVoiceInput(opts?: { lang?: string; onFinal?: (text: string) => void }) {
  const [state, setState] = useState<RecogState>("idle");
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const recogRef = useRef<any>(null);
  const shouldStopRef = useRef(false);
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
    // keep continuous to reduce quick onend/stop cycles
    r.continuous = true;
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
        const trimmed = final.trim();
        console.debug('useVoiceInput onresult final:', trimmed);
        setTranscript((prev) => (prev ? prev + " " : "") + trimmed);
        try { onFinalRef.current?.(trimmed); } catch (err) { console.error('onFinal handler error', err); }
      }
      setInterim(inter);
    };
    r.onerror = (ev: any) => { console.error('SpeechRecognition error', ev); setState("error"); };
    r.onend = () => {
      // If stop was explicitly requested, go to idle; otherwise try to restart
      setInterim("");
      if (shouldStopRef.current) {
        setState("idle");
      } else {
        // try to restart once after short delay to handle brief silences
        try {
          setTimeout(() => { try { r.start(); } catch (e) { console.error('restart SR failed', e); setState("idle"); } }, 250);
        } catch (ex) {
          console.error('onend restart error', ex);
          setState("idle");
        }
      }
    };
    recogRef.current = r;
    return () => {
      try { shouldStopRef.current = true; r.stop(); } catch { /* noop */ }
    };
  }, [opts?.lang]);

  const start = useCallback(() => {
    if (!recogRef.current) return;
    setTranscript("");
    setInterim("");
    setState("listening");
    try { shouldStopRef.current = false; recogRef.current.start(); } catch { /* already started or failed */ }
  }, []);

  const stop = useCallback(() => {
    try { shouldStopRef.current = true; recogRef.current?.stop(); } catch { /* noop */ }
  }, []);

  return { state, transcript, interim, start, stop, supported: state !== "unsupported" };
}
