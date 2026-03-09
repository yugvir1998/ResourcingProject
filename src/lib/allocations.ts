import type { AllocationKey } from '@/types';

export const VENTURE_CREATION: { key: AllocationKey; label: string }[] = [
  { key: 'access', label: 'Access' },
  { key: 'explore', label: 'Explore' },
  { key: 'shape', label: 'Shape' },
  { key: 'build', label: 'Build' },
  { key: 'spin_out', label: 'Spin-Out' },
  { key: 'support', label: 'Support' },
];

export const STUDIO_ADMINISTRATION: { key: AllocationKey; label: string }[] = [
  { key: 'fundraising', label: 'Fundraising' },
  { key: 'finance_accounting', label: 'Finance / Accounting' },
  { key: 'legal', label: 'Legal' },
  { key: 'marketing_growth', label: 'Marketing / Growth' },
  { key: 'operations', label: 'Operations' },
  { key: 'hiring', label: 'Hiring' },
];

export const ALL_ALLOCATION_KEYS: AllocationKey[] = [
  ...VENTURE_CREATION.map((c) => c.key),
  ...STUDIO_ADMINISTRATION.map((c) => c.key),
];

export const DEFAULT_ALLOCATIONS: Record<AllocationKey, number> = ALL_ALLOCATION_KEYS.reduce(
  (acc, k) => ({ ...acc, [k]: 0 }),
  {} as Record<AllocationKey, number>
);
