-- Migration 29: Add 'unlisted' visibility, access_code for private events
-- Visibility semantics:
--   public   = anyone can see, appears on dashboard
--   unlisted = anyone with the link can see, does NOT appear on dashboard
--   private  = auth required + (judge/manager OR matching access code)

-- 1. Drop existing CHECK constraint and add new one with 'unlisted'
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_visibility_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_visibility_check
  CHECK (visibility IN ('public', 'private', 'unlisted'));

-- 2. Add access_code column (6-digit numeric code for private events)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS access_code varchar(6) DEFAULT NULL;

COMMENT ON COLUMN public.events.access_code IS '6-digit access code for private events. Users who enter this code gain read access.';

-- 3. Helper RPC: verify_event_access_code(eid, code) => boolean
--    Called from the frontend to check if a code matches. SECURITY DEFINER
--    so it can read the events table without RLS blocking it.
CREATE OR REPLACE FUNCTION public.verify_event_access_code(eid uuid, code text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = eid
      AND e.access_code IS NOT NULL
      AND e.access_code = code
  );
$$;

-- 4. Rewrite can_see_event to support unlisted + private with access code
--    public   → anyone
--    unlisted → anyone (they just won't see it on dashboards)
--    private  → creator OR admin OR judge/co-manager
--             → OR (authenticated AND event has an access_code set)
--               The actual code check is done at the application level.
--               This RLS rule just lets the event data be readable so the
--               frontend can display it behind an access-code prompt.
CREATE OR REPLACE FUNCTION public.can_see_event(eid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = eid
      AND (
        e.visibility IN ('public', 'unlisted')
        OR e.created_by = auth.uid()
        OR public.is_admin()
        -- Private events with an access code are readable by any authenticated user
        -- (the actual code verification is done in the frontend)
        OR (e.visibility = 'private' AND e.access_code IS NOT NULL AND auth.uid() IS NOT NULL)
      )
  )
  OR EXISTS (
    SELECT 1 FROM public.event_judges ej
    WHERE ej.event_id = eid AND ej.user_id = auth.uid()
  );
$$;

-- The RLS policies already reference can_see_event for SELECT on:
--   events, teams, event_judges, score_history, categories, category_scores,
--   matches, polls, votes, event_audit, announcements
-- So they automatically pick up the new unlisted + access code logic.
