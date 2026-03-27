-- Role tags for roster / People Allocation grouping (separate from scenario_tag hire status)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS people_tag TEXT;
