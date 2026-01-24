-- RLS: polls
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "polls_select"
  ON public.polls FOR SELECT
  USING (public.can_see_event(event_id));

CREATE POLICY "polls_insert"
  ON public.polls FOR INSERT
  WITH CHECK (public.can_manage_event(event_id));

CREATE POLICY "polls_update"
  ON public.polls FOR UPDATE
  USING (public.can_manage_event(event_id))
  WITH CHECK (public.can_manage_event(event_id));

CREATE POLICY "polls_delete"
  ON public.polls FOR DELETE
  USING (public.can_manage_event(event_id));

-- RLS: poll_options
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "poll_options_select"
  ON public.poll_options FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.polls p WHERE p.id = poll_options.poll_id
        AND public.can_see_event(p.event_id)
    )
  );

CREATE POLICY "poll_options_insert"
  ON public.poll_options FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.polls p WHERE p.id = poll_options.poll_id
        AND public.can_manage_event(p.event_id)
    )
  );

CREATE POLICY "poll_options_update"
  ON public.poll_options FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.polls p WHERE p.id = poll_options.poll_id
        AND public.can_manage_event(p.event_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.polls p WHERE p.id = poll_options.poll_id
        AND public.can_manage_event(p.event_id)
    )
  );

CREATE POLICY "poll_options_delete"
  ON public.poll_options FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.polls p WHERE p.id = poll_options.poll_id
        AND public.can_manage_event(p.event_id)
    )
  );

-- RLS: votes (authenticated users can insert their own vote)
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "votes_insert"
  ON public.votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "votes_select_own"
  ON public.votes FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.polls p WHERE p.id = votes.poll_id
        AND public.can_manage_event(p.event_id)
    )
  );

CREATE POLICY "votes_delete_own"
  ON public.votes FOR DELETE
  USING (auth.uid() = user_id);
