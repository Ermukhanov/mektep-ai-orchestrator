import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Send, Scale, Sparkles, Mic, MicOff, Download,
  FileText, Edit3, CheckCircle2, ChevronRight, Copy, RotateCcw,
  Printer, Eye
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LEGAL_ORDERS } from "@/lib/mockData";
import { toast } from "sonner";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import * as XLSX from "xlsx";

interface Order { id: string; number: string; title: string; summary: string | null; bullets: any; }
interface Msg { role: "user" | "assistant"; content: string; }

interface GeneratedDoc {
  order_type: string;
  title: string;
  order_number: string;
  date: string;
  content: string;
  filled_fields: Record<string, string>;
  summary: string;
  legal_basis?: string;
}

const ORDER_TYPE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  "130": { label: "Приказ 130 — Категория педагога", color: "bg-blue-100 text-blue-700 border-blue-300", icon: "🎓" },
  "76": { label: "Приказ 76 — Учебный план", color: "bg-green-100 text-green-700 border-green-300", icon: "📋" },
  "110": { label: "Приказ 110 — Образовательный процесс", color: "bg-yellow-100 text-yellow-700 border-yellow-300", icon: "🏫" },
  "absence": { label: "Замена учителя", color: "bg-orange-100 text-orange-700 border-orange-300", icon: "👤" },
  "discipline": { label: "Дисциплинарный приказ", color: "bg-red-100 text-red-700 border-red-300", icon: "⚠️" },
};

  const QUICK_DOC_PROMPTS = [
  { label: "Приказ 130", prompt: "Сгенерируй приказ 130 о присвоении первой квалификационной категории учителю математики Аскарову Данияру" },
  { label: "Замена учителя", prompt: "Создай приказ о замене заболевшего учителя физики Сунгариевой на учителя Сулейманова на сегодня" },
  { label: "Учебный план", prompt: "Сгенерируй приказ 76 об утверждении учебного плана на 2024-2025 учебный год" },
  { label: "Дисциплина", prompt: "Приказ о дисциплинарном взыскании за систематические опоздания ученика 9А класса" },
];

