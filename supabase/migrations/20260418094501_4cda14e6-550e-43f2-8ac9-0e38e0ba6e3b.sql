-- Link teacher_id in schedule_slots by matching teacher_raw to staff short_name / full_name
UPDATE public.schedule_slots ss
SET teacher_id = s.id
FROM public.staff s
WHERE ss.teacher_id IS NULL
  AND ss.teacher_raw IS NOT NULL
  AND (
    s.short_name = ss.teacher_raw
    OR s.short_name ILIKE ss.teacher_raw || '%'
    OR s.full_name ILIKE split_part(ss.teacher_raw, ' ', 1) || '%'
  );

-- Helpful indexes for the AI agent's lookups
CREATE INDEX IF NOT EXISTS idx_slots_teacher ON public.schedule_slots(teacher_id);
CREATE INDEX IF NOT EXISTS idx_slots_day_period ON public.schedule_slots(day_of_week, period);
CREATE INDEX IF NOT EXISTS idx_slots_class ON public.schedule_slots(class_name);
CREATE INDEX IF NOT EXISTS idx_chat_processed ON public.chat_messages(processed, created_at);
CREATE INDEX IF NOT EXISTS idx_absences_date ON public.absences(absence_date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_notif_recipient ON public.notifications(recipient_user_id, read);

-- Add a "pending_actions" table for AI proposals awaiting director approval
CREATE TABLE IF NOT EXISTS public.pending_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_message_id uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  action_type text NOT NULL, -- create_substitution, create_incident, create_task, send_chat_reply, mark_absence
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_summary text,
  ai_reasoning text,
  status text NOT NULL DEFAULT 'pending', -- pending|approved|rejected|executed|failed
  decided_by uuid,
  decided_at timestamptz,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pending director all" ON public.pending_actions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'director'))
  WITH CHECK (public.has_role(auth.uid(),'director'));

CREATE POLICY "pending insert auth" ON public.pending_actions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

ALTER PUBLICATION supabase_realtime ADD TABLE public.pending_actions;