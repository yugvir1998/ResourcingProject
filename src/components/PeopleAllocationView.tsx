'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { comparePeopleTags } from '@/lib/people-tags';
import { isAllocationIncludedInCapacity } from '@/lib/phaseCapacity';

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

/** Segment bar position must follow the same layout as the grid (equal month columns, equal week widths within month), not linear calendar time — otherwise bars drift from week cells when zooming. */
function getWeekSlotBarPercent(
  normStart: string,
  normEnd: string,
  months: Date[],
  columnWidth: number,
  gridWidth: number
): { leftPct: number; widthPct: number } {
  let leftPx = 0;
  let spanLeftPx: number | null = null;
  let spanRightPx = 0;
  for (const m of months) {
    const monthWeeks = getWeeksInMonth(m);
    const ww = columnWidth / Math.max(1, monthWeeks.length);
    for (const w of monthWeeks) {
      const ws = normalizeWeekKey(getWeekStartString(w));
      if (ws >= normStart && ws <= normEnd) {
        if (spanLeftPx === null) spanLeftPx = leftPx;
        spanRightPx = leftPx + ww;
      }
      leftPx += ww;
    }
  }
  if (spanLeftPx === null || gridWidth <= 0) return { leftPct: 0, widthPct: 0 };
  const widthPx = spanRightPx - spanLeftPx;
  const leftPct = (spanLeftPx / gridWidth) * 100;
  const widthPct = Math.min(100 - leftPct, (widthPx / gridWidth) * 100);
  return { leftPct, widthPct };
}

function getMonthColumnBarPercent(
  normStart: string,
  normEnd: string,
  months: Date[],
  columnWidth: number,
  gridWidth: number
): { leftPct: number; widthPct: number } {
  const start = new Date(normStart + 'T12:00:00');
  const end = new Date(normEnd + 'T12:00:00');
  const startIdx = start.getFullYear() * 12 + start.getMonth();
  const endIdx = end.getFullYear() * 12 + end.getMonth();
  let leftPx = 0;
  let spanLeftPx: number | null = null;
  let spanRightPx = 0;
  for (const m of months) {
    const idx = m.getFullYear() * 12 + m.getMonth();
    if (idx >= startIdx && idx <= endIdx) {
      if (spanLeftPx === null) spanLeftPx = leftPx;
      spanRightPx = leftPx + columnWidth;
    }
    leftPx += columnWidth;
  }
  if (spanLeftPx === null || gridWidth <= 0) return { leftPct: 0, widthPct: 0 };
  const widthPx = spanRightPx - spanLeftPx;
  const leftPct = (spanLeftPx / gridWidth) * 100;
  const widthPct = Math.min(100 - leftPct, (widthPx / gridWidth) * 100);
  return { leftPct, widthPct };
}

function quarterOrder(y: number, q: number): number {
  return y * 4 + (q - 1);
}

function getQuarterColumnBarPercent(
  normStart: string,
  normEnd: string,
  quarters: { q: number; y: number }[],
  columnWidth: number,
  gridWidth: number
): { leftPct: number; widthPct: number } {
  const start = new Date(normStart + 'T12:00:00');
  const end = new Date(normEnd + 'T12:00:00');
  const segLo = quarterOrder(start.getFullYear(), Math.floor(start.getMonth() / 3) + 1);
  const segHi = quarterOrder(end.getFullYear(), Math.floor(end.getMonth() / 3) + 1);
  let leftPx = 0;
  let spanLeftPx: number | null = null;
  let spanRightPx = 0;
  const qWidth = columnWidth * 3;
  for (const { q, y } of quarters) {
    const o = quarterOrder(y, q);
    if (o >= segLo && o <= segHi) {
      if (spanLeftPx === null) spanLeftPx = leftPx;
      spanRightPx = leftPx + qWidth;
    }
    leftPx += qWidth;
  }
  if (spanLeftPx === null || gridWidth <= 0) return { leftPct: 0, widthPct: 0 };
  const widthPx = spanRightPx - spanLeftPx;
  const leftPct = (spanLeftPx / gridWidth) * 100;
  const widthPct = Math.min(100 - leftPct, (widthPx / gridWidth) * 100);
  return { leftPct, widthPct };
}

