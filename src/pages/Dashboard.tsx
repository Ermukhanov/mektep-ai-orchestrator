import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useApp } from "@/store/appStore";
import { Users, UtensilsCrossed, AlertTriangle, UserCheck, MessageCircle, TrendingUp, TrendingDown } from "lucide-react";
import { useMemo } from "react";

function StatCard({ icon: Icon, label, value, sub, trend, delay = 0, gradient = false }: any) {
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
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-semibold ${trend > 0 ? "text-success" : "text-destructive"} ${gradient ? "text-white/90" : ""}`}>
            {trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className={`text-3xl font-display font-bold mb-1 ${gradient ? "text-white" : ""}`}>{value}</div>
      <div className={`text-sm ${gradient ? "text-white/70" : "text-muted-foreground"}`}>{label}</div>
      {sub && <div className={`text-xs mt-2 ${gradient ? "text-white/60" : "text-muted-foreground"}`}>{sub}</div>}
    </motion.div>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { user, feed } = useApp();

  // Live attendance derived from feed
  const attendance = useMemo(() => {
    const map = new Map<string, { present: number; absent: number; from: string; time: string }>();
    feed.forEach((m) => {
      if (m.parsed?.class && m.parsed.present !== undefined) {
        map.set(m.parsed.class, {
          present: m.parsed.present,
          absent: m.parsed.absent || 0,
          from: m.from,
          time: m.time,
        });
      }
    });
    return Array.from(map.entries()).map(([cls, data]) => ({ class: cls, ...data }));
  }, [feed]);

  const totals = useMemo(() => {
    const present = attendance.reduce((s, a) => s + a.present, 0);
    const absent = attendance.reduce((s, a) => s + a.absent, 0);
    return { present, absent, total: present + absent };
  }, [attendance]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-1">
          {t("dashboard.greeting", { name: user?.name.split(" ")[0] })}
        </h1>
        <p className="text-muted-foreground">{t("dashboard.subtitle")}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label={t("dashboard.attendance")}
          value={`${totals.present}/${totals.total || 142}`}
          sub={`${attendance.length} classes reporting`}
          trend={3}
          delay={0}
          gradient
        />
        <StatCard icon={UtensilsCrossed} label={t("dashboard.canteen")} value="412" sub="Lunch shift" trend={2} delay={0.05} />
        <StatCard icon={AlertTriangle} label={t("dashboard.incidents")} value="3" sub="2 unresolved" trend={-12} delay={0.1} />
        <StatCard icon={UserCheck} label={t("dashboard.substitutions")} value="2" sub="1 confirmed" trend={5} delay={0.15} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Attendance table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2 bg-card border border-border rounded-2xl shadow-soft overflow-hidden"
        >
          <div className="p-6 border-b border-border">
            <h2 className="font-display text-xl font-bold">{t("dashboard.attendanceTable")}</h2>
            <p className="text-sm text-muted-foreground mt-1">Auto-updates from teacher reports</p>
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
                  <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-muted-foreground">Waiting for reports...</td></tr>
                ) : (
                  attendance.map((row, i) => (
                    <motion.tr
                      key={row.class}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="hover:bg-secondary/30 transition-smooth"
                    >
                      <td className="px-6 py-4 font-display font-semibold">{row.class}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-soft text-accent text-xs font-semibold">
                          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                          {row.present}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {row.absent > 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-semibold">
                            {row.absent}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{row.from} · {row.time}</td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Live feed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-card border border-border rounded-2xl shadow-soft overflow-hidden flex flex-col max-h-[600px]"
        >
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
            {feed.slice().reverse().map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="bg-secondary/50 rounded-xl p-3"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-semibold text-foreground">{m.from}</div>
                  <div className="text-xs text-muted-foreground">{m.time}</div>
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
