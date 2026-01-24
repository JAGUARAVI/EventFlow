-- Add results_hidden to polls
ALTER TABLE polls ADD COLUMN IF NOT EXISTS results_hidden BOOLEAN DEFAULT FALSE;

-- Add image_url to poll_options
ALTER TABLE poll_options ADD COLUMN IF NOT EXISTS image_url TEXT;
