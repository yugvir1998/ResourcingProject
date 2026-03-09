-- Add 'pause' phase type for ventures on hold
ALTER TABLE venture_phases DROP CONSTRAINT IF EXISTS venture_phases_phase_check;
ALTER TABLE venture_phases ADD CONSTRAINT venture_phases_phase_check
  CHECK (phase IN ('explore', 'validate', 'define', 'build', 'spin_out', 'pause'));
