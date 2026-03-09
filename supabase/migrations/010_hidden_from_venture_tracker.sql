-- Add hidden_from_venture_tracker: when true, venture stays on Active Ventures but is hidden from Venture Tracker Kanban
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS hidden_from_venture_tracker BOOLEAN DEFAULT false;
