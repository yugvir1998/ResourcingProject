export type VentureStatus = 'backlog' | 'active' | 'support';
export type DesignPartnerStatus =
  | 'coordinating'
  | 'early_conversations'
  | 'pitched_negotiating'
  | 'signed_awaiting_start'
  | 'pre_vetting'
  | 'awaiting_start';
export type ExplorationPhase =
  | 'discovery'
  | 'message_market_fit'
  | 'prototyping'
  | 'product_definition'
  | 'awaiting_build';
export type Spectrum = 'venture_leader' | 'engineer' | 'studio_function' | 'other';
export type PhaseType = 'explore' | 'validate' | 'define' | 'build' | 'spin_out' | 'pause';
export type RoleType = 'ceo' | 'founding_engineer' | 'other';

export interface Venture {
  id: number;
  name: string;
  status: VentureStatus;
  backlog_priority: number;
  design_partner_status: DesignPartnerStatus | null;
  exploration_phase: ExplorationPhase | null;
  one_metric_that_matters: string | null;
  notes: string | null;
  next_steps: string | null;
  primary_contact_id?: number | null;
  timeline_visible?: boolean | null;
  hidden_from_venture_tracker?: boolean | null;
  created_at: string;
  updated_at: string;
}

export type AllocationKey =
  | 'access'
  | 'explore'
  | 'validate'
  | 'define'
  | 'build'
  | 'spin_out'
  | 'support'
  | 'fundraising'
  | 'finance_accounting'
  | 'legal'
  | 'marketing_growth'
  | 'operations'
  | 'hiring';

export type EmployeeAllocations = Partial<Record<AllocationKey, number>>;

export type ScenarioTag = 'nitwit' | 'potential_hire';

export interface Employee {
  id: number;
  name: string;
  title: string;
  spectrum?: Spectrum | null;
  allocations?: EmployeeAllocations | null;
  scenario_tag?: ScenarioTag | null;
  created_at: string;
}

export interface VenturePhase {
  id: number;
  venture_id: number;
  phase: PhaseType;
  start_date: string;
  end_date: string;
  sort_order: number;
}

export interface PhaseActivity {
  id: number;
  venture_phase_id: number;
  name: string;
  start_date: string;
  end_date: string;
  sort_order: number;
}

export interface HiringMilestone {
  id: number;
  venture_id: number;
  role_type: RoleType;
  label: string | null;
  target_date: string;
  notes: string | null;
}

export interface Allocation {
  id: number;
  employee_id: number;
  venture_id: number;
  phase_id?: number | null;
  fte_percentage: number;
  week_start: string;
  notes: string | null;
}
