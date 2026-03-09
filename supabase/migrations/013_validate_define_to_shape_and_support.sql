-- Combine Validate and Define into Shape phase; add Support phase
-- Update existing venture_phases: validate and define → shape
UPDATE venture_phases SET phase = 'shape' WHERE phase IN ('validate', 'define');

-- Update CHECK constraint
ALTER TABLE venture_phases DROP CONSTRAINT IF EXISTS venture_phases_phase_check;
ALTER TABLE venture_phases ADD CONSTRAINT venture_phases_phase_check
  CHECK (phase IN ('explore', 'shape', 'build', 'spin_out', 'support', 'pause'));
