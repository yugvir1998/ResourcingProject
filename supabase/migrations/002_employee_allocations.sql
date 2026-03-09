-- Add allocations JSONB to employees
-- Keys: access, exploration, concept, build, spin_out, support, fundraising, finance_accounting, legal, marketing_growth, operations, hiring

ALTER TABLE employees ADD COLUMN IF NOT EXISTS allocations JSONB DEFAULT '{}';

-- Make spectrum nullable (deprecated in favor of allocations)
ALTER TABLE employees ALTER COLUMN spectrum DROP NOT NULL;
ALTER TABLE employees ALTER COLUMN spectrum DROP DEFAULT;
