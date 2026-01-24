-- RLS: events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_select"
  ON public.events FOR SELECT
  USING (
    visibility = 'public'
    OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.event_judges ej WHERE ej.event_id = events.id AND ej.user_id = auth.uid())
    OR public.is_admin()
  );

CREATE POLICY "events_insert"
  ON public.events FOR INSERT
  WITH CHECK (public.get_user_role() IN ('admin', 'club_coordinator'));

CREATE POLICY "events_update"
  ON public.events FOR UPDATE
  USING (public.can_manage_event(id))
  WITH CHECK (public.can_manage_event(id));

CREATE POLICY "events_delete"
  ON public.events FOR DELETE
  USING (public.can_manage_event(id));

-- RLS: teams
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teams_select"
  ON public.teams FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events e WHERE e.id = teams.event_id
        AND (e.visibility = 'public' OR e.created_by = auth.uid()
          OR EXISTS (SELECT 1 FROM public.event_judges ej WHERE ej.event_id = e.id AND ej.user_id = auth.uid())
          OR public.is_admin())
    )
  );

CREATE POLICY "teams_insert"
  ON public.teams FOR INSERT
  WITH CHECK (public.can_manage_event(event_id));

CREATE POLICY "teams_update"
  ON public.teams FOR UPDATE
  USING (public.can_manage_event(event_id))
  WITH CHECK (public.can_manage_event(event_id));

CREATE POLICY "teams_delete"
  ON public.teams FOR DELETE
  USING (public.can_manage_event(event_id));

-- RLS: event_judges
ALTER TABLE public.event_judges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_judges_select"
  ON public.event_judges FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events e WHERE e.id = event_judges.event_id
        AND (e.visibility = 'public' OR e.created_by = auth.uid()
          OR EXISTS (SELECT 1 FROM public.event_judges ej WHERE ej.event_id = e.id AND ej.user_id = auth.uid())
          OR public.is_admin())
    )
  );

CREATE POLICY "event_judges_insert"
  ON public.event_judges FOR INSERT
  WITH CHECK (public.can_manage_event(event_id));

CREATE POLICY "event_judges_delete"
  ON public.event_judges FOR DELETE
  USING (public.can_manage_event(event_id));
