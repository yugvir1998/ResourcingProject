-- Resourcing Dashboard - Initial Schema
-- Run with: npm run db:migrate

-- Track which migrations have run
CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY,
  applied_at TEXT DEFAULT (datetime('now'))
);

-- Employees: team roster (20-25 people)
CREATE TABLE employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  spectrum TEXT NOT NULL CHECK (spectrum IN ('venture_leader', 'engineer', 'studio_function', 'other')),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Ventures: explorations and ventures (backlog + active + support)
CREATE TABLE ventures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('backlog', 'active', 'support')),
  backlog_priority INTEGER DEFAULT 0,
  design_partner_status TEXT CHECK (design_partner_status IN ('meeting_scheduled', 'pitched', 'negotiating', 'signed', 'none')),
  exploration_phase TEXT CHECK (exploration_phase IN ('discovery', 'message_market_fit', 'prototyping')),
  one_metric_that_matters TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Venture phases: timeline phases per venture (exploration, concept, build, spin_out)
CREATE TABLE venture_phases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venture_id INTEGER NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  phase TEXT NOT NULL CHECK (phase IN ('exploration', 'concept', 'build', 'spin_out')),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY (venture_id) REFERENCES ventures(id)
);

CREATE INDEX idx_venture_phases_venture ON venture_phases(venture_id);

-- Hiring milestones: when to start hiring which roles per venture
CREATE TABLE hiring_milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venture_id INTEGER NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  role_type TEXT NOT NULL CHECK (role_type IN ('ceo', 'founding_engineer', 'other')),
  target_date TEXT NOT NULL,
  notes TEXT,
  FOREIGN KEY (venture_id) REFERENCES ventures(id)
);

CREATE INDEX idx_hiring_milestones_venture ON hiring_milestones(venture_id);

-- Allocations: FTE per person per venture per period
CREATE TABLE allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  venture_id INTEGER NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  fte_percentage REAL NOT NULL CHECK (fte_percentage >= 0 AND fte_percentage <= 100),
  week_start TEXT NOT NULL,
  notes TEXT,
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (venture_id) REFERENCES ventures(id)
);

CREATE INDEX idx_allocations_employee ON allocations(employee_id);
CREATE INDEX idx_allocations_venture ON allocations(venture_id);

-- Support assignments: board/partner and studio support for ventures in support mode
CREATE TABLE support_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venture_id INTEGER NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  fte_percentage REAL NOT NULL CHECK (fte_percentage >= 0 AND fte_percentage <= 100),
  notes TEXT,
  FOREIGN KEY (venture_id) REFERENCES ventures(id),
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE INDEX idx_support_assignments_venture ON support_assignments(venture_id);
CREATE INDEX idx_support_assignments_employee ON support_assignments(employee_id);

-- Record this migration
INSERT INTO schema_migrations (name) VALUES ('001_initial.sql');
