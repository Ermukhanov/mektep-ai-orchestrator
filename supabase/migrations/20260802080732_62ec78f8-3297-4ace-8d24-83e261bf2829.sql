
-- 1. WITH CHECK clauses
DROP POLICY IF EXISTS "attendance director update" ON public.attendance_reports;
CREATE POLICY "attendance director update" ON public.attendance_reports
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'director'))
WITH CHECK (public.has_role(auth.uid(), 'director'));

DROP POLICY IF EXISTS "notif update self" ON public.notifications;
CREATE POLICY "notif update self" ON public.notifications
FOR UPDATE TO authenticated
USING ((recipient_user_id = auth.uid()) OR public.has_role(auth.uid(), 'director'))
WITH CHECK ((recipient_user_id = auth.uid()) OR public.has_role(auth.uid(), 'director'));

DROP POLICY IF EXISTS "profiles self update" ON public.profiles;
CREATE POLICY "profiles self update" ON public.profiles
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "chat director update" ON public.chat_messages;
CREATE POLICY "chat director update" ON public.chat_messages
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'director'))
WITH CHECK (public.has_role(auth.uid(), 'director'));

DROP POLICY IF EXISTS "tasks assignee update status" ON public.tasks;
CREATE POLICY "tasks assignee update status" ON public.tasks
FOR UPDATE TO authenticated
USING (assignee_staff_id IN (SELECT p.staff_id FROM public.profiles p WHERE p.user_id = auth.uid()))
WITH CHECK (assignee_staff_id IN (SELECT p.staff_id FROM public.profiles p WHERE p.user_id = auth.uid()));

-- 2. Staff PII exposure
DROP POLICY IF EXISTS "staff read" ON public.staff;
CREATE POLICY "staff read own or director" ON public.staff
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'director')
  OR user_id = auth.uid()
  OR id IN (SELECT p.staff_id FROM public.profiles p WHERE p.user_id = auth.uid())
);

-- Non-sensitive directory view for the app (no phone/email/telegram)
CREATE OR REPLACE VIEW public.staff_directory
WITH (security_invoker = off) AS
SELECT id, full_name, short_name, subjects, is_active
FROM public.staff;

GRANT SELECT ON public.staff_directory TO authenticated;

-- 3. SECURITY DEFINER functions should not be callable by anonymous visitors
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin, service_role;
