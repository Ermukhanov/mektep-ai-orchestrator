import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { SCHEDULE, STAFF, Teacher } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Sparkles, UserX, Check, X } from "lucide-react";
import { toast } from "sonner";

export default function Schedule() {
  const { t } = useTranslation();
  const days = ["mon", "tue", "wed", "thu", "fri"] as const;
  const periods = [1, 2, 3, 4, 5];
  const [absent, setAbsent] = useState<Set<string>>(new Set());
  const [substitutions, setSubstitutions] = useState<Record<string, string>>({});
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);

  const findSubstitute = (absentTeacher: Teacher, day: string, period: number): Teacher | null => {
    const busy = SCHEDULE.filter((s) => s.day === day && s.period === period).map((s) => s.teacherId);
    const candidates = STAFF.filter((t) => t.id !== absentTeacher.id && !busy.includes(t.id));
    // Prefer same subject
    return candidates.find((c) => c.subject === absentTeacher.subject) || candidates[0] || null;
  };

  const reportAbsence = (teacher: Teacher) => {
    setAbsent((prev) => new Set(prev).add(teacher.id));
    setSelectedTeacher(teacher);
    toast.info(`${teacher.name} marked absent`, { description: "AI is finding substitutes..." });
  };

  const confirmSub = (slotKey: string, subId: string) => {
    setSubstitutions((p) => ({ ...p, [slotKey]: subId }));
    toast.success("Substitute confirmed");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-1">{t("schedule.title")}</h1>
        <p className="text-muted-foreground">{t("schedule.subtitle")}</p>
      </div>

      {/* Staff list */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-soft">
        <h2 className="font-display text-lg font-bold mb-4">Staff</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {STAFF.map((tch) => {
            const isAbsent = absent.has(tch.id);
            return (
              <div key={tch.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-smooth ${isAbsent ? "border-destructive/30 bg-destructive/5" : "border-border"}`}>
                <div className={`h-11 w-11 rounded-full flex items-center justify-center text-white font-semibold text-sm ${isAbsent ? "bg-destructive" : "gradient-success"}`}>
                  {tch.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{tch.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{tch.subject}</div>
                </div>
                {!isAbsent ? (
                  <Button variant="ghost" size="sm" onClick={() => reportAbsence(tch)} className="text-destructive hover:bg-destructive/10">
                    <UserX className="h-4 w-4" />
                  </Button>
                ) : (
                  <span className="text-xs font-semibold text-destructive px-2">{t("schedule.absent")}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Schedule grid */}
      <div className="bg-card border border-border rounded-2xl shadow-soft overflow-hidden">
        <div className="p-6 border-b border-border">
          <h2 className="font-display text-xl font-bold">Weekly Grid</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="bg-secondary/50">
              <tr className="text-xs uppercase text-muted-foreground tracking-wider">
                <th className="px-4 py-3 text-left font-medium">Period</th>
                {days.map((d) => (
                  <th key={d} className="px-4 py-3 text-left font-medium">{t(`schedule.${d}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {periods.map((p) => (
                <tr key={p}>
                  <td className="px-4 py-3 font-display font-semibold text-sm">{p}</td>
                  {days.map((d) => {
                    const slot = SCHEDULE.find((s) => s.day === d && s.period === p);
                    if (!slot) return <td key={d} />;
                    const teacher = STAFF.find((t) => t.id === slot.teacherId)!;
                    const isAbsent = absent.has(teacher.id);
                    const slotKey = `${d}-${p}`;
                    const subId = substitutions[slotKey];
                    const sub = subId ? STAFF.find((s) => s.id === subId) : null;
                    const suggested = isAbsent && !sub ? findSubstitute(teacher, d, p) : null;

                    return (
                      <td key={d} className="px-4 py-3 align-top">
                        <div className={`rounded-xl p-3 border transition-smooth ${isAbsent && !sub ? "border-destructive/40 bg-destructive/5" : sub ? "border-accent/40 bg-accent-soft" : "border-border bg-secondary/30"}`}>
                          <div className="text-xs font-semibold text-muted-foreground mb-1">{slot.class} · {slot.subject}</div>
                          {sub ? (
                            <>
                              <div className="text-sm line-through text-muted-foreground">{teacher.name}</div>
                              <div className="text-sm font-semibold text-accent flex items-center gap-1">
                                <Check className="h-3 w-3" /> {sub.name}
                              </div>
                            </>
                          ) : isAbsent ? (
                            <>
                              <div className="text-sm line-through text-muted-foreground mb-2">{teacher.name}</div>
                              {suggested && (
                                <div className="bg-card rounded-lg p-2 border border-accent/30">
                                  <div className="flex items-center gap-1 text-[10px] font-semibold text-accent uppercase mb-1">
                                    <Sparkles className="h-3 w-3" /> {t("schedule.suggestion")}
                                  </div>
                                  <div className="text-sm font-semibold mb-2">{suggested.name}</div>
                                  <Button size="sm" onClick={() => confirmSub(slotKey, suggested.id)} className="w-full h-7 text-xs gradient-success text-white">
                                    {t("schedule.confirmSub")}
                                  </Button>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="text-sm font-semibold">{teacher.name}</div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
