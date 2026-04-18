import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useApp } from "@/store/appStore";
import { Bell, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

const ICONS = {
  incident: { icon: AlertTriangle, cls: "bg-destructive/10 text-destructive" },
  task: { icon: CheckCircle2, cls: "bg-accent-soft text-accent" },
  info: { icon: Info, cls: "bg-secondary text-foreground" },
};

export default function Notifications() {
  const { t } = useTranslation();
  const { notifications, markAllRead } = useApp();

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-1 flex items-center gap-3">
            <Bell className="h-8 w-8 text-accent" />
            {t("notifications.title")}
          </h1>
          <p className="text-muted-foreground">{t("notifications.subtitle")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={markAllRead}>{t("notifications.markAllRead")}</Button>
      </div>

      <div className="space-y-3">
        {notifications.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">{t("notifications.empty")}</div>
        ) : (
          notifications.map((n, i) => {
            const meta = ICONS[n.type];
            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`bg-card border rounded-2xl p-4 flex items-start gap-4 transition-smooth hover:shadow-md ${
                  n.read ? "border-border opacity-70" : "border-border shadow-soft"
                }`}
              >
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.cls}`}>
                  <meta.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold">{n.title}</div>
                    {!n.read && <span className="h-2 w-2 rounded-full bg-accent" />}
                  </div>
                  <div className="text-sm text-muted-foreground mt-0.5">{n.desc}</div>
                  <div className="text-xs text-muted-foreground mt-1">{n.time}</div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
