-- Resourcing Dashboard - Initial Schema for Supabase (PostgreSQL)
-- Run this in Supabase Dashboard: SQL Editor > New query > Paste and Run

-- Employees: team roster (20-25 people)
CREATE TABLE employees (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  spectrum TEXT NOT NULL CHECK (spectrum IN ('venture_leader', 'engineer', 'studio_function', 'other')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ventures: explorations and ventures (backlog + active + support)
CREATE TABLE ventures (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('backlog', 'active', 'support')),
  backlog_priority INTEGER DEFAULT 0,
  design_partner_status TEXT CHECK (design_partner_status IN ('meeting_scheduled', 'pitched', 'negotiating', 'signed', 'none')),
  exploration_phase TEXT CHECK (exploration_phase IN ('discovery', 'message_market_fit', 'prototyping')),
  one_metric_that_matters TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-update updated_at on ventures
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ventures_updated_at
  BEFORE UPDATE ON ventures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Venture phases: timeline phases per venture
CREATE TABLE venture_phases (
  id BIGSERIAL PRIMARY KEY,
  venture_id BIGINT NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  phase TEXT NOT NULL CHECK (phase IN ('exploration', 'concept', 'build', 'spin_out')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  sort_order INTEGER DEFAULT 0
);

CREATE INDEX idx_venture_phases_venture ON venture_phases(venture_id);

-- Hiring milestones: when to start hiring which roles per venture
CREATE TABLE hiring_milestones (
  id BIGSERIAL PRIMARY KEY,
  venture_id BIGINT NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  role_type TEXT NOT NULL CHECK (role_type IN ('ceo', 'founding_engineer', 'other')),
  target_date DATE NOT NULL,
  notes TEXT
);

CREATE INDEX idx_hiring_milestones_venture ON hiring_milestones(venture_id);

-- Allocations: FTE per person per venture per period
CREATE TABLE allocations (
  id BIGSERIAL PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  venture_id BIGINT NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  fte_percentage REAL NOT NULL CHECK (fte_percentage >= 0 AND fte_percentage <= 100),
  week_start DATE NOT NULL,
  notes TEXT
);

CREATE INDEX idx_allocations_employee ON allocations(employee_id);
CREATE INDEX idx_allocations_venture ON allocations(venture_id);

-- Support assignments: board/partner and studio support for ventures in support mode
CREATE TABLE support_assignments (
  id BIGSERIAL PRIMARY KEY,
  venture_id BIGINT NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  fte_percentage REAL NOT NULL CHECK (fte_percentage >= 0 AND fte_percentage <= 100),
  notes TEXT
);

CREATE INDEX idx_support_assignments_venture ON support_assignments(venture_id);
CREATE INDEX idx_support_assignments_employee ON support_assignments(employee_id);

-- Enable Row Level Security (RLS)
-- API routes use SUPABASE_SERVICE_ROLE_KEY which bypasses RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventures ENABLE ROW LEVEL SECURITY;
ALTER TABLE venture_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE hiring_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_assignments ENABLE ROW LEVEL SECURITY;

-- Allow all for anon (so dashboard works when using anon key; restrict in production if needed)
CREATE POLICY "Allow all" ON employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON ventures FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON venture_phases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON hiring_milestones FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON allocations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON support_assignments FOR ALL USING (true) WITH CHECK (true);
