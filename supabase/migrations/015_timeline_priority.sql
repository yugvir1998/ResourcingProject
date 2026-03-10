-- Add timeline_priority: controls order of ventures on the timeline (independent from backlog_priority)
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS timeline_priority INTEGER DEFAULT 0;
