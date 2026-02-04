-- Add restricted_to column to polls table
-- Allows restricting who can vote on a poll:
-- NULL or 'everyone' = anyone can vote (default behavior)
-- 'judges' = only judges can vote
-- 'managers' = only users with manage access can vote

ALTER TABLE public.polls
ADD COLUMN restricted_to text DEFAULT NULL
CHECK (restricted_to IS NULL OR restricted_to IN ('everyone', 'judges', 'managers'));

COMMENT ON COLUMN public.polls.restricted_to IS 'Restricts who can vote: NULL/everyone = all users, judges = judges only, managers = managers only';
