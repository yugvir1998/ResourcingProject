'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Venture, VenturePhase, Allocation, Employee } from '@/types';
import {
  getDateRange,
  getWeeksBetween,
  getDisplayLevel,
  getMonthsBetween,
  getWeeksInMonth,
  getGridTotalWidth,
  getColumnWidth,
  type ZoomLevel,
} from './timeline/TimeAxis';
import { useTimelineSyncOptional } from '@/contexts/TimelineSyncContext';

const FALLBACK_WEEK_COLUMN_WIDTH = 72;
const DROPDOWN_TIMELINE_WIDTH = 480;

function getWeekStartString(d: Date): string {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  return monday.toISOString().slice(0, 10);
}

function normalizeWeekKey(weekStart: string): string {
  return String(weekStart).slice(0, 10);
}

function getCellColor(pct: number): string {
  if (pct < 50) return 'bg-amber-100 text-amber-900 border-amber-200';
  if (pct <= 100) return 'bg-emerald-100 text-emerald-900 border-emerald-200';
  if (pct <= 120) return 'bg-orange-100 text-orange-900 border-orange-200';
  return 'bg-red-100 text-red-900 border-red-200';
}

function dateToOffset(dateStr: string, startDate: Date, totalDays: number): number {
  const startTime = startDate.getTime();
  const dateTime = new Date(dateStr).getTime();
  const totalMs = totalDays * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.min(100, ((dateTime - startTime) / totalMs) * 100));
}

function getSegmentWidthPct(startWeek: string, endWeek: string, totalDays: number): number {
  const startTime = new Date(startWeek).getTime();
  const endTime = new Date(endWeek).getTime();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const spanMs = endTime - startTime + weekMs;
  return (spanMs / (totalDays * 24 * 60 * 60 * 1000)) * 100;
}

function buildAllocationSegments(
  allocations: Allocation[],
  employeeId: number,
  ventureMap: Map<number, Venture>,
  phaseMap: Map<number, VenturePhase>,
  startTime: number,
  endTime: number
): AllocationSegment[] {
  const empAllocs = allocations
    .filter((a) => a.employee_id === employeeId)
    .map((a) => ({
      venture: ventureMap.get(a.venture_id) ?? ({ id: a.venture_id, name: `Venture ${a.venture_id}` } as Venture),
      phase: a.phase_id ? phaseMap.get(a.phase_id) ?? null : null,
      fte: a.fte_percentage,
      weekStart: normalizeWeekKey(a.week_start),
    }))
    .filter((x) => {
      const t = new Date(x.weekStart).getTime();
      return !Number.isNaN(t) && t >= startTime && t <= endTime;
    })
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  const segments: AllocationSegment[] = [];
  const key = (v: { venture: Venture; phase: VenturePhase | null; fte: number }) =>
    `${v.venture.id}-${v.phase?.id ?? 'n'}-${v.fte}`;

  for (const a of empAllocs) {
    const k = key(a);
    const last = segments[segments.length - 1];
    if (last && key(last) === k) {
      const lastWeek = new Date(last.endWeek);
      lastWeek.setDate(lastWeek.getDate() + 7);
      const nextWeek = a.weekStart;
      if (lastWeek.toISOString().slice(0, 10) === nextWeek) {
        last.endWeek = nextWeek;
        continue;
      }
    }
    segments.push({
      venture: a.venture,
      phase: a.phase,
      fte: a.fte,
      startWeek: a.weekStart,
      endWeek: a.weekStart,
    });
  }
  return segments;
}

type VentureBreakdown = { venture: Venture; phase: VenturePhase | null; fte: number };

type AllocationSegment = {
  venture: Venture;
  phase: VenturePhase | null;
  fte: number;
  startWeek: string;
  endWeek: string;
};

