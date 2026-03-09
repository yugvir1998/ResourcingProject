-- Add timeline_visible to ventures (controls which ventures appear on timeline)

ALTER TABLE ventures ADD COLUMN IF NOT EXISTS timeline_visible BOOLEAN DEFAULT false;
