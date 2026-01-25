-- Add created_by column to teams table to track which user registered the team
ALTER TABLE teams ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_teams_created_by ON teams(created_by);

-- Add metadata_values column to teams table for storing custom metadata field values
ALTER TABLE teams ADD COLUMN IF NOT EXISTS metadata_values jsonb DEFAULT '{}'::jsonb;
