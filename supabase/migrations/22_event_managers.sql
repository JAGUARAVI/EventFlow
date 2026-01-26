-- Add can_manage column to event_judges to allow granting manage access
-- This allows event organizers to grant manage access to other users

ALTER TABLE public.event_judges 
ADD COLUMN IF NOT EXISTS can_manage boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.event_judges.can_manage IS 'If true, this user has full manage access to the event (same as owner)';

-- Update the can_manage_event function to include event_judges with can_manage = true
CREATE OR REPLACE FUNCTION public.can_manage_event(eid uuid)
RETURNS boolean AS $$
  SELECT public.is_admin()
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = eid AND e.created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM public.event_judges ej WHERE ej.event_id = eid AND ej.user_id = auth.uid() AND ej.can_manage = true);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_event_judges_can_manage ON public.event_judges(event_id, can_manage) WHERE can_manage = true;