export default function Legal() {
  const { t, i18n } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatedDoc, setGeneratedDoc] = useState<GeneratedDoc | null>(null);
  const [docMode, setDocMode] = useState<"chat" | "generate" | "preview">("chat");
  const [docPrompt, setDocPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [corrections, setCorrections] = useState("");
  const [correcting, setCorrecting] = useState(false);
  const [editingContent, setEditingContent] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [ragOrders, setRagOrders] = useState<any[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<number | string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({ date: new Date().toISOString().slice(0,10), responsible: '', to: '', text: '', signed_by: '' });
  const endRef = useRef<HTMLDivElement>(null);

  const lang = i18n.language === "kz" ? "kk-KZ" : i18n.language === "en" ? "en-US" : "ru-RU";
  const [voiceDocTrigger, setVoiceDocTrigger] = useState(false);
  const voiceDoc = useVoiceInput({
    lang,
    onFinal: (text) => {
      setDocPrompt((prev) => (prev ? prev + " " : "") + text);
      const t = text.toLowerCase();
      const match = t.match(/приказ\s*(130|76|110)|сгенерируй\s*приказ|подготовь\s*приказ|создай\s*приказ/i);
      if (match) {
        // build a default prompt if number present
        const num = match[1];
        const p = num ? `Сгенерируй приказ ${num} по форме для школы: ${text}` : text;
        setVoiceDocTrigger(true);
        // small delay to allow state update
        setTimeout(() => generateDoc(p), 300);
        try {
          const ack = typeof window !== 'undefined' && (window as any).speechSynthesis ? new SpeechSynthesisUtterance('Принято, готовлю документ') : null;
          if (ack) { ack.lang = lang; (window as any).speechSynthesis.cancel(); (window as any).speechSynthesis.speak(ack); }
        } catch (e) { /* noop */ }
      }
    },
  });

  useEffect(() => {
    const base = (import.meta as any).env.VITE_SUPABASE_URL || '';
    // Always show at least three usable orders in UI
    (async () => {
      try {
        const base = (import.meta as any).env.VITE_SUPABASE_URL || '';
        if (base.includes('localhost:8787')) {
          const res = await fetch(`${base}/functions/rag-list`).catch(() => null);
          if (res && res.ok) {
            const j = await res.json();
            setOrders((j.orders || []).map((o: any) => ({ id: String(o.id), number: String(o.id), title: o.title, summary: o.body || null, bullets: [] })));
            return;
          }
        }
        const { data } = await supabase.from("legal_orders").select("*").order("number");
        if (data && data.length) setOrders(data as any);
        else setOrders(LEGAL_ORDERS as any);
      } catch (e) {
        console.error('Failed to load orders, using mock', e);
        setOrders(LEGAL_ORDERS as any);
      }
    })();
    // load RAG mock when in dev mock mode
    (async () => {
      const base = (import.meta as any).env.VITE_SUPABASE_URL || '';
      try {
        if (base.includes('localhost:8787')) {
          const res = await fetch(`${base}/functions/rag-list`);
          const j = await res.json();
          if (res.ok) setRagOrders(j.orders || []);
        }
      } catch (e) { /* ignore */ }
    })();
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Q&A chat
  const ask = async () => {
    if (!text.trim()) return;
    const q = text.trim();
    setText("");
    setMessages((m) => [...m, { role: "user", content: q }]);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("legal-chat", {
        body: { question: q, language: i18n.language },
      });
      if (error) throw error;
      setMessages((m) => [...m, { role: "assistant", content: (data as any)?.reply || "" }]);
    } catch (e: any) {
      console.error('legal ask error', e);
      // fallback reply
      setMessages((m) => [...m, { role: "assistant", content: "Извините, AI временно недоступен — используйте шаблон вручную." }]);
      toast.error(e.message || 'Ошибка запроса к AI');
    } finally {
      setLoading(false);
    }
  };

  const ingestTemplates = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("ingest-legal-templates");
      if (error) throw error;
      toast.success("Приказы загружены");
      supabase.from("legal_orders").select("*").order("number").then(({ data }) => setOrders(data || []));
    } catch (e: any) { toast.error(e.message || "Ошибка"); }
  };

  const ragIngest = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("rag-ingest-legal");
      if (error) throw error;
      toast.success("RAG ingest started");
    } catch (e: any) { toast.error(e.message || "Ошибка"); }
  };

  const sendTwilioTest = async () => {
    try {
      const to = prompt('Телефон получателя (+7...)') || '';
      const msg = prompt('Текст сообщения') || 'Тестовое уведомление от MEKTEP AI';
      if (!to) return;
      const url = `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/greenapi-webhook?action=send`;
      const res = await fetch(url, { method: 'POST', headers: { apikey: (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '', 'Content-Type': 'application/json' }, body: JSON.stringify({ chatId: to, message: msg }) });
      const j = await res.json();
      if (res.ok) toast.success('Отправлено через Green API'); else toast.error(JSON.stringify(j));
    } catch (e: any) { toast.error(e.message || 'Ошибка'); }
  };

  // Generate document
  const generateDoc = async (promptOverride?: string) => {
    const p = promptOverride || docPrompt;
    if (!p.trim()) return;
    setGenerating(true);
    setGeneratedDoc(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-legal-doc", {
        body: { prompt: p, language: i18n.language },
      });
      if (error) throw error;
      const d = data as any;
      if (d.document) {
        setGeneratedDoc(d.document);
        setEditedContent(d.document.content);
        setDocMode("preview");
        toast.success("✅ Документ сгенерирован!");
      }
    } catch (e: any) {
      console.error('generateDoc error', e);
      // Fallback: if AI/function failed, build a simple mock document (130 if requested)
      try {
        const is130 = /130/.test(p);
        const mock = {
          order_type: is130 ? '130' : 'absence',
          title: is130 ? 'Приказ 130 — Категория педагога (демо)' : 'Демо-приказ',
          order_number: is130 ? '130-DEM' : `DEM-${Date.now()}`,
          date: new Date().toLocaleDateString('ru-RU'),
          content: is130 ? `ПРИКАЗ №130 (демо)\n\nНа основании...\nНазначить...` : `ДЕМО ПРИКАЗ\n\n${p}`,
          filled_fields: {},
          summary: is130 ? 'Демо-приказ по форме 130' : 'Демо документ',
        };
        setGeneratedDoc(mock as any);
        setEditedContent(mock.content);
        setDocMode('preview');
        toast.success('Использован демонстрационный документ (фолбэк)');
      } catch (e2) {
        console.error('mock doc error', e2);
        toast.error(e.message || 'Ошибка генерации');
      }
    } finally {
      setGenerating(false);
    }
  };

  // Apply corrections
  const applyCorrections = async () => {
    if (!corrections.trim() || !generatedDoc) return;
    setCorrecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-legal-doc", {
        body: {
          prompt: docPrompt,
          corrections,
          language: i18n.language,
        },
      });
      if (error) throw error;
      const d = data as any;
      if (d.document) {
        setGeneratedDoc(d.document);
        setEditedContent(d.document.content);
        setCorrections("");
        toast.success("✅ Правки применены!");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCorrecting(false);
    }
  };

  // Export to XLSX
  const exportToXlsx = () => {
    if (!generatedDoc) return;
    const content = editingContent ? editedContent : generatedDoc.content;
    const wb = XLSX.utils.book_new();

    // Main document sheet
    const lines = content.split("\n").map((line) => [line]);
    const ws = XLSX.utils.aoa_to_sheet([
      [generatedDoc.title],
      [`Номер: ${generatedDoc.order_number}`],
      [`Дата: ${generatedDoc.date}`],
      [""],
      ...lines,
    ]);
    ws["!cols"] = [{ wch: 80 }];

    // Fields sheet
    const fields = Object.entries(generatedDoc.filled_fields || {}).map(([k, v]) => [k, v]);
    const ws2 = XLSX.utils.aoa_to_sheet([["Поле", "Значение"], ...fields]);
    ws2["!cols"] = [{ wch: 30 }, { wch: 50 }];

    XLSX.utils.book_append_sheet(wb, ws, "Документ");
    XLSX.utils.book_append_sheet(wb, ws2, "Поля");
    XLSX.writeFile(wb, `${generatedDoc.order_number}_${generatedDoc.date}.xlsx`);
    toast.success("Документ скачан");
  };

  // Copy to clipboard
  const copyContent = () => {
    const content = editingContent ? editedContent : generatedDoc?.content || "";
    navigator.clipboard.writeText(content);
    toast.success("Скопировано в буфер");
  };

  const typeInfo = generatedDoc ? ORDER_TYPE_LABELS[generatedDoc.order_type] : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-1 flex items-center gap-3">
          Юридический AI
          <Badge className="bg-accent-soft text-accent border-accent/30 text-xs">
            Генерация приказов
          </Badge>
        </h1>
        <p className="text-muted-foreground">Чат с приказами МОН РК + Автогенерация официальных документов</p>
      </div>

      {/* Mode Switcher */}
      <div className="flex gap-2 p-1 bg-secondary rounded-xl w-fit">
        {[
          { key: "chat", label: "💬 Чат с законами", icon: Scale },
          { key: "generate", label: "📄 Создать документ", icon: FileText },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setDocMode(key as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-smooth ${
              docMode === key || (docMode === "preview" && key === "generate")
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* CHAT MODE */}
      <AnimatePresence mode="wait">
        {docMode === "chat" && (
          <motion.div key="chat" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="grid lg:grid-cols-2 gap-6">
            {/* Orders list */}
            <div className="bg-card border border-border rounded-2xl shadow-soft">
              <div className="p-4 border-b border-border flex items-center gap-2">
                <Scale className="h-4 w-4 text-accent" />
                <h2 className="font-display font-bold">Приказы МОН РК</h2>
                <Badge variant="secondary" className="ml-auto text-xs">{orders.length}</Badge>
              </div>
              <div className="divide-y divide-border max-h-[55vh] overflow-y-auto">
                {orders.length === 0 ? (
                  <div className="p-6 text-sm text-muted-foreground text-center">Приказы не загружены</div>
                ) : orders.map((o) => (
                  <div key={o.id} className="p-4 hover:bg-secondary/30 transition-smooth cursor-pointer"
                    onClick={() => {
                      setText(`Объясни приказ №${o.number} простыми словами`);
                      setDocMode("chat");
                    }}>
                    <div className="text-xs font-semibold text-accent mb-1">№ {o.number}</div>
                    <div className="font-semibold text-sm">{o.title}</div>
                    {o.summary && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{o.summary}</p>}
                    {Array.isArray(o.bullets) && o.bullets.length > 0 && (
                      <ul className="mt-2 space-y-0.5">
                        {o.bullets.slice(0, 3).map((b: string, i: number) => (
                          <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                            <span className="text-accent">•</span><span className="line-clamp-1">{b}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-2 flex items-center gap-1 text-xs text-accent opacity-0 group-hover:opacity-100">
                      <ChevronRight className="h-3 w-3" /> Спросить AI
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chat */}
            <div className="bg-card border border-border rounded-2xl shadow-soft flex flex-col h-[60vh]">
              <div className="p-4 border-b border-border flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                <h2 className="font-display font-bold">Объяснение приказов</h2>
                <div className="ml-auto flex gap-2">
                  <Button size="sm" onClick={ingestTemplates}>Ingest templates</Button>
                  <Button size="sm" variant="outline" onClick={ragIngest}>RAG ingest</Button>
                  <Button size="sm" variant="ghost" onClick={sendTwilioTest}>Twilio test</Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
                {messages.length === 0 && (
                  <div className="text-sm text-center text-muted-foreground py-10">
                    <Scale className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    Нажмите на приказ или задайте вопрос
                  </div>
                )}
                {messages.map((m, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                      m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary"
                    }`}>
                      {m.content}
                    </div>
                  </motion.div>
                ))}
                {loading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Думаю...
                  </div>
                )}
                <div ref={endRef} />
              </div>
              <div className="p-3 border-t border-border flex gap-2">
                <Input value={text} onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !loading) ask(); }}
                  placeholder="Спросите о любом приказе..." disabled={loading} />
                <Button onClick={ask} disabled={loading || !text.trim()} className="gradient-primary text-primary-foreground">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* GENERATE / PREVIEW MODE */}
        {(docMode === "generate" || docMode === "preview") && (
          <motion.div key="generate" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="grid lg:grid-cols-2 gap-6">
            {/* Left: Generator */}
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-2xl p-5 shadow-soft space-y-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-accent" />
                  <h2 className="font-display font-bold">Генератор документов</h2>
                </div>

                {/* Voice input */}
                <div className="relative">
                  <Textarea
                    value={docPrompt + (voiceDoc.interim ? ` ${voiceDoc.interim}` : "")}
                    onChange={(e) => setDocPrompt(e.target.value)}
                    rows={3}
                    placeholder="Скажите: «Создай приказ 130 о присвоении категории учителю математики Аскарову»"
                    className="pr-14 resize-none"
                    disabled={generating}
                  />
                  {voiceDoc.supported && (
                    <button
                      onClick={voiceDoc.state === "listening" ? voiceDoc.stop : voiceDoc.start}
                      disabled={generating}
                      className={`absolute right-3 top-3 h-10 w-10 rounded-full flex items-center justify-center transition-smooth ${
                        voiceDoc.state === "listening"
                          ? "bg-destructive text-destructive-foreground animate-pulse"
                          : "bg-accent text-accent-foreground hover:scale-110"
                      }`}
                    >
                      {voiceDoc.state === "listening" ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                    </button>
                  )}
                </div>

                {voiceDoc.state === "listening" && (
                  <p className="text-xs text-accent flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                    Слушаю...
                  </p>
                )}

                <Button onClick={() => generateDoc()} disabled={generating || !docPrompt.trim()}
                  className="w-full gradient-primary text-white gap-2">
                  {generating
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Генерация документа...</>
                    : <><Sparkles className="h-4 w-4" /> Сгенерировать документ</>
                  }
                </Button>

                {/* Quick prompts */}
                <div className="space-y-2">
                {/* RAG quick generate */}
                <div className="p-3 bg-secondary rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold">Быстрая генерация по приказу (RAG)</div>
                    <div className="text-xs text-muted-foreground">Локальный RAG</div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2 mb-2">
                    <select value={selectedOrderId ?? ''} onChange={(e) => setSelectedOrderId(e.target.value || null)} className="input">
                      <option value="">Выберите приказ...</option>
                      {ragOrders.map((o: any) => (<option key={o.id} value={o.id}>{o.id} — {o.title}</option>))}
                    </select>
                    <input className="input" value={fields.date} onChange={(e) => setFields(f => ({...f, date: e.target.value}))} type="date" />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2 mb-2">
                    <input className="input" placeholder="Ответственный" value={fields.responsible} onChange={(e) => setFields(f => ({...f, responsible: e.target.value}))} />
                    <input className="input" placeholder="Кому (to)" value={fields.to} onChange={(e) => setFields(f => ({...f, to: e.target.value}))} />
                  </div>
                  <Textarea className="mb-2" placeholder="Текст приказа / доп. поля" value={fields.text} onChange={(e) => setFields(f => ({...f, text: e.target.value}))} rows={3} />
                  <div className="flex gap-2">
                    <Button onClick={async () => {
                      if (!selectedOrderId) { toast.error('Выберите приказ'); return; }
                      try {
                        const base = (import.meta as any).env.VITE_SUPABASE_URL || '';
                        if (base.includes('localhost:8787')) {
                          const res = await fetch(`${base}/functions/generate-order`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order_id: selectedOrderId, fields }) });
                          const j = await res.json();
                          if (!res.ok) { toast.error(JSON.stringify(j)); return; }
                          // show preview and allow download
                          const doc = j.doc || j.order?.body || '';
                          const filename = j.filename || `order_${selectedOrderId}.txt`;
                          setGeneratedDoc({ order_type: String(selectedOrderId), title: ragOrders.find(r => String(r.id) === String(selectedOrderId))?.title || '', order_number: String(selectedOrderId), date: fields.date, content: doc, filled_fields: fields, summary: '' });
                          setDocMode('preview');
                          // auto-download
                          const blob = new Blob([doc], { type: 'text/plain;charset=utf-8' });
                          const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
                          toast.success('Приказ сгенерирован и скачан');
                        } else {
                                              // fallback to server function
                                              await generateDoc();
                        }
                      } catch (e: any) { toast.error(e.message || 'Ошибка генерации'); }
                    }} className="gradient-primary text-white">Сгенерировать приказ</Button>
                    <Button variant="outline" onClick={() => { setFields({ date: new Date().toISOString().slice(0,10), responsible: '', to: '', text: '', signed_by: '' }); setSelectedOrderId(null); }}>Сброс</Button>
                  </div>
                </div>
                  <p className="text-xs text-muted-foreground font-medium">Быстрые шаблоны:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {QUICK_DOC_PROMPTS.map((qp, i) => (
                      <button key={i}
                        onClick={() => { setDocPrompt(qp.prompt); generateDoc(qp.prompt); }}
                        disabled={generating}
                        className="p-2.5 rounded-xl border border-border text-left text-xs hover:border-accent hover:bg-accent-soft transition-smooth">
                        <span className="font-semibold block mb-0.5">{qp.label}</span>
                        <span className="text-muted-foreground line-clamp-2">{qp.prompt.slice(0, 60)}...</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Corrections panel */}
              {generatedDoc && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-card border border-border rounded-2xl p-5 shadow-soft space-y-3">
                  <div className="flex items-center gap-2">
                    <Edit3 className="h-4 w-4 text-accent" />
                    <h3 className="font-semibold text-sm">Правки через AI</h3>
                  </div>
                  <Textarea
                    value={corrections}
                    onChange={(e) => setCorrections(e.target.value)}
                    rows={2}
                    placeholder="Например: «Поменяй дату на 15.09.2024» или «Добавь пункт о контроле завуча»"
                    className="text-sm resize-none"
                  />
                  <Button onClick={applyCorrections} disabled={correcting || !corrections.trim()}
                    variant="outline" size="sm" className="gap-2 w-full">
                    {correcting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                    Применить правки
                  </Button>
                </motion.div>
              )}
            </div>

            {/* Right: Preview */}
            <div className="bg-card border border-border rounded-2xl shadow-soft flex flex-col">
              <div className="p-4 border-b border-border flex items-center gap-2 flex-wrap">
                <Eye className="h-4 w-4 text-accent" />
                <h2 className="font-display font-bold">Предпросмотр документа</h2>
                {typeInfo && (
                  <Badge className={`text-xs ${typeInfo.color} ml-auto`}>
                    {typeInfo.icon} {typeInfo.label}
                  </Badge>
                )}
              </div>

              {!generatedDoc && !generating && (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
                  <FileText className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-sm text-center">Введите запрос и нажмите «Сгенерировать»</p>
                  <p className="text-xs opacity-60 mt-1">Документ появится здесь</p>
                </div>
              )}

              {generating && (
                <div className="flex-1 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-accent" />
                  <p className="text-sm text-muted-foreground">Генерация официального документа...</p>
                </div>
              )}

              {generatedDoc && !generating && (
                <>
                  {/* Doc actions */}
                  <div className="p-3 border-b border-border flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={exportToXlsx} className="gap-1.5 text-xs">
                      <Download className="h-3 w-3" /> Excel
                    </Button>
                    <Button size="sm" variant="outline" onClick={copyContent} className="gap-1.5 text-xs">
                      <Copy className="h-3 w-3" /> Копировать
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1.5 text-xs">
                      <Printer className="h-3 w-3" /> Печать
                    </Button>
                    <Button size="sm" variant={editingContent ? "default" : "outline"}
                      onClick={() => setEditingContent(!editingContent)}
                      className={`gap-1.5 text-xs ml-auto ${editingContent ? "gradient-primary text-white" : ""}`}>
                      <Edit3 className="h-3 w-3" /> {editingContent ? "Просмотр" : "Редактировать"}
                    </Button>
                  </div>

                  {/* Document content */}
                  <div className="flex-1 overflow-y-auto p-4">
                    {/* Summary */}
                    {generatedDoc.summary && (
                      <div className="bg-accent-soft border border-accent/30 rounded-xl p-3 mb-4 flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-accent font-medium">{generatedDoc.summary}</p>
                      </div>
                    )}

                    {editingContent ? (
                      <Textarea
                        value={editedContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        className="font-mono text-xs min-h-[400px] resize-none"
                      />
                    ) : (
                      <pre className="font-mono text-xs whitespace-pre-wrap text-foreground leading-relaxed bg-secondary/30 rounded-xl p-4 min-h-[300px]">
                        {editedContent || generatedDoc.content}
                      </pre>
                    )}

                    {/* Filled fields */}
                    {generatedDoc.filled_fields && Object.keys(generatedDoc.filled_fields).length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs font-semibold text-muted-foreground mb-2">Заполненные поля:</p>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(generatedDoc.filled_fields).map(([k, v]) => (
                            <div key={k} className="bg-secondary/50 rounded-lg p-2">
                              <div className="text-[10px] text-muted-foreground capitalize">{k.replace(/_/g, " ")}</div>
                              <div className="text-xs font-medium truncate">{v}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