function getEffectiveSpan(
  allocation: Allocation,
  phaseMap: Map<number, VenturePhase>,
  viewStartTime: number,
  viewEndTime: number
): { start: string; end: string } | null {
  const phase = allocation.phase_id ? phaseMap.get(allocation.phase_id) ?? null : null;
  if (phase?.start_date && phase?.end_date) {
    const phaseStart = new Date(phase.start_date).getTime();
    const phaseEnd = new Date(phase.end_date).getTime();
    if (Number.isNaN(phaseStart) || Number.isNaN(phaseEnd)) return null;
    if (phaseEnd < viewStartTime || phaseStart > viewEndTime) return null;
    const start = new Date(Math.max(phaseStart, viewStartTime));
    const end = new Date(Math.min(phaseEnd, viewEndTime));
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  }
  const weekTime = new Date(allocation.week_start).getTime();
  if (Number.isNaN(weekTime) || weekTime < viewStartTime || weekTime > viewEndTime) return null;
  const weekKey = normalizeWeekKey(allocation.week_start);
  return { start: weekKey, end: weekKey };
}

function buildAllocationSegments(
  allocations: Allocation[],
  employeeId: number,
  ventureMap: Map<number, Venture>,
  phaseMap: Map<number, VenturePhase>,
  startTime: number,
  endTime: number
): AllocationSegment[] {
  const segments: AllocationSegment[] = [];
  const empAllocs = allocations.filter((a) => a.employee_id === employeeId);

  for (const a of empAllocs) {
    if (!isAllocationIncludedInCapacity(a.phase_id, phaseMap)) continue;
    const venture = ventureMap.get(a.venture_id) ?? ({ id: a.venture_id, name: `Venture ${a.venture_id}` } as Venture);
    const phase = a.phase_id ? phaseMap.get(a.phase_id) ?? null : null;
    const span = getEffectiveSpan(a, phaseMap, startTime, endTime);
    if (!span) continue;

    segments.push({
      venture,
      phase,
      fte: a.fte_percentage,
      startWeek: span.start,
      endWeek: span.end,
    });
  }
  segments.sort((a, b) => a.startWeek.localeCompare(b.startWeek));
  return segments;
}

const PRE_EXPLORATION_VENTURE: Venture = { id: -1, name: 'Pre Exploration', status: 'exploration_staging' } as Venture;

function mergeAllocationSegments(segments: AllocationSegment[]): AllocationSegment[] {
  if (segments.length === 0) return [];
  const preExploration = segments.filter((s) => s.venture.status === 'exploration_staging');
  const other = segments.filter((s) => s.venture.status !== 'exploration_staging');

  const merged: AllocationSegment[] = [];

  if (preExploration.length > 0) {
    const startWeek = preExploration.reduce((min, s) => (s.startWeek < min ? s.startWeek : min), preExploration[0].startWeek);
    const endWeek = preExploration.reduce((max, s) => (s.endWeek > max ? s.endWeek : max), preExploration[0].endWeek);
    const preExplorationFteByVenture = new Map<number, number>();
    for (const seg of preExploration) {
      if (!preExplorationFteByVenture.has(seg.venture.id)) {
        preExplorationFteByVenture.set(seg.venture.id, seg.fte);
      }
    }
    const totalFte = [...preExplorationFteByVenture.values()].reduce((s, f) => s + f, 0);
    merged.push({
      venture: PRE_EXPLORATION_VENTURE,
      phase: null,
      fte: totalFte,
      fteDisplay: `${totalFte}%`,
      startWeek,
      endWeek,
    });
  }

  const supportSegments = other.filter((s) => s.venture.status === 'support' && s.phase === null);
  const rest = other.filter((s) => !(s.venture.status === 'support' && s.phase === null));

  const mergeByVentureId = (segs: AllocationSegment[], labelSupport: boolean) => {
    const byVenture = new Map<number, AllocationSegment[]>();
    for (const seg of segs) {
      if (!byVenture.has(seg.venture.id)) byVenture.set(seg.venture.id, []);
      byVenture.get(seg.venture.id)!.push(seg);
    }
    for (const [, group] of byVenture) {
      const startWeek = group.reduce((min, s) => (s.startWeek < min ? s.startWeek : min), group[0].startWeek);
      const endWeek = group.reduce((max, s) => (s.endWeek > max ? s.endWeek : max), group[0].endWeek);
      const fteMin = Math.min(...group.map((s) => s.fte));
      const fteMax = Math.max(...group.map((s) => s.fte));
      const fteDisplay = fteMin === fteMax ? `${fteMin}%` : `${fteMin}-${fteMax}%`;
      const v = group[0].venture;
      merged.push({
        venture: labelSupport ? { ...v, name: `Support - ${v.name}` } : v,
        phase: group[0].phase,
        fte: group[0].fte,
        fteDisplay,
        startWeek,
        endWeek,
      });
    }
  };

  mergeByVentureId(supportSegments, true);
  mergeByVentureId(rest, false);
  merged.sort((a, b) => a.startWeek.localeCompare(b.startWeek));
  return merged;
}

