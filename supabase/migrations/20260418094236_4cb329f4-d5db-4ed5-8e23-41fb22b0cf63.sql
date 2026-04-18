
-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- Enum: app role
CREATE TYPE public.app_role AS ENUM ('director','teacher','staff');

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT 'ru',
  staff_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- new user trigger -> create profile + default teacher role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, language)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), COALESCE(NEW.raw_user_meta_data->>'language','ru'));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'teacher'));
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- staff
CREATE TABLE public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  short_name TEXT,
  subjects TEXT[] NOT NULL DEFAULT '{}',
  phone TEXT,
  email TEXT,
  telegram_chat_id TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_staff_updated BEFORE UPDATE ON public.staff
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_staff_active ON public.staff(is_active);

-- rooms
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL UNIQUE,
  floor INT,
  capacity INT,
  home_class TEXT,
  owner_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  subject TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- classes
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  grade INT,
  student_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

-- schedule_slots
CREATE TABLE public.schedule_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week TEXT NOT NULL,            -- mon..sat
  period INT NOT NULL,
  time_label TEXT,
  class_name TEXT NOT NULL,
  subject_raw TEXT NOT NULL,
  subject_norm TEXT,
  teacher_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  teacher_raw TEXT,
  room TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.schedule_slots ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_slots_day_period ON public.schedule_slots(day_of_week, period);
CREATE INDEX idx_slots_teacher ON public.schedule_slots(teacher_id);
CREATE INDEX idx_slots_class ON public.schedule_slots(class_name);

-- chat_messages
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'internal', -- internal | telegram | whatsapp
  external_id TEXT,                        -- telegram update_id etc.
  sender_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  sender_name TEXT NOT NULL,
  text TEXT NOT NULL,
  language TEXT,
  processed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_chat_processed ON public.chat_messages(processed, created_at);

-- message_parses
CREATE TABLE public.message_parses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  intent TEXT NOT NULL,                  -- attendance | incident | absence | task | other
  entities JSONB NOT NULL DEFAULT '{}',
  confidence NUMERIC,
  ai_reply TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.message_parses ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_parses_intent ON public.message_parses(intent);

-- attendance_reports
CREATE TABLE public.attendance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_name TEXT NOT NULL,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  present INT NOT NULL DEFAULT 0,
  absent INT NOT NULL DEFAULT 0,
  absent_reason TEXT,
  reported_by_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  reported_by_name TEXT,
  source_message_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.attendance_reports ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_attendance_date_class ON public.attendance_reports(report_date, class_name);

-- incidents
CREATE TABLE public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  severity TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  reporter_name TEXT,
  reporter_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  source_message_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  assigned_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_incidents_updated BEFORE UPDATE ON public.incidents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- absences
CREATE TABLE public.absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  staff_name TEXT NOT NULL,
  absence_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT,
  source_message_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.absences ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_absences_date ON public.absences(absence_date);

-- substitutions
CREATE TABLE public.substitutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID REFERENCES public.schedule_slots(id) ON DELETE CASCADE,
  absence_id UUID REFERENCES public.absences(id) ON DELETE CASCADE,
  substitute_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'suggested', -- suggested | confirmed | rejected
  ai_reasoning TEXT,
  for_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.substitutions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_subs_updated BEFORE UPDATE ON public.substitutions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- tasks
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  assignee_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  assignee_name TEXT,
  due_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open',
  source TEXT NOT NULL DEFAULT 'manual', -- manual | voice | ai
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_role public.app_role,           -- broadcast to role if user_id null
  type TEXT NOT NULL,                       -- incident | task | absence | attendance | info
  title TEXT NOT NULL,
  body TEXT,
  related_entity TEXT,
  related_id UUID,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notif_recipient ON public.notifications(recipient_user_id, read);
CREATE INDEX idx_notif_role ON public.notifications(recipient_role, read);

-- legal_orders
CREATE TABLE public.legal_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL,
  title TEXT NOT NULL,
  date_published DATE,
  summary TEXT,
  full_text TEXT,
  bullets JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.legal_orders ENABLE ROW LEVEL SECURITY;

-- legal_chunks (RAG)
CREATE TABLE public.legal_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.legal_orders(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(768),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.legal_chunks ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_chunks_order ON public.legal_chunks(order_id);

-- ============ RLS POLICIES ============

-- profiles
CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'director'));
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated
USING (user_id = auth.uid());
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- user_roles
CREATE POLICY "user_roles self read" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'director'));
CREATE POLICY "user_roles director manage" ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'director')) WITH CHECK (public.has_role(auth.uid(),'director'));

-- staff: read by any authenticated; manage by director
CREATE POLICY "staff read" ON public.staff FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff director manage" ON public.staff FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'director')) WITH CHECK (public.has_role(auth.uid(),'director'));

