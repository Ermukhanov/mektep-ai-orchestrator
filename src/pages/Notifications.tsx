import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useApp } from "@/store/appStore";
import { supabase } from "@/integrations/supabase/client";
import { Bell, AlertTriangle, ListChecks, Info, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface N { id: string; type: string; title: string; body: string | null; read: boolean; created_at: string; }

export default function Notifications() {
  const { t } = useTranslation();
  const { user } = useApp();
  const [list, setList] = useState<N[]>([]);

  const refresh = async () => {
    const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50);
    setList(data || []);
  };

  useEffect(() => {
    refresh();
    const ch = supabase.channel("notif").on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, refresh).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const markAll = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ read: true }).eq("read", false);
    refresh();
  };

  const icon = (type: string) => type === "incident" ? AlertTriangle : type === "task" ? ListChecks : Info;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-1">{t("notifications.title")}</h1>
          <p className="text-muted-foreground">{t("notifications.subtitle")}</p>
        </div>
        <Button onClick={markAll} variant="outline" className="gap-2"><CheckCheck className="h-4 w-4" />{t("notifications.markAllRead")}</Button>
      </div>
      <div className="bg-card border border-border rounded-2xl shadow-soft divide-y divide-border">
        {list.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground"><Bell className="h-10 w-10 mx-auto mb-3 opacity-40" />{t("notifications.empty")}</div>
        ) : list.map((n, i) => {
          const Icon = icon(n.type);
          return (
            <motion.div key={n.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
              className={`p-4 flex items-start gap-3 ${!n.read ? "bg-accent-soft/30" : ""}`}>
              <div className="h-10 w-10 rounded-xl bg-accent-soft flex items-center justify-center flex-shrink-0"><Icon className="h-5 w-5 text-accent" /></div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{n.title}</div>
                {n.body && <div className="text-sm text-muted-foreground mt-0.5">{n.body}</div>}
                <div className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</div>
              </div>
              {!n.read && <span className="h-2 w-2 rounded-full bg-accent flex-shrink-0 mt-2" />}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
