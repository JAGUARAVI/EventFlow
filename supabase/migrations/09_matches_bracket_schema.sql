-- Matches table for bracket tournaments (single-elim, round-robin, Swiss)
CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  bracket_type text NOT NULL CHECK (bracket_type IN ('single_elim', 'round_robin', 'swiss')),
  round int NOT NULL DEFAULT 0,
  position int NOT NULL DEFAULT 0,
  group_id text, -- for Swiss groups or round-robin leagues
  team_a_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  team_b_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  team_a_score numeric DEFAULT 0,
  team_b_score numeric DEFAULT 0,
  winner_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'live', 'completed')),
  next_match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
  next_match_slot text CHECK (next_match_slot IN ('a', 'b')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, bracket_type, round, position, group_id)
);

CREATE TRIGGER matches_updated_at
  BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- When winner is set, promote to next match
CREATE OR REPLACE FUNCTION public.promote_winner_to_next_match()
RETURNS trigger AS $$
BEGIN
  IF NEW.winner_id IS NOT NULL AND OLD.winner_id IS NULL AND NEW.next_match_id IS NOT NULL THEN
    IF NEW.next_match_slot = 'a' THEN
      UPDATE public.matches
      SET team_a_id = NEW.winner_id
      WHERE id = NEW.next_match_id;
    ELSIF NEW.next_match_slot = 'b' THEN
      UPDATE public.matches
      SET team_b_id = NEW.winner_id
      WHERE id = NEW.next_match_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER matches_promote_winner
  AFTER UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.promote_winner_to_next_match();
