-- Venture Tracker: new design_partner_status and exploration_phase values

-- 1. design_partner_status: drop old constraint, migrate data, add new constraint
ALTER TABLE ventures DROP CONSTRAINT IF EXISTS ventures_design_partner_status_check;

UPDATE ventures SET design_partner_status = 'early_conversations' WHERE design_partner_status = 'meeting_scheduled';
UPDATE ventures SET design_partner_status = 'pitched_negotiating' WHERE design_partner_status = 'pitched';
UPDATE ventures SET design_partner_status = 'pitched_negotiating' WHERE design_partner_status = 'negotiating';
UPDATE ventures SET design_partner_status = 'signed_awaiting_start' WHERE design_partner_status = 'signed';
UPDATE ventures SET design_partner_status = 'pre_vetting' WHERE design_partner_status = 'none' OR design_partner_status IS NULL;

ALTER TABLE ventures ADD CONSTRAINT ventures_design_partner_status_check CHECK (
  design_partner_status IN (
    'coordinating', 'early_conversations', 'pitched_negotiating', 'signed_awaiting_start',
    'pre_vetting', 'awaiting_start'
  )
);

ALTER TABLE ventures ALTER COLUMN design_partner_status SET DEFAULT 'coordinating';

-- 2. exploration_phase: drop old constraint, add new with product_definition and awaiting_build
ALTER TABLE ventures DROP CONSTRAINT IF EXISTS ventures_exploration_phase_check;

ALTER TABLE ventures ADD CONSTRAINT ventures_exploration_phase_check CHECK (
  exploration_phase IN (
    'discovery', 'message_market_fit', 'prototyping',
    'product_definition', 'awaiting_build'
  )
);
