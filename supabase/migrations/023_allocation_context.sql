-- Split allocation intent between pre-exploration and delivery/planning.
ALTER TABLE allocations
ADD COLUMN IF NOT EXISTS context TEXT;

UPDATE allocations a
SET context = CASE
  WHEN v.status = 'exploration_staging' AND a.phase_id IS NULL THEN 'pre_exploration'
  ELSE 'planned'
END
FROM ventures v
WHERE v.id = a.venture_id
  AND a.context IS NULL;

UPDATE allocations
SET context = 'planned'
WHERE context IS NULL;

ALTER TABLE allocations
ALTER COLUMN context SET DEFAULT 'planned';

ALTER TABLE allocations
ALTER COLUMN context SET NOT NULL;

ALTER TABLE allocations
DROP CONSTRAINT IF EXISTS allocations_context_check;

ALTER TABLE allocations
ADD CONSTRAINT allocations_context_check
CHECK (context IN ('pre_exploration', 'planned'));

CREATE INDEX IF NOT EXISTS idx_allocations_venture_context_week
  ON allocations (venture_id, context, week_start);