function PersonAllocationDropdown({
  emp,
  breakdown,
  weekTotals,
  weeks,
  startDate,
  endDate,
  totalDays,
  allocations,
  ventureMap,
  phaseMap,
  dropdownRect,
  onClose,
}: {
  emp: Employee;
  breakdown: Map<string, VentureBreakdown[]>;
  weekTotals: Map<string, number>;
  weeks: Date[];
  startDate: Date;
  endDate: Date;
  totalDays: number;
  allocations: Allocation[];
  ventureMap: Map<number, Venture>;
  phaseMap: Map<number, VenturePhase>;
  dropdownRect: DOMRect;
  onClose: () => void;
}) {
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();
  const segments = buildAllocationSegments(
    allocations,
    emp.id,
    ventureMap,
    phaseMap,
    startTime,
    endTime
  );

  return (
    <div
      data-person-allocation-dropdown
      className="fixed z-[101] overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg"
      style={{
        left: dropdownRect.left,
        top: dropdownRect.bottom + 4,
        width: DROPDOWN_TIMELINE_WIDTH,
        maxHeight: 360,
      }}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="overflow-y-auto p-3" style={{ maxHeight: 360 }}>
        <p className="mb-3 text-sm font-semibold text-zinc-900">{emp.name}</p>
        {breakdown.size === 0 ? (
          <p className="text-sm text-zinc-500">No allocations</p>
        ) : (
          <div className="space-y-3">
            {/* Total % row per week */}
            <div>
              <p className="mb-1.5 text-xs font-medium text-zinc-500">Total capacity</p>
              <div className="relative h-6 rounded bg-zinc-100" style={{ width: DROPDOWN_TIMELINE_WIDTH - 24 }}>
                {weeks.map((w) => {
                  const weekStart = getWeekStartString(w);
                  const total = weekTotals.get(weekStart) ?? 0;
                  const colorClass = getCellColor(total);
                  const leftPct = dateToOffset(weekStart, startDate, totalDays);
                  const weekWidthPct = (7 / totalDays) * 100;
                  return (
                    <div
                      key={weekStart}
                      className={`absolute top-0.5 bottom-0.5 flex items-center justify-center rounded px-0.5 text-[10px] font-medium ${colorClass}`}
                      style={{
                        left: `${leftPct}%`,
                        width: `${Math.min(weekWidthPct, 100 - leftPct)}%`,
                        minWidth: 12,
                      }}
                      title={`${weekStart}: ${total}%`}
                    >
                      {total}%
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Project bars */}
            <div>
              <p className="mb-1.5 text-xs font-medium text-zinc-500">By project</p>
              <div className="space-y-2">
                {segments.map((seg, idx) => {
                  const leftPct = dateToOffset(seg.startWeek, startDate, totalDays);
                  const widthPct = getSegmentWidthPct(seg.startWeek, seg.endWeek, totalDays);
                  const phaseLabel = seg.phase ? ` (${seg.phase.phase.replace(/_/g, ' ')})` : '';
                  return (
                    <div key={`${seg.venture.id}-${seg.startWeek}-${idx}`} className="flex items-center gap-2">
                      <span className="w-28 shrink-0 truncate text-xs text-zinc-700" title={`${seg.venture.name}${phaseLabel} - ${seg.fte}%`}>
                        {seg.venture.name}{phaseLabel} - {seg.fte}%
                      </span>
                      <div
                        className="relative h-4 flex-1 rounded bg-zinc-100"
                        style={{ width: DROPDOWN_TIMELINE_WIDTH - 24 - 112 }}
                      >
                        <div
                          className="absolute top-0.5 bottom-0.5 rounded bg-zinc-400"
                          style={{
                            left: `${leftPct}%`,
                            width: `${Math.min(widthPct, 100 - leftPct)}%`,
                            minWidth: 4,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function PeopleAllocationView({ refreshTrigger }: { refreshTrigger?: number }) {
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [phases, setPhases] = useState<VenturePhase[]>([]);
  const [ventures, setVentures] = useState<Venture[]>([]);
  const [milestones, setMilestones] = useState<{ target_date: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownButtonRef = useRef<HTMLButtonElement>(null);
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasScrolledToTodayRef = useRef(false);
  const sync = useTimelineSyncOptional();

  useEffect(() => {
    if (openDropdownId && dropdownButtonRef.current) {
      setDropdownRect(dropdownButtonRef.current.getBoundingClientRect());
    } else {
      setDropdownRect(null);
    }
  }, [openDropdownId]);

  const fetchData = async () => {
    const [aRes, eRes, pRes, vRes, mRes] = await Promise.all([
      fetch('/api/allocations'),
      fetch('/api/employees'),
      fetch('/api/venture-phases'),
      fetch('/api/ventures'),
      fetch('/api/hiring-milestones'),
    ]);
    const [aData, eData, pData, vData, mData] = await Promise.all([
      aRes.json(),
      eRes.json(),
      pRes.json(),
      vRes.json(),
      mRes.json(),
    ]);
    setAllocations(aData || []);
    setEmployees(eData || []);
    setPhases(pData || []);
    setVentures(vData || []);
    setMilestones(mData || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [refreshTrigger]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (dropdownRef.current?.contains(target)) return;
      if (target.closest('[data-person-allocation-dropdown]')) return;
      setOpenDropdownId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const phaseMap = new Map(phases.map((p) => [p.id, p]));
  const ventureMap = new Map(ventures.map((v) => [v.id, v]));

  let { start: startDate, end: endDate } = getDateRange(phases, milestones);
  // Expand range to include any week that has allocations (only when not using sync)
  if (!sync && allocations.length > 0) {
    const allocDates = allocations
      .map((a) => new Date(a.week_start).getTime())
      .filter((t) => !Number.isNaN(t));
    if (allocDates.length > 0) {
      const minAlloc = new Date(Math.min(...allocDates));
      const maxAlloc = new Date(Math.max(...allocDates));
      if (minAlloc.getTime() < startDate.getTime()) startDate = minAlloc;
      if (maxAlloc.getTime() > endDate.getTime()) endDate = maxAlloc;
    }
  }
  const weeks = sync?.weeks ?? getWeeksBetween(startDate, endDate);
  const zoom: ZoomLevel = 'month';
  const baseColumnWidth = getColumnWidth(zoom);
  const columnWidth = (sync?.columnWidth) ?? baseColumnWidth;
  const useMonthZoom = !!sync;
  const displayLevel = useMonthZoom ? getDisplayLevel(columnWidth) : 'monthsWithWeeks';
  const months = getMonthsBetween(startDate, endDate);
  const gridTotalWidth =
    sync?.gridTotalWidth ?? weeks.length * FALLBACK_WEEK_COLUMN_WIDTH;
  const gridWidth = gridTotalWidth;
  const totalDays =
    (sync?.totalDays) ??
    (Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) || 90);

  // Build per-employee per-week totals
  const byEmployeeAndWeek = new Map<number, Map<string, number>>();
  const byEmployeeAndWeekBreakdown = new Map<number, Map<string, VentureBreakdown[]>>();

  for (const emp of employees) {
    byEmployeeAndWeek.set(emp.id, new Map());
    byEmployeeAndWeekBreakdown.set(emp.id, new Map());
  }

  const startTime = startDate.getTime();
  const endTime = endDate.getTime();

  for (const a of allocations) {
    const phase = a.phase_id ? phaseMap.get(a.phase_id) ?? null : null;
    const venture =
      ventureMap.get(a.venture_id) ??
      ({ id: a.venture_id, name: `Venture ${a.venture_id}` } as Venture);

    const weekTime = new Date(a.week_start).getTime();
    if (Number.isNaN(weekTime) || weekTime < startTime || weekTime > endTime) continue;

    const weekKey = normalizeWeekKey(a.week_start);
    let empWeek = byEmployeeAndWeek.get(a.employee_id);
    let empBreakdown = byEmployeeAndWeekBreakdown.get(a.employee_id);
    if (!empWeek) {
      empWeek = new Map();
      byEmployeeAndWeek.set(a.employee_id, empWeek);
    }
    if (!empBreakdown) {
      empBreakdown = new Map();
      byEmployeeAndWeekBreakdown.set(a.employee_id, empBreakdown);
    }
    empWeek.set(weekKey, (empWeek.get(weekKey) ?? 0) + a.fte_percentage);
    if (!empBreakdown.has(weekKey)) empBreakdown.set(weekKey, []);
    const list = empBreakdown.get(weekKey)!;
    const existing = list.find((x) => x.venture.id === venture.id);
    if (existing) existing.fte += a.fte_percentage;
    else list.push({ venture, phase, fte: a.fte_percentage });
  }

  // Build per-employee per-month average (for month/quarter view)
  const byEmployeeAndMonth = new Map<number, Map<string, number>>();
  const monthAccum = new Map<number, Map<string, { sum: number; count: number }>>();
  for (const emp of employees) {
    byEmployeeAndMonth.set(emp.id, new Map());
    monthAccum.set(emp.id, new Map());
  }
  for (const [empId, weekMap] of byEmployeeAndWeek) {
    const acc = monthAccum.get(empId)!;
    for (const [weekStart, total] of weekMap) {
      const weekDate = new Date(weekStart);
      const monthKey = `${weekDate.getFullYear()}-${String(weekDate.getMonth() + 1).padStart(2, '0')}`;
      if (!acc.has(monthKey)) acc.set(monthKey, { sum: 0, count: 0 });
      const cur = acc.get(monthKey)!;
      cur.sum += total;
      cur.count += 1;
    }
  }
  for (const [empId, acc] of monthAccum) {
    const monthMap = byEmployeeAndMonth.get(empId)!;
    for (const [monthKey, { sum, count }] of acc) {
      monthMap.set(monthKey, count > 0 ? Math.round((sum / count) * 10) / 10 : 0);
    }
  }

  const handleScroll = useCallback(() => {
    if (sync && scrollContainerRef.current) {
      sync.reportScroll('people', scrollContainerRef.current.scrollLeft);
    }
  }, [sync]);

  // Snap scroll to today on initial load
  useEffect(() => {
    if (loading || !scrollContainerRef.current || employees.length === 0 || hasScrolledToTodayRef.current) return;
    const el = scrollContainerRef.current;
    let offset: number;
    if (sync?.scrollToTodayOffset != null) {
      offset = sync.scrollToTodayOffset;
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startTime = startDate.getTime();
      const endTime = endDate.getTime();
      const totalMs = endTime - startTime;
      offset = totalMs <= 0 ? 192 : 192 + Math.max(0, Math.min(1, (today.getTime() - startTime) / totalMs)) * gridWidth;
    }
    el.scrollLeft = offset;
    hasScrolledToTodayRef.current = true;
  }, [loading, employees.length, sync, startDate, endDate, gridWidth]);

  // Sync scroll from context (when Timeline scrolls)
  useEffect(() => {
    if (!sync || !scrollContainerRef.current) return;
    const el = scrollContainerRef.current;
    if (Math.abs(el.scrollLeft - sync.scrollLeft) > 2) {
      el.scrollLeft = sync.scrollLeft;
    }
  }, [sync?.scrollLeft]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTime = today.getTime();
  const todayWeekStart = weeks.find((w) => {
    const ws = new Date(w);
    ws.setHours(0, 0, 0, 0);
    const we = new Date(ws);
    we.setDate(we.getDate() + 6);
    we.setHours(23, 59, 59, 999);
    return todayTime >= ws.getTime() && todayTime <= we.getTime();
  });

  // Build quarter columns for displayLevel === 'quarters'
  const quarters: { q: number; y: number }[] = [];
  const seenQ = new Set<string>();
  months.forEach((m) => {
    const q = Math.floor(m.getMonth() / 3) + 1;
    const key = `${m.getFullYear()}-Q${q}`;
    if (!seenQ.has(key)) {
      seenQ.add(key);
      quarters.push({ q, y: m.getFullYear() });
    }
  });

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-8">
        <div className="h-8 w-48 animate-pulse rounded bg-zinc-200" />
        <div className="mt-4 h-64 animate-pulse rounded-lg bg-zinc-100" />
      </div>
    );
  }

  return (
    <section>
      <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold tracking-tight text-zinc-900">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        People Allocation
      </h2>
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm ring-1 ring-zinc-900/5">
        <div
          ref={scrollContainerRef}
          className="overflow-x-auto"
          onScroll={handleScroll}
          onWheel={sync?.onWheelZoom}
        >
          <div className="min-w-max">
            {/* Header row */}
            <div
              className={`flex border-b border-zinc-200 bg-zinc-50/80 ${displayLevel === 'monthsWithWeeks' ? 'flex-col' : ''}`}
            >
              <div className="flex min-w-max">
                <div className="sticky left-0 z-10 w-48 shrink-0 border-r border-zinc-200 bg-zinc-50/95 px-4 py-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Person</span>
                </div>
                {displayLevel === 'quarters' && (
                  <div className="flex">
                    {quarters.map(({ q, y }) => (
                      <div
                        key={`${y}-Q${q}`}
                        className="flex shrink-0 items-center justify-center border-r border-zinc-200 px-2 py-2 text-center"
                        style={{ width: columnWidth * 3 }}
                      >
                        <span className="text-xs font-medium text-zinc-600">Q{q} {y}</span>
                      </div>
                    ))}
                  </div>
                )}
                {displayLevel === 'months' && (
                  <div className="flex">
                    {months.map((m) => {
                      const isTodayMonth =
                        today.getMonth() === m.getMonth() && today.getFullYear() === m.getFullYear();
                      return (
                        <div
                          key={m.toISOString().slice(0, 7)}
                          className={`flex shrink-0 items-center justify-center border-r border-zinc-200 px-2 py-2 text-center ${isTodayMonth ? 'bg-amber-50' : ''}`}
                          style={{ width: columnWidth }}
                        >
                          <span className={`text-xs font-medium ${isTodayMonth ? 'text-amber-700' : 'text-zinc-600'}`}>
                            {m.toLocaleString('default', { month: 'short' })} {m.getFullYear()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {displayLevel === 'monthsWithWeeks' && (
                  <>
                    <div className="flex">
                      {months.map((m) => (
                        <div
                          key={m.toISOString().slice(0, 7)}
                          className="flex shrink-0 items-center justify-center border-r border-zinc-200 px-2 py-1.5 text-center text-xs font-medium text-zinc-700"
                          style={{ width: columnWidth }}
                        >
                          {m.toLocaleString('default', { month: 'short' })} {m.getFullYear()}
                        </div>
                      ))}
                    </div>
                    <div className="flex">
                      {months.map((m) => {
                        const monthWeeks = getWeeksInMonth(m);
                        const weekWidth = columnWidth / Math.max(1, monthWeeks.length);
                        return (
                          <div
                            key={m.toISOString().slice(0, 7)}
                            className="flex shrink-0 border-r border-zinc-200"
                            style={{ width: columnWidth }}
                          >
                            {monthWeeks.map((w) => {
                              const isToday =
                                todayWeekStart && getWeekStartString(w) === getWeekStartString(todayWeekStart);
                              return (
                                <div
                                  key={w.toISOString().slice(0, 10)}
                                  className={`flex shrink-0 items-center justify-center border-r border-zinc-100 px-0.5 py-1 text-center ${isToday ? 'bg-amber-50' : ''}`}
                                  style={{ width: weekWidth }}
                                >
                                  <span className={`text-[10px] ${isToday ? 'text-amber-700 font-medium' : 'text-zinc-500'}`}>
                                    {w.getDate()}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
            {/* Data rows */}
            {employees.map((emp) => {
              const weekTotals = byEmployeeAndWeek.get(emp.id) ?? new Map();
              const breakdown = byEmployeeAndWeekBreakdown.get(emp.id) ?? new Map();
              const isOpen = openDropdownId === emp.id;

              return (
                <div
                  key={emp.id}
                  className="flex border-b border-zinc-100 last:border-b-0"
                >
                  <div className="relative sticky left-0 z-10 w-48 shrink-0 border-r border-zinc-200 bg-white px-4 py-2">
                    <div className="relative" ref={isOpen ? dropdownRef : undefined}>
                      <button
                        ref={isOpen ? dropdownButtonRef : undefined}
                        type="button"
                        onClick={() => setOpenDropdownId(isOpen ? null : emp.id)}
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                      >
                        <span className="truncate">{emp.name}</span>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className={`shrink-0 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                      {isOpen &&
                        dropdownRect &&
                        typeof document !== 'undefined' &&
                        createPortal(
                          <>
                            <div
                              className="fixed inset-0 z-[100] bg-black/20"
                              onClick={() => setOpenDropdownId(null)}
                              aria-hidden="true"
                            />
                            <PersonAllocationDropdown
                              emp={emp}
                              breakdown={breakdown}
                              weekTotals={weekTotals}
                              weeks={weeks}
                              startDate={startDate}
                              endDate={endDate}
                              totalDays={totalDays}
                              allocations={allocations}
                              ventureMap={ventureMap}
                              phaseMap={phaseMap}
                              dropdownRect={dropdownRect}
                              onClose={() => setOpenDropdownId(null)}
                            />
                          </>,
                          document.body
                        )}
                    </div>
                  </div>
                  <div className="flex" style={{ width: gridWidth }}>
                    {displayLevel === 'quarters' &&
                      quarters.map(({ q, y }) => {
                        const quarterKey = `${y}-Q${q}`;
                        const monthKeysInQ = months
                          .filter((m) => `${m.getFullYear()}-Q${Math.floor(m.getMonth() / 3) + 1}` === quarterKey)
                          .map((m) => `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`);
                        const monthMap = byEmployeeAndMonth.get(emp.id) ?? new Map();
                        const vals = monthKeysInQ.map((k) => monthMap.get(k) ?? 0).filter((v) => v > 0);
                        const total =
                          vals.length > 0 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0;
                        const colorClass = getCellColor(total);
                        return (
                          <div
                            key={quarterKey}
                            className="flex shrink-0 items-center justify-center border-r border-zinc-100 px-1 py-2"
                            style={{ width: columnWidth * 3 }}
                          >
                            <span
                              className={`inline-flex min-w-[2.5rem] justify-center rounded border px-2 py-0.5 text-xs font-medium ${colorClass}`}
                            >
                              {total}%
                            </span>
                          </div>
                        );
                      })}
                    {displayLevel === 'months' &&
                      months.map((m) => {
                        const monthKey = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
                        const total = byEmployeeAndMonth.get(emp.id)?.get(monthKey) ?? 0;
                        const isTodayMonth =
                          today.getMonth() === m.getMonth() && today.getFullYear() === m.getFullYear();
                        const colorClass = getCellColor(total);
                        return (
                          <div
                            key={monthKey}
                            className={`flex shrink-0 items-center justify-center border-r border-zinc-100 px-1 py-2 ${isTodayMonth ? 'ring-1 ring-amber-400 ring-inset' : ''}`}
                            style={{ width: columnWidth }}
                          >
                            <span
                              className={`inline-flex min-w-[2.5rem] justify-center rounded border px-2 py-0.5 text-xs font-medium ${colorClass}`}
                            >
                              {total}%
                            </span>
                          </div>
                        );
                      })}
                    {displayLevel === 'monthsWithWeeks' &&
                      months.map((m) => {
                        const monthWeeks = getWeeksInMonth(m);
                        const weekWidth = columnWidth / Math.max(1, monthWeeks.length);
                        return (
                          <div
                            key={m.toISOString().slice(0, 7)}
                            className="flex shrink-0 border-r border-zinc-200"
                            style={{ width: columnWidth }}
                          >
                            {monthWeeks.map((w) => {
                              const weekStart = getWeekStartString(w);
                              const total = weekTotals.get(weekStart) ?? 0;
                              const isToday =
                                todayWeekStart && weekStart === getWeekStartString(todayWeekStart);
                              const colorClass = getCellColor(total);
                              return (
                                <div
                                  key={weekStart}
                                  className={`flex shrink-0 items-center justify-center border-r border-zinc-100 px-0.5 py-2 ${isToday ? 'ring-1 ring-amber-400 ring-inset' : ''}`}
                                  style={{ width: weekWidth }}
                                >
                                  <span
                                    className={`inline-flex min-w-[2rem] justify-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${colorClass}`}
                                  >
                                    {total}%
                                  </span>
                                </div>
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
        </div>
      </div>
    </section>
  );
}