type VentureBreakdown = { venture: Venture; phase: VenturePhase | null; fte: number };

type AllocationSegment = {
  venture: Venture;
  phase: VenturePhase | null;
  fte: number;
  fteDisplay?: string;
  startWeek: string;
  endWeek: string;
};

function PersonAllocationExpandableRow({
  segments,
  gridWidth,
  displayLevel,
  months,
  quarters,
  columnWidth,
}: {
  segments: AllocationSegment[];
  gridWidth: number;
  displayLevel: 'quarters' | 'months' | 'monthsWithWeeks';
  months: Date[];
  quarters: { q: number; y: number }[];
  columnWidth: number;
}) {
  if (segments.length === 0) return null;

  return (
    <>
      {segments.map((seg, idx) => {
        const normStart = normalizeWeekKey(seg.startWeek);
        const normEnd = normalizeWeekKey(seg.endWeek);
        let leftPct: number;
        let widthPct: number;
        if (displayLevel === 'monthsWithWeeks') {
          ({ leftPct, widthPct } = getWeekSlotBarPercent(normStart, normEnd, months, columnWidth, gridWidth));
        } else if (displayLevel === 'months') {
          ({ leftPct, widthPct } = getMonthColumnBarPercent(normStart, normEnd, months, columnWidth, gridWidth));
        } else {
          ({ leftPct, widthPct } = getQuarterColumnBarPercent(normStart, normEnd, quarters, columnWidth, gridWidth));
        }
        const phaseLabel = seg.phase ? ` (${seg.phase.phase.replace(/_/g, ' ')})` : '';
        return (
          <div
            key={`${seg.venture.id}-${seg.startWeek}-${idx}`}
            className="flex border-b border-zinc-100 bg-zinc-50/50 last:border-b-0"
          >
            <div className="sticky left-0 z-10 w-48 shrink-0 border-r border-zinc-200 bg-zinc-50/95 px-4 py-1.5 pl-8">
              <span
                className="truncate text-xs text-zinc-700"
                title={`${seg.venture.name}${phaseLabel} - ${seg.fteDisplay ?? `${seg.fte}%`}`}
              >
                {seg.venture.name} - {seg.fteDisplay ?? `${seg.fte}%`}
              </span>
            </div>
            <div className="relative flex-1 min-w-0 py-1.5" style={{ width: gridWidth }}>
              <div className="relative h-4 rounded bg-zinc-200">
                <div
                  className="absolute top-0.5 bottom-0.5 rounded bg-zinc-500"
                  style={{
                    left: `${leftPct}%`,
                    width: `${Math.min(widthPct, 100 - leftPct)}%`,
                    minWidth: 4,
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

export function PeopleAllocationView({ refreshTrigger }: { refreshTrigger?: number }) {
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [phases, setPhases] = useState<VenturePhase[]>([]);
  const [ventures, setVentures] = useState<Venture[]>([]);
  const [milestones, setMilestones] = useState<{ target_date: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [auditResult, setAuditResult] = useState<{
    orphanedPhase: { allocationIds: number[] };
    orphanedVenture: { allocationIds: number[] };
    orphanedEmployee: { allocationIds: number[] };
    duplicates: { groups: { ids: number[]; totalFte: number }[] };
  } | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFixing, setAuditFixing] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasScrolledToTodayRef = useRef(false);
  const sync = useTimelineSyncOptional();

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

  const phaseMap = new Map(phases.map((p) => [p.id, p]));
  const ventureMap = new Map(ventures.map((v) => [v.id, v]));

  /** Match main timeline visibility: exclude hidden ventures from planning totals; always include support ventures. */
  const includeVentureInPeoplePlanning = (v: Venture | undefined): boolean => {
    if (!v) return false;
    if (v.status === 'support') return true;
    return v.timeline_visible === true && v.hidden_from_venture_tracker !== true;
  };
  const planningAllocations = allocations.filter(
    (a) =>
      includeVentureInPeoplePlanning(ventureMap.get(a.venture_id)) &&
      isAllocationIncludedInCapacity(a.phase_id, phaseMap)
  );

  let { start: startDate, end: endDate } = getDateRange(phases, milestones);
  // Expand range to include allocations and their phase spans (only when not using sync)
  if (!sync && planningAllocations.length > 0) {
    const dates: number[] = [];
    for (const a of planningAllocations) {
      const phase = a.phase_id ? phaseMap.get(a.phase_id) ?? null : null;
      if (phase?.start_date && phase?.end_date) {
        const ps = new Date(phase.start_date).getTime();
        const pe = new Date(phase.end_date).getTime();
        if (!Number.isNaN(ps)) dates.push(ps);
        if (!Number.isNaN(pe)) dates.push(pe);
      } else {
        const t = new Date(a.week_start).getTime();
        if (!Number.isNaN(t)) dates.push(t);
      }
    }
    if (dates.length > 0) {
      const minAlloc = new Date(Math.min(...dates));
      const maxAlloc = new Date(Math.max(...dates));
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
    sync?.gridTotalWidth ?? getGridTotalWidth(zoom, startDate, endDate);
  const gridWidth = gridTotalWidth;
  const totalDays =
    (sync?.totalDays) ??
    (Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) || 90);

  // Build per-employee per-week totals (phase-based: use phase dates when available)
  const byEmployeeAndWeek = new Map<number, Map<string, number>>();
  const byEmployeeAndWeekBreakdown = new Map<number, Map<string, VentureBreakdown[]>>();

  for (const emp of employees) {
    byEmployeeAndWeek.set(emp.id, new Map());
    byEmployeeAndWeekBreakdown.set(emp.id, new Map());
  }

  const startTime = startDate.getTime();
  const endTime = endDate.getTime();
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  for (const a of planningAllocations) {
    const phase = a.phase_id ? phaseMap.get(a.phase_id) ?? null : null;
    const venture =
      ventureMap.get(a.venture_id) ??
      ({ id: a.venture_id, name: `Venture ${a.venture_id}` } as Venture);

    let spanStart: number;
    let spanEnd: number;
    if (phase?.start_date && phase?.end_date) {
      spanStart = new Date(phase.start_date).getTime();
      spanEnd = new Date(phase.end_date).getTime();
      if (Number.isNaN(spanStart) || Number.isNaN(spanEnd) || spanEnd < startTime || spanStart > endTime) continue;
      spanStart = Math.max(spanStart, startTime);
      spanEnd = Math.min(spanEnd, endTime);
    } else {
      const weekTime = new Date(a.week_start).getTime();
      if (Number.isNaN(weekTime) || weekTime < startTime || weekTime > endTime) continue;
      spanStart = weekTime;
      spanEnd = weekTime;
    }

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

    for (const w of weeks) {
      const weekStart = getWeekStartString(w);
      const weekStartTime = new Date(weekStart).getTime();
      const weekEndTime = weekStartTime + weekMs - 1;
      if (weekEndTime < spanStart || weekStartTime > spanEnd) continue;
      empWeek.set(weekStart, (empWeek.get(weekStart) ?? 0) + a.fte_percentage);
      if (!empBreakdown.has(weekStart)) empBreakdown.set(weekStart, []);
      const list = empBreakdown.get(weekStart)!;
      const existing = list.find((x) => x.venture.id === venture.id && x.phase?.id === phase?.id);
      if (existing) existing.fte += a.fte_percentage;
      else list.push({ venture, phase, fte: a.fte_percentage });
    }
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

  const sortedEmployees = useMemo(() => {
    return [...employees].sort((a, b) => {
      const d = comparePeopleTags(a.people_tag, b.people_tag);
      if (d !== 0) return d;
      return a.name.localeCompare(b.name);
    });
  }, [employees]);

  const runAudit = async () => {
    setAuditLoading(true);
    setAuditResult(null);
    try {
      const res = await fetch('/api/allocations/audit', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setAuditResult({
          orphanedPhase: data.orphanedPhase ?? { allocationIds: [] },
          orphanedVenture: data.orphanedVenture ?? { allocationIds: [] },
          orphanedEmployee: data.orphanedEmployee ?? { allocationIds: [] },
          duplicates: data.duplicates ?? { groups: [] },
        });
      }
    } finally {
      setAuditLoading(false);
    }
  };

  const runFix = async () => {
    setAuditFixing(true);
    try {
      const res = await fetch('/api/allocations/audit?fix=true', { method: 'POST' });
      if (res.ok) {
        setAuditResult(null);
        await fetchData();
      }
    } finally {
      setAuditFixing(false);
    }
  };

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
      <div className="mb-2 flex w-full items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex flex-1 items-center gap-2 text-left"
        >
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-zinc-900">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            People Allocation
          </h2>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`shrink-0 text-zinc-500 transition-transform ${collapsed ? '-rotate-90' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {!collapsed && (
          <button
            type="button"
            onClick={runAudit}
            disabled={auditLoading}
            className="shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            {auditLoading ? 'Auditing…' : 'Audit allocations'}
          </button>
        )}
      </div>
      {!collapsed && (
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm ring-1 ring-zinc-900/5">
        <div
          ref={(el) => {
            (scrollContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
            sync?.registerPeopleRef(el);
          }}
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
            {/* Data rows — sorted by role tag, then name */}
            {sortedEmployees.map((emp, empIdx) => {
              const prevTag = sortedEmployees[empIdx - 1]?.people_tag ?? null;
              const thisTag = emp.people_tag ?? null;
              const showTagGroupHeader = empIdx === 0 || prevTag !== thisTag;
              const weekTotals = byEmployeeAndWeek.get(emp.id) ?? new Map();
              const isExpanded = expandedId === emp.id;
              const rawSegments = buildAllocationSegments(
                planningAllocations,
                emp.id,
                ventureMap,
                phaseMap,
                startDate.getTime(),
                endDate.getTime()
              );
              const segments = mergeAllocationSegments(rawSegments);

              return (
                <div key={emp.id} className="last:[&>*:last-child]:border-b-0">
                  {showTagGroupHeader && (
                    <div className="flex border-b border-zinc-200 bg-zinc-100/90">
                      <div className="sticky left-0 z-10 w-48 shrink-0 border-r border-zinc-200 bg-zinc-100/95 px-4 py-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
                          {emp.people_tag ?? 'Unassigned'}
                        </span>
                      </div>
                      <div
                        className="flex min-w-0 items-center border-zinc-200 bg-zinc-100/90 px-3 py-2"
                        style={{ width: gridWidth }}
                      />
                    </div>
                  )}
                  <div className="flex border-b border-zinc-100">
                    <div className="sticky left-0 z-10 w-48 shrink-0 border-r border-zinc-200 bg-white px-4 py-2">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : emp.id)}
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
                          className={`shrink-0 text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
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
                  {isExpanded && (
                    <PersonAllocationExpandableRow
                      segments={segments}
                      gridWidth={gridWidth}
                      displayLevel={displayLevel}
                      months={months}
                      quarters={quarters}
                      columnWidth={columnWidth}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      )}

      {/* Audit modal */}
      {auditResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
          onClick={() => setAuditResult(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-zinc-900">Allocation Audit</h3>
            <div className="mt-4 space-y-3 text-sm text-zinc-600">
              <p>
                <span className="font-medium text-zinc-700">Orphaned phase:</span>{' '}
                {auditResult.orphanedPhase.allocationIds.length} allocation(s) with invalid phase_id
              </p>
              <p>
                <span className="font-medium text-zinc-700">Orphaned venture:</span>{' '}
                {auditResult.orphanedVenture.allocationIds.length} allocation(s) with invalid venture_id
              </p>
              <p>
                <span className="font-medium text-zinc-700">Orphaned employee:</span>{' '}
                {auditResult.orphanedEmployee.allocationIds.length} allocation(s) with invalid employee_id
              </p>
              <p>
                <span className="font-medium text-zinc-700">Duplicates:</span>{' '}
                {auditResult.duplicates.groups.length} group(s) with same employee, venture, week, phase
              </p>
              {auditResult.orphanedPhase.allocationIds.length === 0 &&
                auditResult.orphanedVenture.allocationIds.length === 0 &&
                auditResult.orphanedEmployee.allocationIds.length === 0 &&
                auditResult.duplicates.groups.length === 0 && (
                  <p className="text-emerald-600">No issues found.</p>
                )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAuditResult(null)}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Close
              </button>
              {(auditResult.orphanedPhase.allocationIds.length > 0 ||
                auditResult.orphanedVenture.allocationIds.length > 0 ||
                auditResult.orphanedEmployee.allocationIds.length > 0 ||
                auditResult.duplicates.groups.length > 0) && (
                <button
                  type="button"
                  onClick={runFix}
                  disabled={auditFixing}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {auditFixing ? 'Fixing…' : 'Fix'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
