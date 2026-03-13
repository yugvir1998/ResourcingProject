-- Add bucket flags for Active Ventures: green-lit, active, paused
ALTER TABLE ventures
  ADD COLUMN IF NOT EXISTS is_greenlit BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
