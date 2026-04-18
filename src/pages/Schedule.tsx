import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface Slot {
  id: string;
  day_of_week: string;
  period: number;
  time_label: string | null;
  class_name: string;
  subject_raw: string;
  teacher_raw: string | null;
  teacher_id: string | null;
  room: string | null;
}

const DAYS = ["mon", "tue", "wed", "thu", "fri"] as const;

export default function Schedule() {
  const { t } = useTranslation();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [activeClass, setActiveClass] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("schedule_slots").select("*").order("period");
      setSlots(data || []);
      const uniq = Array.from(new Set((data || []).map((s) => s.class_name))).sort();
      setClasses(uniq);
      setActiveClass(uniq[0] || "");
      setLoading(false);
    })();
  }, []);

  const grid = useMemo(() => {
    const g: Record<number, Record<string, Slot | undefined>> = {};
    slots.filter((s) => s.class_name === activeClass).forEach((s) => {
      if (!g[s.period]) g[s.period] = {};
      g[s.period][s.day_of_week] = s;
    });
    return g;
  }, [slots, activeClass]);

  const periods = Object.keys(grid).map(Number).sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-1">{t("schedule.title")}</h1>
        <p className="text-muted-foreground">{t("schedule.subtitle")}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>
      ) : (
        <>
          <div className="bg-card border border-border rounded-2xl p-4 shadow-soft">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("schedule.class")}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {classes.map((c) => (
                <button
                  key={c}
                  onClick={() => setActiveClass(c)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-smooth ${
                    activeClass === c ? "bg-primary text-primary-foreground shadow" : "bg-secondary text-foreground hover:bg-secondary/70"
                  }`}
                >{c}</button>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl shadow-soft overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-secondary/50">
                  <tr className="text-xs uppercase text-muted-foreground tracking-wider">
                    <th className="px-4 py-3 text-left font-medium w-20">{t("schedule.period")}</th>
                    {DAYS.map((d) => (
                      <th key={d} className="px-4 py-3 text-left font-medium">{t(`schedule.${d}`)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {periods.map((p) => (
                    <motion.tr key={p} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <td className="px-4 py-3 align-top">
                        <div className="font-display font-bold text-lg">{p}</div>
                        <div className="text-[10px] text-muted-foreground">{grid[p]?.[DAYS[0]]?.time_label}</div>
                      </td>
                      {DAYS.map((d) => {
                        const slot = grid[p]?.[d];
                        if (!slot) return <td key={d} />;
                        return (
                          <td key={d} className="px-2 py-2 align-top">
                            <div className="rounded-xl p-3 border border-border bg-secondary/30 hover:bg-secondary/50 transition-smooth">
                              <div className="text-xs font-semibold text-accent mb-1 truncate">{slot.subject_raw}</div>
                              <div className="text-sm font-medium truncate">{slot.teacher_raw || "—"}</div>
                              {slot.room && <div className="text-xs text-muted-foreground mt-1">№ {slot.room}</div>}
                            </div>
                          </td>
                        );
                      })}
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
