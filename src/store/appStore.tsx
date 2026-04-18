import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { FeedMessage, INITIAL_FEED, MORE_MESSAGES, NOTIFICATIONS, Notification } from "@/lib/mockData";

export type UserRole = "director" | "teacher";
export interface UserProfile {
  name: string;
  role: UserRole;
  subject: string;
  email: string;
}

export interface Task {
  id: string;
  title: string;
  assignee: string;
  createdAt: string;
}

interface AppState {
  user: UserProfile | null;
  setUser: (u: UserProfile | null) => void;
  feed: FeedMessage[];
  tasks: Task[];
  addTask: (t: Task) => void;
  notifications: Notification[];
  markAllRead: () => void;
  unreadCount: number;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<UserProfile | null>(() => {
    const raw = localStorage.getItem("mektep_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [feed, setFeed] = useState<FeedMessage[]>(INITIAL_FEED);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>(NOTIFICATIONS);

  const setUser = (u: UserProfile | null) => {
    setUserState(u);
    if (u) localStorage.setItem("mektep_user", JSON.stringify(u));
    else localStorage.removeItem("mektep_user");
  };

  // Simulated incoming messages
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < MORE_MESSAGES.length) {
        setFeed((f) => [...f, MORE_MESSAGES[i]]);
        i++;
      } else {
        clearInterval(interval);
      }
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const addTask = (t: Task) => {
    setTasks((prev) => [t, ...prev]);
    setNotifications((prev) => [
      { id: `nt-${t.id}`, type: "task", title: "Task Created", desc: `${t.assignee} — ${t.title}`, time: "just now", read: false },
      ...prev,
    ]);
  };

  const markAllRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <Ctx.Provider value={{ user, setUser, feed, tasks, addTask, notifications, markAllRead, unreadCount }}>
      {children}
    </Ctx.Provider>
  );
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
