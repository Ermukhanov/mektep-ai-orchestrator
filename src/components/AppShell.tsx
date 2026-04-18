import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LayoutDashboard, Calendar, Scale, Bell, LogOut, Inbox, MessageSquare, User } from "lucide-react";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useApp } from "@/store/appStore";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { VoiceTaskFab } from "@/components/VoiceTaskFab";

export default function AppShell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, role, loading, signOut } = useApp();
  const [unread, setUnread] = useState(0);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (loading) return;
    if (!user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    const refresh = async () => {
      const [{ count: n }, { count: p }] = await Promise.all([
        supabase.from("notifications").select("*", { count: "exact", head: true }).eq("read", false),
        supabase.from("pending_actions").select("*", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      setUnread(n || 0);
      setPending(p || 0);
    };
    refresh();
    const ch = supabase.channel("shell")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "pending_actions" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  if (loading || !user) return null;

  const navItems = [
    { to: "/app/dashboard", icon: LayoutDashboard, label: t("nav.dashboard") },
    { to: "/app/inbox", icon: Inbox, label: t("nav.inbox"), badge: pending },
    { to: "/app/chats", icon: MessageSquare, label: t("nav.chats", "Чаты") },
    { to: "/app/schedule", icon: Calendar, label: t("nav.schedule") },
    { to: "/app/legal", icon: Scale, label: t("nav.legal") },
    { to: "/app/notifications", icon: Bell, label: t("nav.notifications"), badge: unread },
  ];

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  const displayName = profile?.full_name || user.email || "User";
  const initials = displayName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="p-6 border-b border-sidebar-border"><Logo size="sm" inverted /></div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to}
              className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-smooth relative ${isActive ? "bg-sidebar-accent text-white" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-white"}`}>
              <item.icon className="h-5 w-5" />
              <span className="flex-1">{item.label}</span>
              {item.badge ? <span className="h-5 min-w-5 px-1.5 rounded-full bg-accent text-accent-foreground text-xs font-semibold flex items-center justify-center">{item.badge}</span> : null}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="h-10 w-10 rounded-full gradient-success flex items-center justify-center text-white font-semibold text-sm">{initials}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{displayName}</div>
              <div className="text-xs text-sidebar-foreground/60 truncate">{role ? t(`roles.${role}`) : ""}</div>
            </div>
          </div>
          <Button onClick={handleLogout} variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent/50">
            <LogOut className="h-4 w-4 mr-2" /> {t("nav.logout")}
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between px-4 md:px-8 sticky top-0 z-30">
          <div className="md:hidden"><Logo size="sm" /></div>
          <div className="hidden md:block flex-1" />
          <LanguageSwitcher variant="outline" />
        </header>
        <main className="flex-1 overflow-y-auto pb-24 md:pb-8">
          <AnimatePresence mode="wait">
            <motion.div key={location.pathname} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} className="p-4 md:p-8 max-w-7xl mx-auto w-full">
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-card border-t border-border z-40">
        <div className="grid grid-cols-5 h-16">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to}
              className={({ isActive }) => `flex flex-col items-center justify-center gap-1 text-[10px] transition-smooth relative ${isActive ? "text-accent" : "text-muted-foreground"}`}>
              <div className="relative">
                <item.icon className="h-5 w-5" />
                {item.badge ? <span className="absolute -top-1 -right-2 h-4 min-w-4 px-1 rounded-full bg-destructive text-white text-[10px] font-semibold flex items-center justify-center">{item.badge}</span> : null}
              </div>
              <span className="truncate max-w-[60px]">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <VoiceTaskFab />
    </div>
  );
}
