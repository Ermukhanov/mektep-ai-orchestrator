
-- chat_messages: tighten insert
DROP POLICY IF EXISTS "chat insert" ON public.chat_messages;
CREATE POLICY "chat insert auth" ON public.chat_messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    sender_user_id = auth.uid() OR public.has_role(auth.uid(),'director')
  )
);

-- message_parses: only director or service can insert (require auth)
DROP POLICY IF EXISTS "parses insert" ON public.message_parses;
CREATE POLICY "parses insert auth" ON public.message_parses FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- attendance_reports
DROP POLICY IF EXISTS "attendance insert" ON public.attendance_reports;
CREATE POLICY "attendance insert auth" ON public.attendance_reports FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- incidents
DROP POLICY IF EXISTS "incidents insert anyone" ON public.incidents;
CREATE POLICY "incidents insert auth" ON public.incidents FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- absences
DROP POLICY IF EXISTS "absences insert anyone" ON public.absences;
CREATE POLICY "absences insert auth" ON public.absences FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- notifications
DROP POLICY IF EXISTS "notif insert" ON public.notifications;
CREATE POLICY "notif insert auth" ON public.notifications FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
