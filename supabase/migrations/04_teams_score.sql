-- Add score to teams (default 0)
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS score numeric NOT NULL DEFAULT 0;

-- Allow judges to UPDATE teams (for score changes). Drop and recreate the update policy.
DROP POLICY IF EXISTS "teams_update" ON public.teams;

CREATE POLICY "teams_update"
  ON public.teams FOR UPDATE
  USING (public.can_manage_event(event_id) OR public.can_judge_event(event_id))
  WITH CHECK (public.can_manage_event(event_id) OR public.can_judge_event(event_id));
