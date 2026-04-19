import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, Mic, MicOff, Sparkles, Download, AlertTriangle,
  Clock, Layers, Users, Zap, ChevronRight, RefreshCw, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { exportScheduleXlsx } from "@/lib/scheduleExport";
import { STAFF, SUBJECTS } from "@/lib/mockData";
import { toast } from "sonner";

interface Slot {
  class_name: string;
  period: number;
  subject: string;
  teacher: string;
  room: string;
  is_lens?: boolean;
  lens_group?: string;
  lens_level?: string;
}

interface LensBlock {
  period: number;
  parallel: string;
  subject: string;
  groups: {
    level: string;
    teacher: string;
    room: string;
    classes_included: string[];
  }[];
}

interface PeriodMeta { period_number: number; time_label: string; }

const DAY_LABEL: Record<string, string> = {
  mon: "Понедельник", tue: "Вторник", wed: "Среда", thu: "Четверг", fri: "Пятница",
};

const LEVEL_COLORS: Record<string, string> = {
  beginner: "bg-blue-100 text-blue-700 border-blue-300",
  pre_intermediate: "bg-green-100 text-green-700 border-green-300",
  intermediate: "bg-yellow-100 text-yellow-700 border-yellow-300",
  upper: "bg-purple-100 text-purple-700 border-purple-300",
  "": "bg-gray-100 text-gray-700 border-gray-300",
};

const QUICK_PROMPTS = [
  { label: "Пн", day: "mon", prompt: "Сгенерируй расписание на понедельник для всех классов" },
  { label: "Вт", day: "tue", prompt: "Сгенерируй расписание на вторник для всех классов" },
  { label: "Ср", day: "wed", prompt: "Сгенерируй расписание на среду для всех классов" },
  { label: "Чт", day: "thu", prompt: "Сгенерируй расписание на четверг для всех классов" },
  { label: "Пт", day: "fri", prompt: "Сгенерируй расписание на пятницу для всех классов" },
];

