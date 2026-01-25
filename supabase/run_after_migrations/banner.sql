-- Add banner_url column to events table for custom event banner images
ALTER TABLE events ADD COLUMN IF NOT EXISTS banner_url text;

-- Add settings jsonb column to events table for storing visibility preferences
ALTER TABLE events ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS event_types text[] NOT NULL DEFAULT '{}';

-- Backfill existing data from legacy single type
UPDATE public.events
SET event_types = CASE
  WHEN type = 'hybrid' THEN ARRAY['points','bracket','poll']
  WHEN type IS NULL OR TRIM(type) = '' THEN ARRAY['points']
  ELSE ARRAY[type]
END
WHERE event_types = '{}'::text[];
