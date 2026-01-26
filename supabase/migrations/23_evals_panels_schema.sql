-- Evals and Panels schema for scheduling team evaluations
-- This adds a new event type 'evals' for scheduling panel-based evaluations

-- Panels table: Evaluation panels with location/room info
CREATE TABLE public.eval_panels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text, -- Markdown description
  location text, -- Room/location info
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'delayed', 'completed')),
  delay_minutes int DEFAULT 0, -- How many minutes delayed
  delay_reason text, -- Optional reason for delay
  paused_at timestamptz, -- When panel was paused
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, name)
);

CREATE TRIGGER eval_panels_updated_at
  BEFORE UPDATE ON public.eval_panels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Panel judges: Judges assigned to specific panels
CREATE TABLE public.eval_panel_judges (
  panel_id uuid NOT NULL REFERENCES public.eval_panels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  can_manage boolean NOT NULL DEFAULT false, -- Can edit panel description
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (panel_id, user_id)
);

-- Team evaluations: Schedule for each team under a panel
CREATE TABLE public.eval_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_id uuid NOT NULL REFERENCES public.eval_panels(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL, -- Original scheduled time
  actual_start timestamptz, -- When eval actually started
  actual_end timestamptz, -- When eval actually ended
  duration_minutes int DEFAULT 15, -- Expected duration
  status text NOT NULL DEFAULT 'scheduled' CHECK (
    status IN ('scheduled', 'live', 'completed', 'rescheduled', 'no_show', 'cancelled')
  ),
  notes text, -- Judge notes for this evaluation
  score numeric, -- Optional score/rating
  original_slot_id uuid REFERENCES public.eval_slots(id) ON DELETE SET NULL, -- If rescheduled, points to original
  reschedule_reason text, -- Reason for rescheduling
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (panel_id, team_id, scheduled_at)
);

CREATE TRIGGER eval_slots_updated_at
  BEFORE UPDATE ON public.eval_slots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Helper function: Can user manage a panel (event owner, admin, or panel judge with can_manage)
CREATE OR REPLACE FUNCTION public.can_manage_panel(panel_id uuid)
RETURNS boolean AS $$
  SELECT public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.eval_panels ep
      JOIN public.events e ON ep.event_id = e.id
      WHERE ep.id = panel_id AND e.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.eval_panel_judges epj
      WHERE epj.panel_id = can_manage_panel.panel_id 
      AND epj.user_id = auth.uid() 
      AND epj.can_manage = true
    )
    OR EXISTS (
      SELECT 1 FROM public.eval_panels ep
      JOIN public.event_judges ej ON ep.event_id = ej.event_id
      WHERE ep.id = panel_id AND ej.user_id = auth.uid() AND ej.can_manage = true
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: Is user a judge on a panel (any level)
CREATE OR REPLACE FUNCTION public.is_panel_judge(panel_id uuid)
RETURNS boolean AS $$
  SELECT public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.eval_panels ep
      JOIN public.events e ON ep.event_id = e.id
      WHERE ep.id = panel_id AND e.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.eval_panel_judges epj
      WHERE epj.panel_id = is_panel_judge.panel_id AND epj.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.eval_panels ep
      JOIN public.event_judges ej ON ep.event_id = ej.event_id
      WHERE ep.id = panel_id AND ej.user_id = auth.uid()
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Index for efficient queries
CREATE INDEX idx_eval_panels_event_id ON public.eval_panels(event_id);
CREATE INDEX idx_eval_panel_judges_panel_id ON public.eval_panel_judges(panel_id);
CREATE INDEX idx_eval_panel_judges_user_id ON public.eval_panel_judges(user_id);
CREATE INDEX idx_eval_slots_panel_id ON public.eval_slots(panel_id);
CREATE INDEX idx_eval_slots_team_id ON public.eval_slots(team_id);
CREATE INDEX idx_eval_slots_scheduled_at ON public.eval_slots(scheduled_at);
CREATE INDEX idx_eval_slots_status ON public.eval_slots(status);
