-- Phase 7.2: Event cloning support
-- Migration 19: Add clone_event function

CREATE OR REPLACE FUNCTION clone_event(
  source_event_id uuid,
  new_name text DEFAULT NULL,
  clone_teams boolean DEFAULT true,
  clone_judges boolean DEFAULT true,
  clone_matches boolean DEFAULT false,
  clone_polls boolean DEFAULT false
) RETURNS uuid AS $$
DECLARE
  new_event_id uuid;
  old_event record;
  new_team_map hstore;
  old_team_id uuid;
  new_team_id uuid;
  old_user_id uuid;
  old_match_id uuid;
  new_match_id uuid;
  old_poll_id uuid;
  new_poll_id uuid;
BEGIN
  -- Check authorization: user must be admin or event creator
  IF NOT (is_admin() OR EXISTS(
    SELECT 1 FROM events WHERE id = source_event_id AND created_by = auth.uid()
  )) THEN
    RAISE EXCEPTION 'Not authorized to clone this event';
  END IF;

  -- Fetch source event
  SELECT * INTO old_event FROM events WHERE id = source_event_id;
  IF old_event IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  -- Create new event
  INSERT INTO events (
    name,
    description,
    types,
    visibility,
    settings,
    created_by,
    status,
    timeline
  ) VALUES (
    COALESCE(new_name, old_event.name || ' (Copy)'),
    old_event.description,
    old_event.types,
    old_event.visibility,
    old_event.settings,
    auth.uid(),
    'draft',
    old_event.timeline
  ) RETURNING id INTO new_event_id;

  -- Clone teams if requested
  IF clone_teams THEN
    FOR old_team_id IN SELECT id FROM teams WHERE event_id = source_event_id LOOP
      INSERT INTO teams (
        event_id,
        name,
        score,
        metadata,
        description,
        poc_user_id
      ) SELECT
        new_event_id,
        name,
        0,  -- reset score
        metadata,
        description,
        poc_user_id
      FROM teams WHERE id = old_team_id
      RETURNING id INTO new_team_id;

      -- Store mapping for later use
      new_team_map :=  new_team_map || hstore(old_team_id::text, new_team_id::text);

    END LOOP;
  END IF;

  -- Clone judges if requested
  IF clone_judges THEN
    INSERT INTO event_judges (event_id, user_id)
    SELECT new_event_id, user_id FROM event_judges WHERE event_id = source_event_id
    ON CONFLICT DO NOTHING;
  END IF;

  -- Clone matches if requested
  IF clone_matches AND new_team_map IS NOT NULL THEN
    FOR old_match_id IN SELECT id FROM matches WHERE event_id = source_event_id LOOP
      INSERT INTO matches (
        event_id,
        bracket_type,
        round,
        position,
        team_a_id,
        team_b_id,
        team_a_score,
        team_b_score,
        winner_id,
        next_match_id,
        next_match_slot,
        status
      ) SELECT
        new_event_id,
        bracket_type,
        round,
        position,
        CASE WHEN team_a_id IS NOT NULL THEN (new_team_map -> team_a_id::text)::uuid ELSE NULL END,
        CASE WHEN team_b_id IS NOT NULL THEN (new_team_map -> team_b_id::text)::uuid ELSE NULL END,
        team_a_score,
        team_b_score,
        NULL,  -- reset winner
        NULL,  -- reset next_match_id (will need manual linking)
        next_match_slot,
        'pending'  -- reset status
      FROM matches WHERE id = old_match_id
      RETURNING id INTO new_match_id;
    END LOOP;
  END IF;

  -- Clone polls if requested
  IF clone_polls THEN
    FOR old_poll_id IN SELECT id FROM polls WHERE event_id = source_event_id LOOP
      INSERT INTO polls (
        event_id,
        question,
        poll_type,
        status
      ) SELECT
        new_event_id,
        question,
        poll_type,
        'draft'  -- reset to draft
      FROM polls WHERE id = old_poll_id
      RETURNING id INTO new_poll_id;

      -- Clone poll options
      INSERT INTO poll_options (
        poll_id,
        label,
        points,
        team_id,
        order_index
      ) SELECT
        new_poll_id,
        label,
        points,
        CASE WHEN team_id IS NOT NULL AND new_team_map IS NOT NULL
          THEN (new_team_map -> team_id::text)::uuid
          ELSE NULL
        END,
        order_index
      FROM poll_options WHERE poll_id = old_poll_id;
    END LOOP;
  END IF;

  RETURN new_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
