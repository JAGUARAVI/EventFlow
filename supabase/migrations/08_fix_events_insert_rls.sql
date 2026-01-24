-- events_insert: avoid get_user_role() which can return NULL (e.g. missing profile)
-- and cause "new row violates row-level security". Check profiles directly.
-- The SELECT from profiles uses the inserter's auth.uid() and is allowed by
-- profiles' "users_select_own_profile" (id = auth.uid()).
DROP POLICY IF EXISTS "events_insert" ON public.events;
CREATE POLICY "events_insert"
  ON public.events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND LOWER(TRIM(role)) IN ('admin', 'club_coordinator')
    )
  );
