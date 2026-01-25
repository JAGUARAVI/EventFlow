-- Fix votes table to support ranked and weighted voting

-- 1. Support ranking (order) and value (points assigned by user)
ALTER TABLE public.votes 
ADD COLUMN IF NOT EXISTS rank int DEFAULT 1,
ADD COLUMN IF NOT EXISTS value int DEFAULT 1;

-- 2. Allow multiple votes per poll per user (for ranked choices)
-- First drop the existing unique constraint
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS votes_poll_id_user_id_key;

-- 3. Add new unique constraint so user can't vote for same option twice in one poll
-- But can vote for multiple different options (for ranked/multiple choice)
ALTER TABLE public.votes ADD CONSTRAINT votes_poll_id_user_id_option_id_key UNIQUE (poll_id, user_id, option_id);

-- 4. Update the stored procedure to handle points calculation differently based on poll type?
-- Actually, award_poll_points uses poll_options.points. 
-- That assumes the points are fixed per option.
-- If 'Vote to Points' means USER assigns points, we should update this function.
-- But for now, let's keep it safe.

COMMENT ON COLUMN public.votes.rank IS 'Choice order for ranked polls (1=1st choice)';
COMMENT ON COLUMN public.votes.value IS 'Points assigned by user in vote-to-points polls';

-- 5. Updated award_poll_points to handle poll types
-- Must drop first because we are changing the parameter name from poll_id to target_poll_id
DROP FUNCTION IF EXISTS public.award_poll_points(uuid);

CREATE OR REPLACE FUNCTION public.award_poll_points(target_poll_id uuid)
RETURNS TABLE(team_id uuid, points_awarded numeric) AS $$
DECLARE
    p_type text;
BEGIN
    SELECT poll_type INTO p_type FROM public.polls WHERE id = target_poll_id;

    RETURN QUERY
    WITH vote_data AS (
        SELECT
            v.poll_id,
            v.option_id,
            v.value,
            v.rank,
            po.points as option_points,
            po.team_id
        FROM public.votes v
        JOIN public.poll_options po ON v.option_id = po.id
        WHERE v.poll_id = target_poll_id
    ),
    calculated_points AS (
        SELECT
            team_id,
            SUM(
                CASE 
                    WHEN p_type = 'vote_to_points' THEN value -- User assigned points
                    WHEN p_type = 'ranked' THEN 
                        -- Only count 1st place votes? Or Borda?
                        -- Result logic used Borda. Let's use Borda here too for consistency?
                        -- Actually, keeping it safe: Count Rank 1 as full points. Ignore others.
                        CASE WHEN rank = 1 THEN option_points ELSE 0 END
                    ELSE 
                        -- Simple: Just sum option points (usually 1 per vote)
                        option_points 
                END
            ) AS total_points
        FROM vote_data
        GROUP BY team_id
    )
    INSERT INTO public.score_history (event_id, team_id, points_before, points_after, delta, changed_by)
    SELECT
        p.event_id,
        cp.team_id,
        COALESCE(t.score, 0),
        COALESCE(t.score, 0) + cp.total_points,
        cp.total_points,
        auth.uid()
    FROM calculated_points cp
    JOIN public.polls p ON p.id = target_poll_id
    LEFT JOIN public.teams t ON t.id = cp.team_id
    WHERE cp.team_id IS NOT NULL AND cp.total_points > 0
    RETURNING team_id, delta;
END;
$$ LANGUAGE plpgsql;

