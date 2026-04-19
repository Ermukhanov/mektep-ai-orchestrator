import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Mic, MicOff, Sparkles, Download, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { exportScheduleXlsx } from "@/lib/scheduleExport";
import { toast } from "sonner";

interface GenSlot {
  class_name: string;
  period: number;
  subject: string;
  teacher: string;
  room: string;
}

interface PeriodMeta { period_number: number; time_label: string; }

const DAY_LABEL: Record<string, string> = {
  mon: "Понедельник", tue: "Вторник", wed: "Среда", thu: "Четверг", fri: "Пятница",
};

export default function Schedule() {
  const { t, i18n } = useTranslation();
  const [generating, setGenerating] = useState(false);
  const [prompt, setPrompt] = useState("Сгенерируй расписание на вторник для всех классов");
  const [slots, setSlots] = useState<GenSlot[]>([]);
  const [periods, setPeriods] = useState<PeriodMeta[]>([]);
  const [day, setDay] = useState("tue");
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [aiNotes, setAiNotes] = useState("");
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [activeClass, setActiveClass] = useState<string>("");
  const [activeTeacher, setActiveTeacher] = useState<string>("");

  const lang = i18n.language === "kz" ? "kk-KZ" : i18n.language === "en" ? "en-US" : "ru-RU";
  const voice = useVoiceInput({
    lang,
    onFinal: (text) => setPrompt((prev) => (prev ? prev + " " : "") + text),
  });

  // Load most recent generated schedule on mount
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("generated_schedules")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) hydrateFromRecord(data);
      const { data: p } = await supabase.from("school_periods").select("period_number, time_label").order("period_number");
      setPeriods(p || []);
    })();
  }, []);

  const hydrateFromRecord = (rec: any) => {
    const grid = rec.grid || {};
    const flatSlots: GenSlot[] = grid.slots || [];
    setSlots(flatSlots);
    setDay(rec.day_of_week);
    setConflicts(rec.conflicts || []);
    setAiNotes(rec.ai_notes || "");
    if (grid.periodsMeta) setPeriods(grid.periodsMeta);
    const cls = Array.from(new Set(flatSlots.map((s) => s.class_name))).sort();
    setActiveClass((prev) => prev && cls.includes(prev) ? prev : cls[0] || "");
    const tch = Array.from(new Set(flatSlots.map((s) => s.teacher))).sort();
    setActiveTeacher((prev) => prev && tch.includes(prev) ? prev : tch[0] || "");
  };

  const generate = async () => {
    setGenerating(true);
    setConflicts([]);
    setAiNotes("");
    setElapsedMs(null);
    const startedAt = Date.now();
    try {
      const { data, error } = await supabase.functions.invoke("generate-schedule", {
        body: { prompt },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const d = data as any;
      setSlots(d.slots || []);
      setDay(d.day_of_week || "tue");
      setConflicts(d.conflicts || []);
      setAiNotes(d.ai_notes || "");
      setElapsedMs(d.elapsedMs || (Date.now() - startedAt));
      if (d.periods) setPeriods(d.periods);
      const cls = Array.from(new Set((d.slots || []).map((s: GenSlot) => s.class_name))).sort() as string[];
      setActiveClass(cls[0] || "");
      const tch = Array.from(new Set((d.slots || []).map((s: GenSlot) => s.teacher))).sort() as string[];
      setActiveTeacher(tch[0] || "");
      toast.success(`Готово! ${d.slots?.length || 0} уроков за ${((d.elapsedMs || 0) / 1000).toFixed(1)}с`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Ошибка генерации");
    } finally {
      setGenerating(false);
    }
  };

  const downloadXlsx = () => {
    if (!slots.length) {
      toast.error("Сначала сгенерируйте расписание");
      return;
    }
    exportScheduleXlsx({ day_of_week: DAY_LABEL[day] || day, slots, periods });
    toast.success("Расписание скачано");
  };

  const classes = useMemo(() => Array.from(new Set(slots.map((s) => s.class_name))).sort(), [slots]);
  const teachers = useMemo(() => Array.from(new Set(slots.map((s) => s.teacher))).sort(), [slots]);
  const periodNums = useMemo(() => Array.from(new Set(slots.map((s) => s.period))).sort((a, b) => a - b), [slots]);
  const periodMap = useMemo(() => new Map(periods.map((p) => [p.period_number, p.time_label])), [periods]);

  // Heatmap of teacher load
  const teacherHeat = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of slots) m.set(s.teacher, (m.get(s.teacher) || 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [slots]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-1">Расписание</h1>
          <p className="text-muted-foreground">AI-генератор расписания за ~10 секунд</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={downloadXlsx} disabled={!slots.length} variant="outline" className="gap-2">
            <Download className="h-4 w-4" /> Скачать .xlsx
          </Button>
        </div>
      </div>

      {/* AI generator card */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-soft space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent" />
          <h2 className="font-display text-lg font-bold">Голосовая команда</h2>
          {elapsedMs !== null && (
            <Badge variant="secondary" className="ml-auto gap-1">
              <Clock className="h-3 w-3" /> {(elapsedMs / 1000).toFixed(1)}с
            </Badge>
          )}
        </div>

        <div className="relative">
          <textarea
            value={prompt + (voice.interim ? ` ${voice.interim}` : "")}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="Например: Сгенерируй расписание на вторник для всех 11 классов"
            className="w-full rounded-xl border border-border bg-background p-3 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
          />
          {voice.supported && (
            <button
              onClick={voice.state === "listening" ? voice.stop : voice.start}
              className={`absolute right-3 top-3 h-10 w-10 rounded-full flex items-center justify-center transition-smooth ${
                voice.state === "listening"
                  ? "bg-destructive text-destructive-foreground animate-pulse"
                  : "bg-accent text-accent-foreground hover:scale-110"
              }`}
              aria-label="Голосовой ввод"
            >
              {voice.state === "listening" ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={generate} disabled={generating} className="gap-2">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? "Генерация..." : "Сгенерировать"}
          </Button>
          {(["mon", "tue", "wed", "thu", "fri"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setPrompt(`Сгенерируй расписание на ${DAY_LABEL[d].toLowerCase()}`)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary hover:bg-secondary/70 transition-smooth"
            >
              {DAY_LABEL[d]}
            </button>
          ))}
        </div>

        {voice.state === "listening" && (
          <p className="text-xs text-accent flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
            Слушаю...
          </p>
        )}

        {aiNotes && (
          <div className="text-xs text-muted-foreground border-l-2 border-accent pl-3 whitespace-pre-line">
            {aiNotes}
          </div>
        )}

        {conflicts.length > 0 && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-3 space-y-1">
            <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
              <AlertTriangle className="h-4 w-4" /> Конфликты ({conflicts.length})
            </div>
            {conflicts.map((c, i) => (
              <div key={i} className="text-xs text-destructive/90">{c}</div>
            ))}
          </div>
        )}
      </div>

      {/* Schedule views */}
      {slots.length > 0 && (
        <Tabs defaultValue="byclass" className="space-y-4">
          <TabsList>
            <TabsTrigger value="byclass">По классам</TabsTrigger>
            <TabsTrigger value="byteacher">По учителям</TabsTrigger>
            <TabsTrigger value="heatmap">Нагрузка</TabsTrigger>
          </TabsList>

          {/* By class */}
          <TabsContent value="byclass" className="space-y-4">
            <div className="bg-card border border-border rounded-2xl p-4 shadow-soft">
              <div className="flex flex-wrap gap-2">
                {classes.map((c) => (
                  <button
                    key={c}
                    onClick={() => setActiveClass(c)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-smooth ${
                      activeClass === c
                        ? "bg-primary text-primary-foreground shadow"
                        : "bg-secondary text-foreground hover:bg-secondary/70"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl shadow-soft overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead className="bg-secondary/50">
                    <tr className="text-xs uppercase text-muted-foreground tracking-wider">
                      <th className="px-4 py-3 text-left font-medium w-20">Урок</th>
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
                          <motion.tr key={p} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
                            <td className="px-4 py-3 font-display font-bold text-lg">{p}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{periodMap.get(p) || ""}</td>
                            {s ? (
                              <>
                                <td className="px-4 py-3 font-semibold text-accent">{s.subject}</td>
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

          {/* By teacher */}
          <TabsContent value="byteacher" className="space-y-4">
            <div className="bg-card border border-border rounded-2xl p-4 shadow-soft">
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                {teachers.map((tn) => (
                  <button
                    key={tn}
                    onClick={() => setActiveTeacher(tn)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-smooth ${
                      activeTeacher === tn
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-foreground hover:bg-secondary/70"
                    }`}
                  >
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
                      <th className="px-4 py-3 text-left font-medium w-20">Урок</th>
                      <th className="px-4 py-3 text-left font-medium w-28">Время</th>
                      <th className="px-4 py-3 text-left font-medium">Класс</th>
                      <th className="px-4 py-3 text-left font-medium">Предмет</th>
                      <th className="px-4 py-3 text-left font-medium w-20">Каб.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {periodNums.map((p) => {
                      const s = slots.find((x) => x.period === p && x.teacher === activeTeacher);
                      return (
                        <tr key={p}>
                          <td className="px-4 py-3 font-display font-bold text-lg">{p}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{periodMap.get(p) || ""}</td>
                          {s ? (
                            <>
                              <td className="px-4 py-3 font-semibold">{s.class_name}</td>
                              <td className="px-4 py-3 text-sm text-accent">{s.subject}</td>
                              <td className="px-4 py-3 text-sm font-mono">{s.room}</td>
                            </>
                          ) : (
                            <td colSpan={3} className="px-4 py-3 text-xs text-muted-foreground italic">— окно —</td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* Heatmap */}
          <TabsContent value="heatmap">
            <div className="bg-card border border-border rounded-2xl p-5 shadow-soft">
              <h3 className="font-display font-bold mb-3">Тепловая карта нагрузки учителей</h3>
              <div className="space-y-2">
                {teacherHeat.map(([name, count]) => {
                  const max = teacherHeat[0]?.[1] || 1;
                  const pct = (count / max) * 100;
                  const color = count >= 6 ? "bg-destructive" : count >= 4 ? "bg-orange-500" : "bg-emerald-500";
                  return (
                    <div key={name} className="flex items-center gap-3">
                      <div className="w-48 text-sm truncate">{name}</div>
                      <div className="flex-1 h-6 bg-secondary rounded-md overflow-hidden">
                        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="w-16 text-right text-sm font-mono font-semibold">{count} ур.</div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-emerald-500" /> ≤3</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-orange-500" /> 4–5</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-destructive" /> ≥6 (перегрузка)</span>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {!slots.length && !generating && (
        <div className="text-center py-16 text-muted-foreground">
          <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Нажмите 🎤 и скажите: «Сгенерируй расписание на вторник»</p>
        </div>
      )}
    </div>
  );
}
