-- Exclude a phase from capacity / scenario views (timeline bars + allocation rollups).
ALTER TABLE venture_phases
  ADD COLUMN IF NOT EXISTS hidden_from_capacity BOOLEAN NOT NULL DEFAULT false;
