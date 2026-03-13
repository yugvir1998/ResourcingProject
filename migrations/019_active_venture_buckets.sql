-- Add bucket flags for Active Ventures: green-lit, active, paused
-- SQLite: one column per ALTER
ALTER TABLE ventures ADD COLUMN is_greenlit INTEGER DEFAULT 0;
ALTER TABLE ventures ADD COLUMN is_paused INTEGER DEFAULT 0;
ALTER TABLE ventures ADD COLUMN is_active INTEGER DEFAULT 1;
