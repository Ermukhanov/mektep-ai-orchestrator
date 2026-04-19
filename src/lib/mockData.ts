export interface Teacher {
  id: string;
  name: string;
  subject: string;
  avatar: string;
}

export const STAFF: Teacher[] = [
  { id: "t1", name: "Aigerim Bekova", subject: "Mathematics", avatar: "AB" },
  { id: "t2", name: "Nazken Sarsenova", subject: "Kazakh Literature", avatar: "NS" },
  { id: "t3", name: "Askar Tulegenov", subject: "Physics", avatar: "AT" },
  { id: "t4", name: "Daniyar Zhumabek", subject: "History", avatar: "DZ" },
  { id: "t5", name: "Aliya Nurlanova", subject: "Biology", avatar: "AN" },
  { id: "t6", name: "Yerlan Kassymov", subject: "English", avatar: "YK" },
];

export const SUBJECTS = [
  "Mathematics", "Physics", "Chemistry", "Biology", "Kazakh Literature",
  "Russian Literature", "English", "History", "Geography", "Computer Science",
  "Physical Education", "Art", "Music", "Administration",
];

export const CLASSES = ["1A", "1B", "2A", "2B", "3A", "4A", "5A", "6A", "7A", "8A", "9A", "10A", "11A"];

export interface ScheduleSlot {
  day: string;
  period: number;
  teacherId: string;
  class: string;
  subject: string;
}

const days = ["mon", "tue", "wed", "thu", "fri"];
export const SCHEDULE: ScheduleSlot[] = days.flatMap((day, di) =>
  Array.from({ length: 5 }, (_, p) => {
    const teacher = STAFF[(di + p) % STAFF.length];
    return {
      day,
      period: p + 1,
      teacherId: teacher.id,
      class: CLASSES[(di * 2 + p) % CLASSES.length],
      subject: teacher.subject,
    };
  })
);

// Three different mock schedule generators to make mock output varied and realistic
export function generateMockScheduleVariant(variant = 1) {
  const slots: any[] = [];
  if (variant === 1) {
    // balanced per teacher
    for (let i = 0; i < CLASSES.length; i++) {
      const cls = CLASSES[i];
      for (let p = 1; p <= 5; p++) {
        const teacher = STAFF[(i + p) % STAFF.length];
        slots.push({ class_name: cls, period: p, subject: teacher.subject, teacher: teacher.name, room: String(100 + ((i + p) % 12)) });
      }
    }
  } else if (variant === 2) {
    // clustered by subject
    for (let p = 1; p <= 5; p++) {
      for (let i = 0; i < CLASSES.length; i++) {
        const cls = CLASSES[i];
        const teacher = STAFF[(p + Math.floor(i / 2)) % STAFF.length];
        slots.push({ class_name: cls, period: p, subject: teacher.subject, teacher: teacher.name, room: String(200 + ((i + p) % 10)) });
      }
    }
  } else {
    // alternating lens-style for English in parallel classes
    for (let i = 0; i < CLASSES.length; i++) {
      const cls = CLASSES[i];
      for (let p = 1; p <= 5; p++) {
        const teacher = STAFF[(i + p) % STAFF.length];
        const isLens = p === 3 && (i % 2 === 0);
        slots.push({ class_name: cls, period: p, subject: teacher.subject, teacher: teacher.name, room: String(300 + ((i + p) % 8)), is_lens: isLens, lens_group: isLens ? 'A' : undefined });
      }
    }
  }
  return { day_of_week: 'tue', slots, conflicts: [], ai_notes: 'Сгенерировано локальным алгоритмом' };
}

export interface FeedMessage {
  id: string;
  from: string;
  text: string;
  time: string;
  parsed?: { class?: string; present?: number; absent?: number; teacher?: string };
}

