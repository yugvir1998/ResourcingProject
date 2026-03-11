-- Add tentative_start_date and exploration_staging status for Command Center refactor

ALTER TABLE ventures ADD COLUMN IF NOT EXISTS tentative_start_date DATE;

-- Extend status to include exploration_staging
ALTER TABLE ventures DROP CONSTRAINT IF EXISTS ventures_status_check;
ALTER TABLE ventures ADD CONSTRAINT ventures_status_check
  CHECK (status IN ('backlog', 'exploration_staging', 'active', 'support'));
