-- Add banner_url column to events table for custom event banner images
ALTER TABLE events ADD COLUMN IF NOT EXISTS banner_url text;
