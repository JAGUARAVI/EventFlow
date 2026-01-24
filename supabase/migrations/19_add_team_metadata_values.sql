-- Add metadata_values column to teams table for storing custom metadata field values
ALTER TABLE teams ADD COLUMN IF NOT EXISTS metadata_values jsonb DEFAULT '{}'::jsonb;
