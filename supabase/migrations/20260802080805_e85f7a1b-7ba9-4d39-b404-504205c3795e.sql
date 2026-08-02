
DROP VIEW IF EXISTS public.staff_directory;

DROP POLICY IF EXISTS "staff read own or director" ON public.staff;
CREATE POLICY "staff read" ON public.staff
FOR SELECT TO authenticated
USING (true);

-- Column-level restriction: hide PII columns from the Data API
REVOKE SELECT ON public.staff FROM authenticated;
GRANT SELECT (id, full_name, short_name, subjects, user_id, is_active, created_at, updated_at)
  ON public.staff TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.staff TO authenticated;
GRANT ALL ON public.staff TO service_role;
