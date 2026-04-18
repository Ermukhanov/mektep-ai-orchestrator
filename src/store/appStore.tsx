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
    const [{ data: prof }, { data: roleRow }] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, language, staff_id").eq("user_id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid).order("role").limit(1).maybeSingle(),
    ]);
    setProfile(prof || null);
    setRole((roleRow?.role as UserRole) || null);
  };

  const refresh = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setUser(session?.user || null);
    if (session?.user) await loadProfile(session.user.id);
  };

  useEffect(() => {
    // Subscribe FIRST, then check session
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (session?.user) {
        // defer DB call to avoid deadlock
        setTimeout(() => loadProfile(session.user.id), 0);
      } else {
        setProfile(null);
        setRole(null);
      }
    });
    refresh().finally(() => setLoading(false));
    return () => sub.subscription.unsubscribe();
  }, []);

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
