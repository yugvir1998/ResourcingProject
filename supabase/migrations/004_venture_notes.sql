-- Add notes and next_steps to ventures

ALTER TABLE ventures ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS next_steps TEXT;
