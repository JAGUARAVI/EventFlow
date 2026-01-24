-- Score history for audit and undo
CREATE TABLE public.score_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  points_before numeric NOT NULL,
  points_after numeric NOT NULL,
  delta numeric NOT NULL,
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  undo_id uuid REFERENCES public.score_history(id) ON DELETE SET NULL
);

-- RLS: same visibility as events (select); insert/update only by can_judge
ALTER TABLE public.score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "score_history_select"
  ON public.score_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events e WHERE e.id = score_history.event_id
        AND (e.visibility = 'public' OR e.created_by = auth.uid()
          OR EXISTS (SELECT 1 FROM public.event_judges ej WHERE ej.event_id = e.id AND ej.user_id = auth.uid())
          OR public.is_admin())
    )
  );

CREATE POLICY "score_history_insert"
  ON public.score_history FOR INSERT
  WITH CHECK (public.can_judge_event(event_id));

-- No UPDATE/DELETE on score_history; undo is implemented by inserting a compensating row.
