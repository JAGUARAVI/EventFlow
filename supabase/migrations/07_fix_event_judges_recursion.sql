-- can_see_event(eid): true if the current user may see the event (public, creator, admin, or judge).
-- SECURITY DEFINER so reads from event_judges bypass RLS and avoid infinite recursion when
-- event_judges_select (or events/teams/score_history policies) would otherwise query event_judges.
CREATE OR REPLACE FUNCTION public.can_see_event(eid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = eid
      AND (e.visibility = 'public' OR e.created_by = auth.uid() OR public.is_admin())
  )
  OR EXISTS (
    SELECT 1 FROM public.event_judges ej
    WHERE ej.event_id = eid AND ej.user_id = auth.uid()
  );
$$;

-- event_judges_select: use can_see_event to avoid querying event_judges inside its own policy.
DROP POLICY IF EXISTS "event_judges_select" ON public.event_judges;
CREATE POLICY "event_judges_select"
  ON public.event_judges FOR SELECT
  USING (public.can_see_event(event_id));

-- Optional: simplify events_select to use can_see_event (removes event_judges subquery).
DROP POLICY IF EXISTS "events_select" ON public.events;
CREATE POLICY "events_select"
  ON public.events FOR SELECT
  USING (public.can_see_event(id));

-- Optional: simplify teams_select to use can_see_event.
DROP POLICY IF EXISTS "teams_select" ON public.teams;
CREATE POLICY "teams_select"
  ON public.teams FOR SELECT
  USING (public.can_see_event(event_id));

-- score_history_select: use can_see_event to avoid event_judges subquery.
DROP POLICY IF EXISTS "score_history_select" ON public.score_history;
CREATE POLICY "score_history_select"
  ON public.score_history FOR SELECT
  USING (public.can_see_event(event_id));
