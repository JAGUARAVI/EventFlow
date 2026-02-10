-- ============================================================
-- Categories & Category Scores for per-category point tracking
-- ============================================================

-- Categories: each event can define scoring categories with a multiplier
CREATE TABLE public.categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text DEFAULT '',
  points_multiplier float NOT NULL DEFAULT 1.0,
  created_by  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, name)
);

CREATE TRIGGER categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories_select" ON public.categories FOR SELECT
  USING (public.can_see_event(event_id));

CREATE POLICY "categories_insert" ON public.categories FOR INSERT
  WITH CHECK (public.can_manage_event(event_id));

CREATE POLICY "categories_update" ON public.categories FOR UPDATE
  USING (public.can_manage_event(event_id));

CREATE POLICY "categories_delete" ON public.categories FOR DELETE
  USING (public.can_manage_event(event_id));

-- Category scores: per-team per-category raw points
CREATE TABLE public.category_scores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  team_id     uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  raw_points  numeric NOT NULL DEFAULT 0,
  changed_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, category_id)
);

CREATE TRIGGER category_scores_updated_at
  BEFORE UPDATE ON public.category_scores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.category_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cat_scores_select" ON public.category_scores FOR SELECT
  USING (public.can_see_event(event_id));

CREATE POLICY "cat_scores_insert" ON public.category_scores FOR INSERT
  WITH CHECK (public.can_judge_event(event_id));

CREATE POLICY "cat_scores_update" ON public.category_scores FOR UPDATE
  USING (public.can_judge_event(event_id));

-- Indexes for fast lookups
CREATE INDEX idx_categories_event ON public.categories(event_id);
CREATE INDEX idx_category_scores_event ON public.category_scores(event_id);
CREATE INDEX idx_category_scores_team ON public.category_scores(team_id);
CREATE INDEX idx_category_scores_category ON public.category_scores(category_id);

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.category_scores;
