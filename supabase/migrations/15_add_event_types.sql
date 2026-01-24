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
