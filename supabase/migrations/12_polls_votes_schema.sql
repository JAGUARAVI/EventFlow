-- Polls table
CREATE TABLE public.polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  question text NOT NULL,
  poll_type text NOT NULL DEFAULT 'simple' CHECK (poll_type IN ('simple', 'vote_to_points', 'ranked')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER polls_updated_at
  BEFORE UPDATE ON public.polls
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Poll options
CREATE TABLE public.poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  label text NOT NULL,
  points numeric DEFAULT 1,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  display_order int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Votes (immutable)
CREATE TABLE public.votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (poll_id, user_id)
);

-- Helper: award poll points to teams
CREATE OR REPLACE FUNCTION public.award_poll_points(poll_id uuid)
RETURNS TABLE(team_id uuid, points_awarded numeric) AS $$
  WITH vote_counts AS (
    SELECT
      po.team_id,
      SUM(po.points) AS total_points
    FROM public.votes v
    JOIN public.poll_options po ON v.option_id = po.id
    WHERE v.poll_id = award_poll_points.poll_id
    GROUP BY po.team_id
  )
  INSERT INTO public.score_history (event_id, team_id, points_before, points_after, delta, changed_by)
  SELECT
    p.event_id,
    vc.team_id,
    COALESCE(t.score, 0),
    COALESCE(t.score, 0) + vc.total_points,
    vc.total_points,
    auth.uid()
  FROM vote_counts vc
  JOIN public.polls p ON p.id = award_poll_points.poll_id
  LEFT JOIN public.teams t ON t.id = vc.team_id
  WHERE vc.team_id IS NOT NULL
  -- Reference the columns in score_history, not the CTE alias vc
  RETURNING team_id, delta; 
$$ LANGUAGE sql;