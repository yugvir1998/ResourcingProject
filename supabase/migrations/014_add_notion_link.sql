-- Add Notion link to ventures (for reading materials)
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS notion_link TEXT;
