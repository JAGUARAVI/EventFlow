-- Add settings jsonb column to events table for storing visibility preferences
ALTER TABLE events ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}'::jsonb;
