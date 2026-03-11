-- Add planned status: ventures on timeline but tentative (grayed out) until Greenlit
ALTER TABLE ventures DROP CONSTRAINT IF EXISTS ventures_status_check;
ALTER TABLE ventures ADD CONSTRAINT ventures_status_check
  CHECK (status IN ('backlog', 'exploration_staging', 'planned', 'active', 'support'));
