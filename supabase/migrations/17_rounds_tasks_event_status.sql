-- Phase 6.1: Rounds, Tasks, and Event Status/Timeline
-- Migration 17: Add rounds and tasks infrastructure

-- 1. Create rounds table
CREATE TABLE rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  number int NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | active | completed
  start_date timestamptz,
  end_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, number)
);

CREATE INDEX idx_rounds_event_id ON rounds(event_id);
CREATE INDEX idx_rounds_status ON rounds(status);

-- 2. Add status and timeline to events
ALTER TABLE events ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft'; -- draft | registration_open | registration_closed | live | completed | archived
ALTER TABLE events ADD COLUMN IF NOT EXISTS timeline jsonb DEFAULT '{}'; -- {registration_start, registration_end, event_start, event_end, ...}

CREATE INDEX idx_events_status ON events(status);

-- 3. Create tasks table
CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  due_date timestamptz,
  status text NOT NULL DEFAULT 'pending', -- pending | in_progress | completed
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_event_id ON tasks(event_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);

-- 4. Create task_scores table (for task-based scoring)
CREATE TABLE task_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  points numeric NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(task_id, team_id)
);

CREATE INDEX idx_task_scores_team_id ON task_scores(team_id);
CREATE INDEX idx_task_scores_task_id ON task_scores(task_id);

-- 5. RLS Policies for rounds
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rounds_public_read" ON rounds
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM events
      WHERE events.id = rounds.event_id
      AND (
        events.visibility = 'public'
        OR events.created_by = auth.uid()
        OR EXISTS(SELECT 1 FROM event_judges WHERE event_judges.event_id = events.id AND event_judges.user_id = auth.uid())
      )
    )
  );

CREATE POLICY "rounds_manage_own_event" ON rounds
  FOR ALL USING (
    EXISTS(
      SELECT 1 FROM events
      WHERE events.id = rounds.event_id
      AND (events.created_by = auth.uid() OR is_admin())
    )
  )
  WITH CHECK (
    EXISTS(
      SELECT 1 FROM events
      WHERE events.id = rounds.event_id
      AND (events.created_by = auth.uid() OR is_admin())
    )
  );

-- 6. RLS Policies for tasks
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_can_view_own_event" ON tasks
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM events
      WHERE events.id = tasks.event_id
      AND (
        events.created_by = auth.uid()
        OR EXISTS(SELECT 1 FROM event_judges WHERE event_judges.event_id = events.id AND event_judges.user_id = auth.uid())
      )
    )
  );

CREATE POLICY "tasks_manage_own_event" ON tasks
  FOR ALL USING (
    EXISTS(
      SELECT 1 FROM events
      WHERE events.id = tasks.event_id
      AND (events.created_by = auth.uid() OR is_admin())
    )
  )
  WITH CHECK (
    EXISTS(
      SELECT 1 FROM events
      WHERE events.id = tasks.event_id
      AND (events.created_by = auth.uid() OR is_admin())
    )
  );

-- 7. RLS Policies for task_scores
ALTER TABLE task_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_scores_view_own_event" ON task_scores
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM tasks
      JOIN events ON events.id = tasks.event_id
      WHERE tasks.id = task_scores.task_id
      AND (
        events.created_by = auth.uid()
        OR EXISTS(SELECT 1 FROM event_judges WHERE event_judges.event_id = events.id AND event_judges.user_id = auth.uid())
      )
    )
  );

CREATE POLICY "task_scores_manage_own_event" ON task_scores
  FOR ALL USING (
    EXISTS(
      SELECT 1 FROM tasks
      JOIN events ON events.id = tasks.event_id
      WHERE tasks.id = task_scores.task_id
      AND (
        events.created_by = auth.uid()
        OR EXISTS(SELECT 1 FROM event_judges WHERE event_judges.event_id = events.id AND event_judges.user_id = auth.uid())
      )
    )
  )
  WITH CHECK (
    EXISTS(
      SELECT 1 FROM tasks
      JOIN events ON events.id = tasks.event_id
      WHERE tasks.id = task_scores.task_id
      AND (
        events.created_by = auth.uid()
        OR EXISTS(SELECT 1 FROM event_judges WHERE event_judges.event_id = events.id AND event_judges.user_id = auth.uid())
      )
    )
  );

-- 8. Helper function: Check event status
CREATE OR REPLACE FUNCTION can_edit_event(event_id uuid) RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT status NOT IN ('live', 'completed', 'archived')
    FROM events
    WHERE id = event_id
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- 9. Realtime enable
ALTER PUBLICATION supabase_realtime ADD TABLE rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE task_scores;
