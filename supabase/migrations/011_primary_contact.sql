-- Add primary contact (point of contact) to ventures
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS primary_contact_id BIGINT REFERENCES employees(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ventures_primary_contact ON ventures(primary_contact_id);
