-- Add custom label to milestones (replaces role_type for display)
ALTER TABLE hiring_milestones ADD COLUMN IF NOT EXISTS label TEXT;

-- Backfill: set label from role_type for existing rows
UPDATE hiring_milestones
SET label = CASE role_type
  WHEN 'ceo' THEN 'Hire CEO'
  WHEN 'founding_engineer' THEN 'Hire Founding engineer'
  ELSE COALESCE(notes, 'Milestone')
END
WHERE label IS NULL;
