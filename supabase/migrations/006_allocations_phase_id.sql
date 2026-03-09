-- Add phase_id to allocations (people assigned per phase)

ALTER TABLE allocations ADD COLUMN IF NOT EXISTS phase_id BIGINT REFERENCES venture_phases(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_allocations_phase ON allocations(phase_id);
