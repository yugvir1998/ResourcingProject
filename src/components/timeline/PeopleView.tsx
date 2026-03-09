'use client';

import { useState } from 'react';
import type { Venture, VenturePhase, Allocation, Employee } from '@/types';

const PHASE_LABELS: Record<string, string> = {
  explore: 'Explore',
  validate: 'Validate',
  define: 'Define',
  build: 'Build',
  spin_out: 'Spin out',
};

interface PeopleViewProps {
  ventures: Venture[];
  phases: VenturePhase[];
  allocations: Allocation[];
  employees: Employee[];
  visibleStartDate: Date;
  visibleEndDate: Date;
}

function phaseOverlapsRange(
  phaseStart: string,
  phaseEnd: string,
  rangeStart: Date,
  rangeEnd: Date
): boolean {
  const pStart = new Date(phaseStart).getTime();
  const pEnd = new Date(phaseEnd).getTime();
  const rStart = rangeStart.getTime();
  const rEnd = rangeEnd.getTime();
  return pStart <= rEnd && pEnd >= rStart;
}

export function PeopleView({
  ventures,
  phases,
  allocations,
  employees,
  visibleStartDate,
  visibleEndDate,
}: PeopleViewProps) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const phaseMap = new Map(phases.map((p) => [p.id, p]));
  const ventureMap = new Map(ventures.map((v) => [v.id, v]));

  const employeeAllocations: Array<{
    employee: Employee;
    items: Array<{ venture: Venture; phase: VenturePhase; fte: number }>;
    totalFte: number;
  }> = [];

  for (const emp of employees) {
    const empAllocs = allocations.filter((a) => a.employee_id === emp.id);
    const items: Array<{ venture: Venture; phase: VenturePhase; fte: number }> = [];
    let totalFte = 0;

    for (const a of empAllocs) {
      const phase = a.phase_id ? phaseMap.get(a.phase_id) : null;
      if (!phase) continue;

      const venture = ventureMap.get(a.venture_id);
      if (!venture) continue;

      if (!phaseOverlapsRange(phase.start_date, phase.end_date, visibleStartDate, visibleEndDate)) {
        continue;
      }

      items.push({
        venture,
        phase,
        fte: a.fte_percentage,
      });
      totalFte += a.fte_percentage;
    }

    if (items.length > 0) {
      employeeAllocations.push({
        employee: emp,
        items,
        totalFte: Math.min(100, totalFte),
      });
    }
  }

  const toggleExpanded = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatDateRange = (start: Date, end: Date) => {
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
  };

  if (employeeAllocations.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold text-zinc-800">People view</h3>
        <p className="text-sm text-zinc-500">
          No allocations in the visible date range. Scroll the timeline or add people to phases.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-zinc-800">People view</h3>
        <p className="mt-0.5 text-xs text-zinc-500">
          {formatDateRange(visibleStartDate, visibleEndDate)} — synced to timeline
        </p>
      </div>
      <div className="divide-y divide-zinc-100">
        {employeeAllocations.map(({ employee, items, totalFte }) => {
          const isExpanded = expandedIds.has(employee.id);
          return (
            <div key={employee.id} className="px-4 py-2">
              <button
                type="button"
                onClick={() => toggleExpanded(employee.id)}
                className="flex w-full items-center justify-between text-left hover:bg-zinc-50"
              >
                <span className="font-medium text-zinc-800">{employee.name}</span>
                <span className="text-xs text-zinc-500">
                  {totalFte}% total
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`ml-1 inline transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </button>
              {isExpanded && (
                <ul className="mt-2 space-y-1 pl-2">
                  {items.map((item, idx) => (
                    <li
                      key={`${item.venture.id}-${item.phase.id}-${idx}`}
                      className="flex items-center gap-2 text-sm text-zinc-600"
                    >
                      <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                        {PHASE_LABELS[item.phase.phase] || item.phase.phase}
                      </span>
                      <span className="truncate">{item.venture.name}</span>
                      <span className="shrink-0 font-medium text-zinc-800">{item.fte}%</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
