-- Phase rename: exploration→explore, concept→validate, build→build, spin_out→spin_out
-- Add define phase type; create phase_activities table

-- Drop old CHECK constraint on venture_phases
ALTER TABLE venture_phases DROP CONSTRAINT IF EXISTS venture_phases_phase_check;

-- Migrate existing phase values
UPDATE venture_phases SET phase = 'explore' WHERE phase = 'exploration';
UPDATE venture_phases SET phase = 'validate' WHERE phase = 'concept';
UPDATE venture_phases SET phase = 'build' WHERE phase = 'build';
UPDATE venture_phases SET phase = 'spin_out' WHERE phase = 'spin_out';

-- Add new CHECK constraint
ALTER TABLE venture_phases ADD CONSTRAINT venture_phases_phase_check
  CHECK (phase IN ('explore', 'validate', 'define', 'build', 'spin_out'));

-- Phase activities: sub-activities within a phase (each with dates, draggable)
CREATE TABLE IF NOT EXISTS phase_activities (
  id BIGSERIAL PRIMARY KEY,
  venture_phase_id BIGINT NOT NULL REFERENCES venture_phases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  sort_order INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_phase_activities_venture_phase ON phase_activities(venture_phase_id);
