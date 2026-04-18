import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useApp } from "@/store/appStore";
import { supabase } from "@/integrations/supabase/client";
import { Users, AlertTriangle, UserCheck, MessageCircle, ListChecks, TrendingUp } from "lucide-react";

function StatCard({ icon: Icon, label, value, sub, delay = 0, gradient = false }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className={`relative overflow-hidden rounded-2xl border border-border p-6 shadow-soft transition-smooth hover:shadow-lg hover:-translate-y-0.5 ${
        gradient ? "gradient-primary text-primary-foreground" : "bg-card"
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${gradient ? "bg-white/10" : "bg-accent-soft"}`}>
          <Icon className={`h-5 w-5 ${gradient ? "text-white" : "text-accent"}`} />
        </div>
      </div>
      <div className={`text-3xl font-display font-bold mb-1 ${gradient ? "text-white" : ""}`}>{value}</div>
      <div className={`text-sm ${gradient ? "text-white/70" : "text-muted-foreground"}`}>{label}</div>
      {sub && <div className={`text-xs mt-2 ${gradient ? "text-white/60" : "text-muted-foreground"}`}>{sub}</div>}
    </motion.div>
  );
}

interface AttendanceRow {
  class_name: string;
  present: number;
  absent: number;
  reported_by_name: string | null;
  created_at: string;
}

interface ChatRow {
  id: string;
  text: string;
  sender_name: string;
  created_at: string;
  source: string;
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { profile } = useApp();
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [feed, setFeed] = useState<ChatRow[]>([]);
  const [counts, setCounts] = useState({ incidents: 0, subs: 0, pending: 0 });

  const today = new Date().toISOString().slice(0, 10);

  const refresh = async () => {
    const [{ data: att }, { data: chat }, { count: incCount }, { count: subCount }, { count: pendCount }] =
      await Promise.all([
        supabase.from("attendance_reports").select("class_name, present, absent, reported_by_name, created_at")
          .eq("report_date", today).order("created_at", { ascending: false }),
        supabase.from("chat_messages").select("id, text, sender_name, created_at, source")
          .order("created_at", { ascending: false }).limit(20),
        supabase.from("incidents").select("*", { count: "exact", head: true }).neq("status", "resolved"),
        supabase.from("substitutions").select("*", { count: "exact", head: true }).eq("for_date", today),
        supabase.from("pending_actions").select("*", { count: "exact", head: true }).eq("status", "pending"),
      ]);
    setAttendance(att || []);
    setFeed(chat || []);
    setCounts({ incidents: incCount || 0, subs: subCount || 0, pending: pendCount || 0 });
  };

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel("dash")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_reports" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "incidents" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "pending_actions" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const totals = useMemo(() => {
    const present = attendance.reduce((s, a) => s + a.present, 0);
    const absent = attendance.reduce((s, a) => s + a.absent, 0);
    return { present, absent, total: present + absent };
  }, [attendance]);

  const firstName = profile?.full_name?.split(" ")[0] || "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-1">
          {t("dashboard.greeting", { name: firstName })}
        </h1>
        <p className="text-muted-foreground">{t("dashboard.subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label={t("dashboard.attendance")} value={totals.total ? `${totals.present}/${totals.total}` : "—"} sub={`${attendance.length} ${t("dashboard.classes")}`} delay={0} gradient />
        <StatCard icon={AlertTriangle} label={t("dashboard.incidents")} value={counts.incidents} sub={t("dashboard.openIncidents")} delay={0.05} />
        <StatCard icon={UserCheck} label={t("dashboard.substitutions")} value={counts.subs} sub={t("dashboard.today")} delay={0.1} />
        <StatCard icon={ListChecks} label={t("dashboard.pendingApprovals")} value={counts.pending} sub={t("dashboard.aiProposals")} delay={0.15} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="lg:col-span-2 bg-card border border-border rounded-2xl shadow-soft overflow-hidden">
          <div className="p-6 border-b border-border">
            <h2 className="font-display text-xl font-bold">{t("dashboard.attendanceTable")}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t("dashboard.attendanceSub")}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary/50">
                <tr className="text-left text-xs uppercase text-muted-foreground tracking-wider">
                  <th className="px-6 py-3 font-medium">{t("dashboard.class")}</th>
                  <th className="px-6 py-3 font-medium">{t("dashboard.present")}</th>
                  <th className="px-6 py-3 font-medium">{t("dashboard.absent")}</th>
                  <th className="px-6 py-3 font-medium">{t("dashboard.reportedBy")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {attendance.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-muted-foreground">{t("dashboard.noReports")}</td></tr>
                ) : attendance.map((row, i) => (
                  <motion.tr key={`${row.class_name}-${i}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-secondary/30 transition-smooth">
                    <td className="px-6 py-4 font-display font-semibold">{row.class_name}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-soft text-accent text-xs font-semibold">
                        <span className="h-1.5 w-1.5 rounded-full bg-accent" />{row.present}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {row.absent > 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-semibold">{row.absent}</span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {row.reported_by_name || "—"} · {new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="bg-card border border-border rounded-2xl shadow-soft overflow-hidden flex flex-col max-h-[600px]">
          <div className="p-5 border-b border-border flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-accent-soft flex items-center justify-center">
              <MessageCircle className="h-4 w-4 text-accent" />
            </div>
            <div className="flex-1">
              <div className="font-display font-bold">{t("dashboard.liveFeed")}</div>
              <div className="text-xs text-muted-foreground">{t("dashboard.liveFeedSub")}</div>
            </div>
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
            {feed.length === 0 ? (
              <div className="text-sm text-center text-muted-foreground py-8">{t("dashboard.feedEmpty")}</div>
            ) : feed.map((m) => (
              <motion.div key={m.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={`rounded-xl p-3 ${m.source === "ai" ? "bg-accent-soft border border-accent/30" : "bg-secondary/50"}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className={`text-xs font-semibold ${m.source === "ai" ? "text-accent" : "text-foreground"}`}>
                    {m.source === "ai" ? "🤖 " : ""}{m.sender_name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                <div className="text-sm">{m.text}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
