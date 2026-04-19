
-- Teaching load
CREATE TABLE IF NOT EXISTS public.teaching_load (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_name text NOT NULL,
  teacher_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  class_name text NOT NULL,
  subject text NOT NULL,
  hours_per_week int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.teaching_load ENABLE ROW LEVEL SECURITY;
CREATE POLICY "load read" ON public.teaching_load FOR SELECT TO authenticated USING (true);
CREATE POLICY "load director" ON public.teaching_load FOR ALL TO authenticated
  USING (has_role(auth.uid(),'director')) WITH CHECK (has_role(auth.uid(),'director'));

-- Periods
CREATE TABLE IF NOT EXISTS public.school_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_number int NOT NULL UNIQUE,
  time_label text NOT NULL
);
ALTER TABLE public.school_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "periods read" ON public.school_periods FOR SELECT TO authenticated USING (true);
CREATE POLICY "periods director" ON public.school_periods FOR ALL TO authenticated
  USING (has_role(auth.uid(),'director')) WITH CHECK (has_role(auth.uid(),'director'));

-- Generated schedules
CREATE TABLE IF NOT EXISTS public.generated_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  for_date date NOT NULL DEFAULT CURRENT_DATE,
  day_of_week text NOT NULL,
  grid jsonb NOT NULL DEFAULT '{}'::jsonb,
  conflicts jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_notes text,
  generated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.generated_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gs read" ON public.generated_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "gs director" ON public.generated_schedules FOR ALL TO authenticated
  USING (has_role(auth.uid(),'director')) WITH CHECK (has_role(auth.uid(),'director'));
CREATE POLICY "gs insert auth" ON public.generated_schedules FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- NFC attendance
CREATE TABLE IF NOT EXISTS public.attendance_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name text NOT NULL,
  class_name text NOT NULL,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'on_time',
  device_info text,
  nfc_tag text
);
ALTER TABLE public.attendance_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scans read" ON public.attendance_scans FOR SELECT TO authenticated USING (true);
CREATE POLICY "scans insert" ON public.attendance_scans FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "scans director" ON public.attendance_scans FOR ALL TO authenticated
  USING (has_role(auth.uid(),'director')) WITH CHECK (has_role(auth.uid(),'director'));

-- Legal documents (orders templates)
CREATE TABLE IF NOT EXISTS public.legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL,
  title text NOT NULL,
  category text,
  template text NOT NULL,
  required_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ldocs read" ON public.legal_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "ldocs director" ON public.legal_documents FOR ALL TO authenticated
  USING (has_role(auth.uid(),'director')) WITH CHECK (has_role(auth.uid(),'director'));

-- Daily morning report
CREATE TABLE IF NOT EXISTS public.daily_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date date NOT NULL DEFAULT CURRENT_DATE UNIQUE,
  total_present int NOT NULL DEFAULT 0,
  total_absent int NOT NULL DEFAULT 0,
  by_class jsonb NOT NULL DEFAULT '[]'::jsonb,
  late_arrivals jsonb NOT NULL DEFAULT '[]'::jsonb,
  teacher_status jsonb NOT NULL DEFAULT '[]'::jsonb,
  cafeteria_portions int NOT NULL DEFAULT 0,
  ai_summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dr read" ON public.daily_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "dr director" ON public.daily_reports FOR ALL TO authenticated
  USING (has_role(auth.uid(),'director')) WITH CHECK (has_role(auth.uid(),'director'));
CREATE POLICY "dr insert auth" ON public.daily_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- Cafeteria reports
CREATE TABLE IF NOT EXISTS public.cafeteria_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date date NOT NULL DEFAULT CURRENT_DATE,
  meal_time text NOT NULL DEFAULT 'breakfast',
  total_portions int NOT NULL DEFAULT 0,
  by_class jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cafeteria_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cafe read" ON public.cafeteria_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "cafe director" ON public.cafeteria_reports FOR ALL TO authenticated
  USING (has_role(auth.uid(),'director')) WITH CHECK (has_role(auth.uid(),'director'));
CREATE POLICY "cafe insert auth" ON public.cafeteria_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
