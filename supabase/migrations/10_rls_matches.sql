-- RLS on matches
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- SELECT: user can see matches if they can see the event
CREATE POLICY "matches_select"
  ON public.matches FOR SELECT
  USING (public.can_see_event(event_id));

-- INSERT: coordinator/admin only (via bracket generation)
CREATE POLICY "matches_insert"
  ON public.matches FOR INSERT
  WITH CHECK (public.can_manage_event(event_id));

-- UPDATE: coordinator/admin can manage; judge can update scores/winner/status
CREATE POLICY "matches_update"
  ON public.matches FOR UPDATE
  USING (
    public.can_manage_event(event_id)
    OR public.can_judge_event(event_id)
  )
  WITH CHECK (
    public.can_manage_event(event_id)
    OR public.can_judge_event(event_id)
  );

-- DELETE: coordinator/admin only
CREATE POLICY "matches_delete"
  ON public.matches FOR DELETE
  USING (public.can_manage_event(event_id));