export const INITIAL_FEED: FeedMessage[] = [
  { id: "m1", from: "Aigerim B.", text: "1A — 25 present, 2 absent", time: "08:42", parsed: { class: "1A", present: 25, absent: 2 } },
  { id: "m2", from: "Askar T.", text: "I'm sick today, can't come in", time: "08:45", parsed: { teacher: "Askar Tulegenov" } },
  { id: "m3", from: "Nazken S.", text: "2B — 28 present, 1 absent", time: "08:51", parsed: { class: "2B", present: 28, absent: 1 } },
  { id: "m4", from: "Daniyar Z.", text: "3A — all 26 present today", time: "08:58", parsed: { class: "3A", present: 26, absent: 0 } },
];

export const MORE_MESSAGES: FeedMessage[] = [
  { id: "m5", from: "Aliya N.", text: "5A — 24 present, 3 absent (flu)", time: "09:05", parsed: { class: "5A", present: 24, absent: 3 } },
  { id: "m6", from: "Yerlan K.", text: "7A — 22 present, 1 absent", time: "09:10", parsed: { class: "7A", present: 22, absent: 1 } },
  { id: "m7", from: "Aigerim B.", text: "Need water delivery to gym", time: "09:14" },
  { id: "m8", from: "Nazken S.", text: "9A — 27 present", time: "09:20", parsed: { class: "9A", present: 27, absent: 0 } },
];

export interface LegalOrder {
  id: string;
  number: string;
  title: string;
  date: string;
  summary: string;
  bullets: string[];
}

export const LEGAL_ORDERS: LegalOrder[] = [
  {
    id: "76",
    number: "Prikaz №76",
    title: "On approval of the State Educational Standard",
    date: "12.02.2022",
    summary: "Defines mandatory minimums for general secondary education curriculum and assessment.",
    bullets: [
      "Sets minimum hours per subject per grade",
      "Requires standardized assessment at grades 4, 9, 11",
      "Mandates Kazakh language as a core subject for all students",
      "Allows up to 20% local content in curriculum",
    ],
  },
  {
    id: "110",
    number: "Prikaz №110",
    title: "On the procedure for organizing the educational process",
    date: "06.04.2023",
    summary: "Regulates schedules, class sizes, vacations, and teacher workload.",
    bullets: [
      "Maximum class size: 30 students (urban), 24 (rural)",
      "Teacher workload: 18 hours/week base rate",
      "Mandatory 5 vacation periods per academic year",
      "Lesson length: 40–45 minutes; max 6 lessons/day for grades 5–11",
    ],
  },
  {
    id: "130",
    number: "Prikaz №130",
    title: "On approval of the Rules of certification of teachers",
    date: "27.01.2016",
    summary: "Defines categories (Pedagogue, Moderator, Expert, Researcher, Master) and certification rules.",
    bullets: [
      "5 career categories with portfolio + exam requirements",
      "Re-certification every 5 years",
      "Salary multipliers tied to category (up to ×1.75)",
      "National Qualification Test required for upgrade",
    ],
  },
];

// Ensure at least three orders are always available
export const DEFAULT_LEGAL_ORDERS = LEGAL_ORDERS.slice(0, 3);

export interface Notification {
  id: string;
  type: "incident" | "task" | "info";
  title: string;
  desc: string;
  time: string;
  read: boolean;
}

export const NOTIFICATIONS: Notification[] = [
  { id: "n1", type: "incident", title: "New Incident", desc: "Broken chair reported in Room 12", time: "5 min ago", read: false },
  { id: "n2", type: "task", title: "Task Completed", desc: "Water delivery to gym confirmed", time: "18 min ago", read: false },
  { id: "n3", type: "incident", title: "Substitution Needed", desc: "Askar Tulegenov absent — Physics 7A", time: "32 min ago", read: false },
  { id: "n4", type: "info", title: "Canteen Update", desc: "412 portions ordered for lunch", time: "1 hr ago", read: true },
  { id: "n5", type: "task", title: "Task Created", desc: "Aigerim — prepare assembly hall", time: "2 hr ago", read: true },
];
