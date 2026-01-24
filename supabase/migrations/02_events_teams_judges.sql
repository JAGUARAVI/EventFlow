-- Events
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'points' CHECK (type IN ('points', 'bracket', 'poll', 'hybrid')),
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'private')),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  settings jsonb DEFAULT '{}'
);

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Teams
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, name)
);

-- Event judges (per-event judge assignment)
CREATE TABLE public.event_judges (
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

-- Helpers: can_manage_event(eid), can_judge_event(eid)
CREATE OR REPLACE FUNCTION public.can_manage_event(eid uuid)
RETURNS boolean AS $$
  SELECT public.is_admin()
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = eid AND e.created_by = auth.uid());
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.can_judge_event(eid uuid)
RETURNS boolean AS $$
  SELECT public.is_admin()
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = eid AND e.created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM public.event_judges ej WHERE ej.event_id = eid AND ej.user_id = auth.uid());
$$ LANGUAGE sql SECURITY DEFINER STABLE;
