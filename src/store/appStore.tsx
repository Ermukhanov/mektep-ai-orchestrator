import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type UserRole = "director" | "teacher" | "staff";

export interface Profile {
  user_id: string;
  full_name: string;
  language: string;
  staff_id: string | null;
}

interface AppState {
  user: User | null;
  profile: Profile | null;
  role: UserRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    try {
      const [{ data: prof }, { data: roleRow }] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, language, staff_id").eq("user_id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid).order("role").limit(1).maybeSingle(),
      ]);
      setProfile(prof || null);
      setRole((roleRow?.role as UserRole) || null);
    } catch (e) {
      console.error("loadProfile error", e);
    }
  };

  const refresh = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setUser(session?.user || null);
    if (session?.user) await loadProfile(session.user.id);
  };

  useEffect(() => {
    let mounted = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user || null);
      if (session?.user) {
        setTimeout(() => {
          if (mounted) loadProfile(session.user.id);
        }, 0);
      } else {
        setProfile(null);
        setRole(null);
      }
    });

    refresh().finally(() => {
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Auto-parser: whenever a new human message arrives, trigger AI parse
  // Uses a debounce set to avoid duplicate calls
  useEffect(() => {
    if (!user) return;

    const processed = new Set<string>();

    const ch = supabase
      .channel("mektep-ai-autoparse")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload: any) => {
          const m = payload.new;
          if (!m || m.processed || m.source === "ai") return;
          if (processed.has(m.id)) return;
          processed.add(m.id);

          // Clean up set after a minute
          setTimeout(() => processed.delete(m.id), 60000);

          supabase.functions
            .invoke("parse-chat", { body: { message_id: m.id } })
            .catch((e) => console.error("auto parse-chat failed", e));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setRole(null);
  };

  return (
    <Ctx.Provider value={{ user, profile, role, loading, signOut, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