-- rooms: read all, manage director
CREATE POLICY "rooms read" ON public.rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "rooms director manage" ON public.rooms FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'director')) WITH CHECK (public.has_role(auth.uid(),'director'));

-- classes
CREATE POLICY "classes read" ON public.classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "classes director manage" ON public.classes FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'director')) WITH CHECK (public.has_role(auth.uid(),'director'));

-- schedule_slots
CREATE POLICY "slots read" ON public.schedule_slots FOR SELECT TO authenticated USING (true);
CREATE POLICY "slots director manage" ON public.schedule_slots FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'director')) WITH CHECK (public.has_role(auth.uid(),'director'));

-- chat_messages: anyone authenticated can insert; director sees all, sender sees own
CREATE POLICY "chat insert" ON public.chat_messages FOR INSERT TO authenticated
WITH CHECK (sender_user_id = auth.uid() OR public.has_role(auth.uid(),'director'));
CREATE POLICY "chat read" ON public.chat_messages FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'director') OR sender_user_id = auth.uid());
CREATE POLICY "chat director update" ON public.chat_messages FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'director'));

-- message_parses: director read; any can insert (edge function uses service role anyway)
CREATE POLICY "parses read director" ON public.message_parses FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'director'));
CREATE POLICY "parses insert" ON public.message_parses FOR INSERT TO authenticated WITH CHECK (true);

-- attendance_reports
CREATE POLICY "attendance read" ON public.attendance_reports FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'director') OR reported_by_staff_id IN (SELECT staff_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "attendance insert" ON public.attendance_reports FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "attendance director update" ON public.attendance_reports FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'director'));

-- incidents: director full; teacher read own
CREATE POLICY "incidents director" ON public.incidents FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'director')) WITH CHECK (public.has_role(auth.uid(),'director'));
CREATE POLICY "incidents read teacher" ON public.incidents FOR SELECT TO authenticated
USING (reporter_staff_id IN (SELECT staff_id FROM public.profiles WHERE user_id = auth.uid()) OR assigned_staff_id IN (SELECT staff_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "incidents insert anyone" ON public.incidents FOR INSERT TO authenticated WITH CHECK (true);

-- absences
CREATE POLICY "absences director" ON public.absences FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'director')) WITH CHECK (public.has_role(auth.uid(),'director'));
CREATE POLICY "absences read self" ON public.absences FOR SELECT TO authenticated
USING (staff_id IN (SELECT staff_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "absences insert anyone" ON public.absences FOR INSERT TO authenticated WITH CHECK (true);

-- substitutions: director manage; substitute teacher read own
CREATE POLICY "subs director" ON public.substitutions FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'director')) WITH CHECK (public.has_role(auth.uid(),'director'));
CREATE POLICY "subs read self" ON public.substitutions FOR SELECT TO authenticated
USING (substitute_staff_id IN (SELECT staff_id FROM public.profiles WHERE user_id = auth.uid()));

-- tasks: director full; assignee read own
CREATE POLICY "tasks director" ON public.tasks FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'director')) WITH CHECK (public.has_role(auth.uid(),'director'));
CREATE POLICY "tasks assignee read" ON public.tasks FOR SELECT TO authenticated
USING (assignee_staff_id IN (SELECT staff_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "tasks assignee update status" ON public.tasks FOR UPDATE TO authenticated
USING (assignee_staff_id IN (SELECT staff_id FROM public.profiles WHERE user_id = auth.uid()));

-- notifications: recipient reads; director reads all; insert by anyone (edge fn)
CREATE POLICY "notif read self" ON public.notifications FOR SELECT TO authenticated
USING (recipient_user_id = auth.uid() OR (recipient_role IS NOT NULL AND public.has_role(auth.uid(), recipient_role)) OR public.has_role(auth.uid(),'director'));
CREATE POLICY "notif update self" ON public.notifications FOR UPDATE TO authenticated
USING (recipient_user_id = auth.uid() OR public.has_role(auth.uid(),'director'));
CREATE POLICY "notif insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

-- legal_orders: read all; director manage
CREATE POLICY "legal read" ON public.legal_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "legal director manage" ON public.legal_orders FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'director')) WITH CHECK (public.has_role(auth.uid(),'director'));

-- legal_chunks: read all; manage director
CREATE POLICY "chunks read" ON public.legal_chunks FOR SELECT TO authenticated USING (true);
CREATE POLICY "chunks director manage" ON public.legal_chunks FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'director')) WITH CHECK (public.has_role(auth.uid(),'director'));

-- Realtime: enable replica identity full + add to publication for live dashboard
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.attendance_reports REPLICA IDENTITY FULL;
ALTER TABLE public.incidents REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER TABLE public.substitutions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.incidents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.substitutions;
