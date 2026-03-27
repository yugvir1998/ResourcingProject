-- Soft delete ventures so undo can restore without recreating phases/allocations
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_ventures_active ON ventures (id) WHERE deleted_at IS NULL;
