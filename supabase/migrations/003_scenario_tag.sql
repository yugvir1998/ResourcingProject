-- Scenario plan: tag employees as NITWIT (current hire) or potential_hire
-- NITWIT = current hire (not shown in UI)
-- potential_hire = shown as "Potential hire" tag in UI

ALTER TABLE employees ADD COLUMN IF NOT EXISTS scenario_tag TEXT DEFAULT 'nitwit';

-- Backfill existing employees as NITWIT (current hire)
UPDATE employees SET scenario_tag = 'nitwit' WHERE scenario_tag IS NULL;
