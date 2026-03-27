'use client';

import type { Venture, VenturePhase, Allocation, Employee } from '@/types';
import { isPhaseIncludedInCapacity } from '@/lib/phaseCapacity';

type AllocationItem = { venture: Venture; phase: VenturePhase; fte: number };

// Rose-tinted palette for venture segments (capacity bars)
const VENTURE_SEGMENT_COLORS = [
  'bg-rose-300',
  'bg-rose-400',
  'bg-rose-500',
  'bg-rose-600',
  'bg-rose-700',
  'bg-rose-800',
];

function dateToOffset(dateStr: string, startDate: Date, totalDays: number): number {
  const startTime = startDate.getTime();
  const dateTime = new Date(dateStr).getTime();
  const totalMs = totalDays * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.min(100, ((dateTime - startTime) / totalMs) * 100));
}

function getWeekWidthPct(totalDays: number): number {
  const weekDays = 7;
  return (weekDays / totalDays) * 100;
}

interface PeopleViewProps {
  ventures: Venture[];
  phases: VenturePhase[];
  allocations: Allocation[];
  employees: Employee[];
  startDate: Date;
  endDate: Date;
  totalDays: number;
  gridWidth: number;
}

export function PeopleView({
  ventures,
  phases,
  allocations,
  employees,
  startDate,
  endDate,
  totalDays,
  gridWidth,
}: PeopleViewProps) {
  const phaseMap = new Map(phases.map((p) => [p.id, p]));
  const ventureMap = new Map(ventures.map((v) => [v.id, v]));

  // Group allocations by employee and week_start
  const byEmployeeAndWeek = new Map<number, Map<string, AllocationItem[]>>();

  const startTime = startDate.getTime();
  const endTime = endDate.getTime();

  for (const a of allocations) {
    const phase = a.phase_id ? phaseMap.get(a.phase_id) : null;
    const venture = ventureMap.get(a.venture_id);
    if (!phase || !venture || !isPhaseIncludedInCapacity(phase)) continue;

    const weekStart = a.week_start;
    const weekTime = new Date(weekStart).getTime();
    if (weekTime < startTime || weekTime > endTime) continue;
    if (!byEmployeeAndWeek.has(a.employee_id)) {
      byEmployeeAndWeek.set(a.employee_id, new Map());
    }
    const weekMap = byEmployeeAndWeek.get(a.employee_id)!;
    if (!weekMap.has(weekStart)) {
      weekMap.set(weekStart, []);
    }
    const existing = weekMap.get(weekStart)!.find((x) => x.venture.id === venture.id);
    if (existing) {
      existing.fte += a.fte_percentage;
    } else {
      weekMap.get(weekStart)!.push({ venture, phase, fte: a.fte_percentage });
    }
  }

  // Employees with allocations in range
  const employeeIds = new Set(byEmployeeAndWeek.keys());
  const peopleRows = employees.filter((e) => employeeIds.has(e.id));
  if (peopleRows.length === 0) {
    return (
      <div className="flex min-w-max border-t border-zinc-200 pt-1">
        <div className="sticky left-0 z-20 w-48 shrink-0" aria-hidden />
        <div className="flex shrink-0 items-center bg-zinc-50 px-4" style={{ width: gridWidth }}>
          <p className="text-sm text-zinc-500">No people allocated yet. Add team members to phases to see capacity here.</p>
        </div>
      </div>
    );
  }

  const ventureColorIndex = new Map<number, number>();
  let colorIdx = 0;
  ventures.forEach((v) => {
    if (!ventureColorIndex.has(v.id)) {
      ventureColorIndex.set(v.id, colorIdx++ % VENTURE_SEGMENT_COLORS.length);
    }
  });

  return (
    <div className="flex flex-col border-t border-zinc-200 pt-1">
      {peopleRows.map((emp, idx) => {
        const weekMap = byEmployeeAndWeek.get(emp.id) ?? new Map();
        const weeks = Array.from(weekMap.entries());

        return (
          <div
            key={emp.id}
            className={`flex min-w-max ${idx > 0 ? 'border-t border-zinc-100' : ''}`}
          >
            <div className="sticky left-0 z-20 w-48 shrink-0" aria-hidden />
            <div
              className="relative h-8 shrink-0"
              style={{ width: gridWidth }}
              data-timeline-grid
            >
              {weeks.map(([weekStart, items]) => {
                const totalFte = items.reduce((s: number, x: AllocationItem) => s + x.fte, 0);
                if (totalFte <= 0) return null;

                const leftPct = dateToOffset(weekStart, startDate, totalDays);
                const weekWidthPct = getWeekWidthPct(totalDays);

                return (
                  <div
                    key={weekStart}
                    className="absolute top-1 bottom-1 flex overflow-hidden rounded"
                    style={{
                      left: `${leftPct}%`,
                      width: `${Math.min(weekWidthPct, 100 - leftPct)}%`,
                      minWidth: 8,
                    }}
                    title={items
                      .map((i: AllocationItem) => `${i.venture.name}: ${i.fte}%`)
                      .join('\n')}
                  >
                    {items.map((item: AllocationItem) => {
                      const pct = (item.fte / totalFte) * 100;
                      const color =
                        VENTURE_SEGMENT_COLORS[
                          ventureColorIndex.get(item.venture.id) ?? 0
                        ];
                      return (
                        <div
                          key={`${item.venture.id}-${weekStart}`}
                          className={`h-full shrink-0 ${color}`}
                          style={{ width: `${pct}%`, minWidth: pct > 0 ? 2 : 0 }}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