export default function Schedule() {
  const { t, i18n } = useTranslation();
  const [generating, setGenerating] = useState(false);
  const [prompt, setPrompt] = useState("Сгенерируй расписание на вторник для всех классов с системой лент для английского");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [lensBlocks, setLensBlocks] = useState<LensBlock[]>([]);
  const [periods, setPeriods] = useState<PeriodMeta[]>([]);
  const [day, setDay] = useState("tue");
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [aiNotes, setAiNotes] = useState("");
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [activeClass, setActiveClass] = useState<string>("");
  const [activeTeacher, setActiveTeacher] = useState<string>("");
  const [editCell, setEditCell] = useState<{ period: number; class_name: string } | null>(null);
  const [generationProgress, setGenerationProgress] = useState(0);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const lang = i18n.language === "kz" ? "kk-KZ" : i18n.language === "en" ? "en-US" : "ru-RU";
  const voice = useVoiceInput({
    lang,
    onFinal: (text) => {
      setPrompt((prev) => (prev ? prev + " " : "") + text);
      const t = text.toLowerCase();
      if (/сгенер|генерируй|сделай распис|generate schedule|create schedule/.test(t)) {
        setVoiceTrigger(true);
      }
    },
  });

  const [voiceTrigger, setVoiceTrigger] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("generated_schedules")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) hydrateFromRecord(data);
      const { data: p } = await supabase.from("school_periods").select("period_number,time_label").order("period_number");
      setPeriods(p || []);
    })();
  }, []);

  const hydrateFromRecord = (rec: any) => {
    const grid = rec.grid || {};
    const flatSlots: Slot[] = grid.slots || [];
    setSlots(flatSlots);
    setLensBlocks(grid.lens_blocks || []);
    setDay(rec.day_of_week);
    setConflicts(rec.conflicts || []);
    setAiNotes(rec.ai_notes || "");
    if (grid.periods_meta) setPeriods(grid.periods_meta);
    const cls = Array.from(new Set(flatSlots.map((s) => s.class_name))).sort() as string[];
    setActiveClass((prev) => prev && cls.includes(prev) ? prev : cls[0] || "");
    const tch = Array.from(new Set(flatSlots.map((s) => s.teacher))).sort() as string[];
    setActiveTeacher((prev) => prev && tch.includes(prev) ? prev : tch[0] || "");
  };

  const startProgressBar = () => {
    setGenerationProgress(0);
    let progress = 0;
    progressRef.current = setInterval(() => {
      // Simulate progress: fast to 70%, then slow
      if (progress < 70) progress += Math.random() * 8;
      else if (progress < 90) progress += Math.random() * 2;
      else progress += 0.1;
      setGenerationProgress(Math.min(progress, 95));
    }, 300);
  };

  const stopProgressBar = (success: boolean) => {
    if (progressRef.current) clearInterval(progressRef.current);
    setGenerationProgress(success ? 100 : 0);
    setTimeout(() => setGenerationProgress(0), 1500);
  };

  const generate = async () => {
    setGenerating(true);
    setConflicts([]);
    setAiNotes("");
    setElapsedMs(null);
    startProgressBar();

    const startedAt = Date.now();
    try {
      const { data, error } = await supabase.functions.invoke("generate-schedule", {
        body: { prompt, enable_lens: true },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const d = data as any;
      setSlots(d.slots || []);
      setLensBlocks(d.lens_blocks || []);
      setDay(d.day_of_week || "tue");
      setConflicts(d.conflicts || []);
      setAiNotes(d.ai_notes || "");
      setElapsedMs(d.elapsedMs || (Date.now() - startedAt));
      if (d.periods) setPeriods(d.periods);
      const cls = Array.from(new Set((d.slots || []).map((s: Slot) => s.class_name))).sort() as string[];
      setActiveClass(cls[0] || "");
      const tch = Array.from(new Set((d.slots || []).map((s: Slot) => s.teacher))).sort() as string[];
      setActiveTeacher(tch[0] || "");
      stopProgressBar(true);
      toast.success(`✅ Готово! ${d.slots?.length || 0} уроков, ${d.lens_blocks?.length || 0} лент — ${((d.elapsedMs || 0) / 1000).toFixed(1)}с`);
    } catch (e: any) {
        console.error('generate error', e);
        stopProgressBar(false);
        try {
          const msg = String(e?.message || e || 'Ошибка генерации');
          console.error('generate error full', e);
          // Always try demo fallback so UI remains usable when functions fail
          await demoGenerateAndDownload();
          toast.success('Использован локальный демонстрационный генератор (фолбэк)');
          console.warn('Original AI error:', msg);
        } catch (inner) {
          console.error('fallback demo error', inner);
          toast.error(e?.message || 'Ошибка генерации');
        }
    } finally {
      setGenerating(false);
    }
  };

  // When voice trigger is set, acknowledge and run generation
  useEffect(() => {
    if (!voiceTrigger) return;
    (async () => {
      try {
        // speak acknowledgement if available
        try {
          const msg = typeof window !== 'undefined' && (window as any).speechSynthesis ? new SpeechSynthesisUtterance('Принято, генерирую расписание') : null;
          if (msg) { msg.lang = lang; (window as any).speechSynthesis.cancel(); (window as any).speechSynthesis.speak(msg); }
        } catch (e) { /* no-op */ }
        // for faster demo: call demoGenerateAndDownload if running in mock mode
        const rawBase = (import.meta as any).env.VITE_SUPABASE_URL || (import.meta as any).env.VITE_MOCK_BASE || '';
        const base = String(rawBase).replace(/^\"|\"$/g, '');
        if (base.includes('localhost:8787')) {
          await demoGenerateAndDownload();
        } else {
          await generate();
        }
        try { const doneMsg = typeof window !== 'undefined' && (window as any).speechSynthesis ? new SpeechSynthesisUtterance('Готово') : null; if (doneMsg) { doneMsg.lang = lang; (window as any).speechSynthesis.speak(doneMsg); } } catch (e) { }
      } finally { setVoiceTrigger(false); }
    })();
  }, [voiceTrigger]);

  const downloadXlsx = () => {
    if (!slots.length) { toast.error("Сначала сгенерируйте расписание"); return; }
    exportScheduleXlsx({ day_of_week: DAY_LABEL[day] || day, slots, periods });
    toast.success("Расписание скачано");
  };

  const demoGenerateAndDownload = async () => {
    try {
      const rawBase = (import.meta as any).env.VITE_SUPABASE_URL || (import.meta as any).env.VITE_MOCK_BASE || '';
      const base = String(rawBase).replace(/^\"|\"$/g, '');
      // If a local mock server exists, prefer it; otherwise use three local mock variants
      let j: any = null;
      if (base.includes('localhost:8787')) {
        const res = await fetch(`${base}/functions/generate-schedule`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
        j = await res.json();
        if (!res.ok) { console.warn('mock server returned error', j); j = null; }
      }
      if (!j) {
        // choose random variant for variety
        const v = Math.floor(Math.random() * 3) + 1;
        // lazy import to avoid circular
        const { generateMockScheduleVariant } = await import('@/lib/mockData');
        j = generateMockScheduleVariant(v);
        j.filename = `schedule_${v}.csv`;
      }
      // populate UI
      setSlots(j.slots || []);
      setLensBlocks(j.lens_blocks || []);
      // download csv if doc provided
      if (j.doc) {
        const blob = new Blob([j.doc], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = j.filename || 'schedule.csv'; a.click(); URL.revokeObjectURL(url);
      }
      toast.success('Расписание сгенерировано');
    } catch (e: any) { toast.error(e.message || 'Ошибка демо'); }
  };

  const classes = useMemo(() => Array.from(new Set(slots.map((s) => s.class_name))).sort() as string[], [slots]);
  const teachers = useMemo(() => Array.from(new Set(slots.map((s) => s.teacher))).sort() as string[], [slots]);
  const periodNums = useMemo(() => Array.from(new Set(slots.map((s) => s.period))).sort((a, b) => a - b), [slots]);
  const periodMap = useMemo(() => new Map(periods.map((p) => [p.period_number, p.time_label])), [periods]);

  const teacherHeat = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of slots) m.set(s.teacher, (m.get(s.teacher) || 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [slots]);

  // Heatmap grid: class × period → slot
  const heatGrid = useMemo(() => {
    const grid = new Map<string, Map<number, Slot>>();
    for (const s of slots) {
      if (!grid.has(s.class_name)) grid.set(s.class_name, new Map());
      grid.get(s.class_name)!.set(s.period, s);
    }
    return grid;
  }, [slots]);

  const subjectColor = (subject: string): string => {
    const s = subject.toLowerCase();
    if (s.includes("матем") || s.includes("алгебр") || s.includes("геометр")) return "bg-blue-50 border-blue-200 text-blue-800";
    if (s.includes("физик")) return "bg-indigo-50 border-indigo-200 text-indigo-800";
    if (s.includes("хими")) return "bg-green-50 border-green-200 text-green-800";
    if (s.includes("биолог")) return "bg-emerald-50 border-emerald-200 text-emerald-800";
    if (s.includes("англ") || s.includes("ielts")) return "bg-sky-50 border-sky-200 text-sky-800";
    if (s.includes("казах") || s.includes("қазақ")) return "bg-yellow-50 border-yellow-200 text-yellow-800";
    if (s.includes("орыс") || s.includes("русск")) return "bg-orange-50 border-orange-200 text-orange-800";
    if (s.includes("тарих") || s.includes("истор")) return "bg-amber-50 border-amber-200 text-amber-800";
    if (s.includes("дене") || s.includes("физкульт") || s.includes("спорт")) return "bg-lime-50 border-lime-200 text-lime-800";
    return "bg-gray-50 border-gray-200 text-gray-800";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-1 flex items-center gap-3">
            Расписание
            {lensBlocks.length > 0 && (
              <Badge className="bg-purple-100 text-purple-700 border-purple-300 gap-1">
                <Layers className="h-3 w-3" /> {lensBlocks.length} лент
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground">AI-генерация ≤10 сек · Система лент · Экспорт в Excel</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={downloadXlsx} disabled={!slots.length} variant="outline" className="gap-2">
            <Download className="h-4 w-4" /> Скачать .xlsx
          </Button>
          <Button onClick={demoGenerateAndDownload} variant="ghost" className="gap-2">
            <Sparkles className="h-4 w-4" /> Демо: сгенерировать и скачать
          </Button>
                <div className="ml-4 text-xs text-muted-foreground">AI: подключение скрыто</div>
        </div>
      </div>

      {/* Generator Card */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-soft space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <h2 className="font-display text-lg font-bold">Голосовой генератор</h2>
          <div className="ml-auto flex items-center gap-2">
            {elapsedMs !== null && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <Clock className="h-3 w-3" />
                {(elapsedMs / 1000).toFixed(1)}с
              </Badge>
            )}
            {slots.length > 0 && (
              <Badge className="bg-accent-soft text-accent border-accent/30 gap-1 text-xs">
                <CheckCircle2 className="h-3 w-3" />
                {slots.length} уроков
              </Badge>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {generating && (
          <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 gradient-success rounded-full"
              animate={{ width: `${generationProgress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        )}

        <div className="relative">
          <textarea
            value={prompt + (voice.interim ? ` ${voice.interim}` : "")}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            placeholder="Скажите: «Сгенерируй расписание на среду с лентами по английскому для 7-х классов»"
            className="w-full rounded-xl border border-border bg-background p-3 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            disabled={generating}
          />
          {voice.supported && (
            <button
              onClick={voice.state === "listening" ? voice.stop : voice.start}
              disabled={generating}
              className={`absolute right-3 top-3 h-10 w-10 rounded-full flex items-center justify-center transition-smooth ${
                voice.state === "listening"
                  ? "bg-destructive text-destructive-foreground animate-pulse"
                  : "bg-accent text-accent-foreground hover:scale-110"
              }`}
            >
              {voice.state === "listening" ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
          )}
        </div>

        {/* Quick day buttons */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={generate} disabled={generating} className="gap-2 gradient-primary text-white">
            {generating
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Генерация...</>
              : <><Zap className="h-4 w-4" /> Сгенерировать</>
            }
          </Button>
          {QUICK_PROMPTS.map((qp) => (
            <button
              key={qp.day}
              onClick={() => { setPrompt(qp.prompt); }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary hover:bg-secondary/70 transition-smooth"
            >
              {qp.label}
            </button>
          ))}
          {slots.length > 0 && (
            <button
              onClick={generate}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent-soft text-accent hover:bg-accent/20 transition-smooth flex items-center gap-1 ml-auto"
            >
              <RefreshCw className="h-3 w-3" /> Обновить
            </button>
          )}
        </div>

        {voice.state === "listening" && (
          <p className="text-xs text-accent flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
            Слушаю... говорите команду
          </p>
        )}

        {aiNotes && (
          <div className="text-xs text-muted-foreground border-l-2 border-accent pl-3 whitespace-pre-line bg-accent-soft/30 rounded-r-lg p-2">
            {aiNotes}
          </div>
        )}

        {conflicts.length > 0 && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-3 space-y-1">
            <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
              <AlertTriangle className="h-4 w-4" /> {conflicts.length} конфликт(ов)
            </div>
            {conflicts.slice(0, 3).map((c, i) => (
              <div key={i} className="text-xs text-destructive/90">• {c}</div>
            ))}
            {conflicts.length > 3 && <div className="text-xs text-destructive/70">+ещё {conflicts.length - 3}</div>}
          </div>
        )}
      </div>

      {/* Lens Blocks Visualization */}
      {lensBlocks.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-purple-200 rounded-2xl p-5 shadow-soft">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="h-5 w-5 text-purple-600" />
            <h2 className="font-display text-lg font-bold text-purple-800">Система лент</h2>
            <Badge className="bg-purple-100 text-purple-700 border-purple-300 ml-auto">
              {lensBlocks.length} блок(ов)
            </Badge>
          </div>
          <div className="space-y-3">
            {lensBlocks.map((lb, i) => (
              <div key={i} className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-purple-800">
                    Урок {lb.period} · {lb.parallel} параллель · {lb.subject}
                  </span>
                  <Badge variant="outline" className="text-purple-600 border-purple-300 text-xs">
                    <Users className="h-3 w-3 mr-1" />
                    {lb.groups.reduce((s, g) => s + g.classes_included.length, 0)} классов
                  </Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {lb.groups.map((g, j) => (
                    <div key={j} className={`rounded-lg p-2 border text-xs ${LEVEL_COLORS[g.level] || LEVEL_COLORS[""]}`}>
                      <div className="font-bold capitalize mb-1">{g.level || "Группа " + (j + 1)}</div>
                      <div className="opacity-80">{g.teacher}</div>
                      <div className="opacity-60">каб. {g.room}</div>
                      <div className="mt-1 flex flex-wrap gap-0.5">
                        {g.classes_included.map((c) => (
                          <span key={c} className="bg-white/60 rounded px-1">{c}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-purple-600 mt-3 flex items-center gap-1">
            <ChevronRight className="h-3 w-3" />
            В эти периоды параллельные классы объединяются и делятся по уровням знаний
          </p>
        </motion.div>
      )}

      {/* Schedule Views */}
      {slots.length > 0 && (
        <Tabs defaultValue="grid" className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="grid">Сетка</TabsTrigger>
            <TabsTrigger value="byclass">По классам</TabsTrigger>
            <TabsTrigger value="byteacher">По учителям</TabsTrigger>
            <TabsTrigger value="heatmap">Нагрузка</TabsTrigger>
          </TabsList>

          {/* Full Grid View */}
          <TabsContent value="grid">
            <div className="bg-card border border-border rounded-2xl shadow-soft overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-xs">
                  <thead className="bg-secondary/50">
                    <tr>
                      <th className="px-3 py-3 text-left font-semibold text-muted-foreground w-20">Урок</th>
                      <th className="px-2 py-3 text-left font-semibold text-muted-foreground w-24">Время</th>
                      {classes.slice(0, 10).map((c) => (
                        <th key={c} className="px-2 py-3 text-center font-semibold text-muted-foreground min-w-[90px]">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {periodNums.map((p) => (
                      <tr key={p} className="hover:bg-secondary/20">
                        <td className="px-3 py-2 font-display font-bold text-lg">{p}</td>
                        <td className="px-2 py-2 text-muted-foreground whitespace-nowrap">{periodMap.get(p) || ""}</td>
                        {classes.slice(0, 10).map((c) => {
                          const s = heatGrid.get(c)?.get(p);
                          return (
                            <td key={c} className="px-1 py-1">
                              <div
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={async (e) => {
                                  e.preventDefault();
                                  // If dropping existing slot id, try server update
                                  const slotId = e.dataTransfer.getData('text/slot-id');
                                  if (slotId) {
                                    try {
                                      const res = await fetch(`${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/update-slot`, {
                                        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY || '' },
                                        body: JSON.stringify({ slot_id: slotId, new_period: p, new_class: c }),
                                      });
                                      const j = await res.json();
                                      if (res.ok) {
                                        toast.success('Слот перемещён');
                                        await generate();
                                      } else toast.error(JSON.stringify(j));
                                    } catch (err: any) { toast.error(err?.message || 'Ошибка'); }
                                    return;
                                  }
                                  // If dropping a lesson object (from available lessons), create locally
                                  const lessonJson = e.dataTransfer.getData('text/lesson');
                                  if (lessonJson) {
                                    try {
                                      const lesson = JSON.parse(lessonJson);
                                      // replace or add slot locally
                                      setSlots((prev) => {
                                        const others = prev.filter((s) => !(s.period === p && s.class_name === c));
                                        return [...others, { class_name: c, period: p, subject: lesson.subject, teacher: lesson.teacher, room: lesson.room || 'TBD' }];
                                      });
                                      toast.success('Урок добавлен');
                                    } catch (err) { console.error('drop lesson parse', err); }
                                  }
                                }}
                                onClick={() => setEditCell({ period: p, class_name: c })}
                              >
                                {s ? (
                                  <div draggable={!!s.id} onDragStart={(ev) => { if (s.id) ev.dataTransfer.setData('text/slot-id', s.id); }} className={`rounded-lg p-1.5 border text-center ${s.is_lens ? "bg-purple-50 border-purple-200" : subjectColor(s.subject)}`}>
                                    <div className="font-semibold text-xs leading-tight truncate">{s.subject}</div>
                                    <div className="text-[10px] opacity-70 truncate">{s.teacher.split(" ")[0]}</div>
                                    <div className="text-[10px] opacity-60">к.{s.room}</div>
                                    {s.is_lens && <div className="text-[10px] text-purple-600 font-bold">🔗лента</div>}
                                  </div>
                                ) : (
                                  <div className="rounded-lg p-1.5 text-center text-[10px] text-muted-foreground">—</div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {classes.length > 10 && (
                  <div className="px-4 py-2 text-xs text-muted-foreground bg-secondary/30">
                    Показано 10 из {classes.length} классов. Переключитесь на «По классам» для просмотра всех.
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* By Class */}
          <TabsContent value="byclass" className="space-y-4">
            <div className="bg-card border border-border rounded-2xl p-4 shadow-soft">
              <div className="flex flex-wrap gap-2">
                {classes.map((c) => (
                  <button key={c} onClick={() => setActiveClass(c)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-smooth ${
                      activeClass === c ? "bg-primary text-primary-foreground shadow" : "bg-secondary text-foreground hover:bg-secondary/70"
                    }`}>
                    {c}
                  </button>
                ))}
              </div>
              {/* Lesson editor modal */}
              {editCell && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-black/40" onClick={() => setEditCell(null)} />
                  <div className="bg-card rounded-2xl p-6 shadow-lg z-10 w-full max-w-lg">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold">Редактировать урок — {editCell.class_name} · {editCell.period} урок</h3>
                      <button onClick={() => setEditCell(null)} className="text-sm text-muted-foreground">Закрыть</button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-muted-foreground mb-2">Доступные предметы</div>
                        <div className="space-y-2 max-h-56 overflow-y-auto">
                          {SUBJECTS.map((sub) => (
                            <div key={sub} draggable onDragStart={(e) => e.dataTransfer.setData('text/lesson', JSON.stringify({ subject: sub, teacher: STAFF.find(s=>s.subject===sub)?.name || 'TBD', room: 'TBD' }))}
                              className="p-2 rounded border hover:bg-secondary/50 cursor-grab">
                              {sub} — {STAFF.find(s=>s.subject===sub)?.name || 'TBD'}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-2">Доступные учителя</div>
                        <div className="space-y-2 max-h-56 overflow-y-auto">
                          {STAFF.map((t) => (
                            <div key={t.id} className="p-2 rounded border hover:bg-secondary/50 cursor-pointer" onClick={() => {
                              // create slot with first subject of teacher
                              const subject = t.subject || SUBJECTS[0];
                              setSlots((prev) => {
                                const others = prev.filter((s) => !(s.period === editCell.period && s.class_name === editCell.class_name));
                                return [...others, { class_name: editCell.class_name, period: editCell.period, subject, teacher: t.name, room: 'TBD' }];
                              });
                              setEditCell(null);
                              toast.success('Урок добавлен');
                            }}>{t.name} — {t.subject}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <button className="px-3 py-2 rounded-lg bg-destructive text-white" onClick={() => {
                        // remove slot
                        setSlots((prev) => prev.filter(s => !(s.period === editCell.period && s.class_name === editCell.class_name)));
                        setEditCell(null);
                        toast.success('Урок удалён');
                      }}>Удалить</button>
                      <button className="px-3 py-2 rounded-lg bg-primary text-white" onClick={() => setEditCell(null)}>Готово</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="bg-card border border-border rounded-2xl shadow-soft overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px]">
                  <thead className="bg-secondary/50">
                    <tr className="text-xs uppercase text-muted-foreground tracking-wider">
                      <th className="px-4 py-3 text-left font-medium w-16">№</th>
                      <th className="px-4 py-3 text-left font-medium w-28">Время</th>
                      <th className="px-4 py-3 text-left font-medium">Предмет</th>
                      <th className="px-4 py-3 text-left font-medium">Учитель</th>
                      <th className="px-4 py-3 text-left font-medium w-20">Каб.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <AnimatePresence>
                      {periodNums.map((p) => {
                        const s = slots.find((x) => x.period === p && x.class_name === activeClass);
                        return (
                          <motion.tr key={p} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                            className={s?.is_lens ? "bg-purple-50/50" : "hover:bg-secondary/20"}>
                            <td className="px-4 py-3 font-display font-bold text-lg">{p}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{periodMap.get(p) || ""}</td>
                            {s ? (
                              <>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${subjectColor(s.subject)}`}>
                                      {s.subject}
                                    </span>
                                    {s.is_lens && (
                                      <Badge className="bg-purple-100 text-purple-700 border-purple-300 text-[10px] px-1">
                                        <Layers className="h-2.5 w-2.5 mr-0.5" />
                                        {s.lens_level || "лента"}
                                      </Badge>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-sm">{s.teacher}</td>
                                <td className="px-4 py-3 text-sm font-mono">{s.room}</td>
                              </>
                            ) : (
                              <td colSpan={3} className="px-4 py-3 text-xs text-muted-foreground italic">— окно —</td>
                            )}
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* By Teacher */}
          <TabsContent value="byteacher" className="space-y-4">
            <div className="bg-card border border-border rounded-2xl p-4 shadow-soft">
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {teachers.map((tn) => (
                  <button key={tn} onClick={() => setActiveTeacher(tn)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-smooth ${
                      activeTeacher === tn ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/70"
                    }`}>
                    {tn}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-card border border-border rounded-2xl shadow-soft overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px]">
                  <thead className="bg-secondary/50">
                    <tr className="text-xs uppercase text-muted-foreground tracking-wider">
                      <th className="px-4 py-3 text-left font-medium w-16">№</th>
                      <th className="px-4 py-3 text-left font-medium w-28">Время</th>
                      <th className="px-4 py-3 text-left font-medium">Класс</th>
                      <th className="px-4 py-3 text-left font-medium">Предмет</th>
                      <th className="px-4 py-3 text-left font-medium w-20">Каб.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {periodNums.map((p) => {
                      const teacherSlots = slots.filter((x) => x.period === p && x.teacher === activeTeacher);
                      if (teacherSlots.length === 0) {
                        return (
                          <tr key={p}>
                            <td className="px-4 py-3 font-display font-bold text-lg">{p}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{periodMap.get(p) || ""}</td>
                            <td colSpan={3} className="px-4 py-3 text-xs text-muted-foreground italic">— окно —</td>
                          </tr>
                        );
                      }
                      return teacherSlots.map((s, idx) => (
                        <tr key={`${p}-${idx}`} className={s.is_lens ? "bg-purple-50/50" : ""}>
                          {idx === 0 && <td className="px-4 py-3 font-display font-bold text-lg" rowSpan={teacherSlots.length}>{p}</td>}
                          {idx === 0 && <td className="px-4 py-3 text-xs text-muted-foreground" rowSpan={teacherSlots.length}>{periodMap.get(p) || ""}</td>}
                          <td className="px-4 py-3 font-semibold">{s.class_name}</td>
                          <td className="px-4 py-3 text-sm text-accent">{s.subject}</td>
                          <td className="px-4 py-3 text-sm font-mono">{s.room}</td>
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* Heatmap / Load */}
          <TabsContent value="heatmap">
            <div className="bg-card border border-border rounded-2xl p-5 shadow-soft">
              <h3 className="font-display font-bold mb-4 flex items-center gap-2">
                Тепловая карта нагрузки учителей
                <Badge variant="outline" className="text-xs">{teacherHeat.length} учителей</Badge>
              </h3>
              <div className="space-y-2">
                {teacherHeat.map(([name, count]) => {
                  const max = teacherHeat[0]?.[1] || 1;
                  const pct = (count / max) * 100;
                  const color = count >= 6 ? "bg-destructive" : count >= 4 ? "bg-orange-500" : "bg-emerald-500";
                  const label = count >= 6 ? "⚠ Перегрузка" : count >= 4 ? "Норма" : "Свободен";
                  return (
                    <div key={name} className="flex items-center gap-3">
                      <div className="w-44 text-sm truncate" title={name}>{name}</div>
                      <div className="flex-1 h-7 bg-secondary rounded-lg overflow-hidden relative">
                        <motion.div
                          className={`h-full ${color} rounded-lg flex items-center px-2`}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.5 }}
                        >
                          {pct > 30 && (
                            <span className="text-white text-xs font-semibold">{count} ур.</span>
                          )}
                        </motion.div>
                      </div>
                      <div className="w-24 text-right text-xs text-muted-foreground">{label}</div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-emerald-500" /> ≤3 урока</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-orange-500" /> 4–5 уроков</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-destructive" /> ≥6 (перегрузка)</span>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {!slots.length && !generating && (
        <div className="text-center py-20 text-muted-foreground">
          <div className="h-20 w-20 rounded-2xl bg-accent-soft flex items-center justify-center mx-auto mb-4">
            <Zap className="h-10 w-10 text-accent" />
          </div>
          <p className="text-base font-semibold mb-2">Нажмите 🎤 и скажите команду</p>
          <p className="text-sm opacity-70">«Сгенерируй расписание на среду с лентами по английскому»</p>
          <p className="text-xs opacity-50 mt-4">Генерация занимает ≤10 секунд</p>
        </div>
      )}
    </div>
  );
}
