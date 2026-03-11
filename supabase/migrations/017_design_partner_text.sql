-- Add design_partner as free-form text for Exploration Staging cards
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS design_partner TEXT;
