'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  getDateRange,
  getColumnWidth,
  getGridTotalWidth,
  getWeeksBetween,
  type ZoomLevel,
} from '@/components/timeline/TimeAxis';
import { useCurrentDate } from '@/hooks/useCurrentDate';
import { localDayEndMs, localDayStartMs } from '@/lib/localDateParse';
import type { VenturePhase } from '@/types';

const SIDEBAR_WIDTH = 192;
const ZOOM_SCALE_MIN = 0.5;
const ZOOM_SCALE_MAX = 2.5;

type TimelineSyncContextValue = {
  zoom: ZoomLevel;
  zoomScale: number;
  setZoomScale: (v: number | ((prev: number) => number)) => void;
  /** False until the first venture-phases / milestones / allocations fetch completes (avoids empty-range axis). */
  axisHydrated: boolean;
  startDate: Date;
  endDate: Date;
  weeks: Date[];
  gridTotalWidth: number;
  columnWidth: number;
  totalDays: number;
  scrollToTodayOffset: number;
  hasScrolledToToday: boolean;
  markScrolledToToday: () => void;
  reportScroll: (source: 'timeline' | 'people', scrollLeft: number) => void;
  onWheelZoom: (e: React.WheelEvent) => void;
  registerTimelineRef: (el: HTMLDivElement | null) => void;
  registerPeopleRef: (el: HTMLDivElement | null) => void;
};

const TimelineSyncContext = createContext<TimelineSyncContextValue | null>(null);

export function TimelineSyncProvider({
  children,
  refreshTrigger = 0,
}: {
  children: ReactNode;
  refreshTrigger?: number;
}) {
  const [zoomScale, setZoomScale] = useState(1);
  const [hasScrolledToToday, setHasScrolledToToday] = useState(false);
  const [axisHydrated, setAxisHydrated] = useState(false);
  const [syncData, setSyncData] = useState<{
    phases: VenturePhase[];
    milestones: { target_date: string }[];
    allocations: { week_start: string; phase_id?: number | null }[];
  }>({ phases: [], milestones: [], allocations: [] });
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const peopleScrollRef = useRef<HTMLDivElement | null>(null);
  const lastReportedScrollRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    setAxisHydrated(false);
    Promise.all([
      fetch('/api/venture-phases').then((r) => r.json()),
      fetch('/api/hiring-milestones').then((r) => r.json()),
      fetch('/api/allocations').then((r) => r.json()),
    ]).then(([phases, milestones, allocations]) => {
      setSyncData({
        phases: phases || [],
        milestones: milestones || [],
        allocations: allocations || [],
      });
      setAxisHydrated(true);
    })
      .catch(() => setAxisHydrated(true));
  }, [refreshTrigger]);

  const { phases, milestones, allocations } = syncData;
  const zoom: ZoomLevel = 'month';

  let { start: startDate, end: endDate } = getDateRange(phases, milestones);
  if (allocations.length > 0) {
    const phaseMap = new Map(phases.map((p) => [p.id, p]));
    const dates: number[] = [];
    for (const a of allocations) {
      const phase = a.phase_id ? phaseMap.get(a.phase_id) : null;
      if (phase?.start_date && phase?.end_date) {
        const ps = localDayStartMs(phase.start_date);
        const pe = localDayEndMs(phase.end_date);
        if (!Number.isNaN(ps)) dates.push(ps);
        if (!Number.isNaN(pe)) dates.push(pe);
      } else {
        const t = localDayStartMs(String(a.week_start));
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

  const weeks = useMemo(() => getWeeksBetween(startDate, endDate), [startDate, endDate]);
  const baseColumnWidth = getColumnWidth(zoom);
  const baseGridWidth = getGridTotalWidth(zoom, startDate, endDate);
  const gridTotalWidth = baseGridWidth * zoomScale;
  const columnWidth = baseColumnWidth * zoomScale;
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) || 90;

  const { date: today } = useCurrentDate();

  const scrollToTodayOffset = useMemo(() => {
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();
    const totalMs = endTime - startTime;
    if (totalMs <= 0) return SIDEBAR_WIDTH;
    const todayOffsetPct = Math.max(0, Math.min(1, (today.getTime() - startTime) / totalMs));
    return SIDEBAR_WIDTH + todayOffsetPct * gridTotalWidth;
  }, [startDate, endDate, gridTotalWidth, today]);

  const registerTimelineRef = useCallback((el: HTMLDivElement | null) => {
    timelineScrollRef.current = el;
  }, []);

  const registerPeopleRef = useCallback((el: HTMLDivElement | null) => {
    peopleScrollRef.current = el;
  }, []);

  const reportScroll = useCallback(
    (source: 'timeline' | 'people', newScrollLeft: number) => {
      if (Math.abs(newScrollLeft - lastReportedScrollRef.current) < 1) return;
      lastReportedScrollRef.current = newScrollLeft;

      if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        const target = source === 'timeline' ? peopleScrollRef.current : timelineScrollRef.current;
        if (target && Math.abs(target.scrollLeft - newScrollLeft) > 2) {
          target.scrollLeft = newScrollLeft;
        }
      });
    },
    []
  );

  const markScrolledToToday = useCallback(() => {
    setHasScrolledToToday(true);
  }, []);

  const ZOOM_SENSITIVITY = 0.0015;
  const onWheelZoom = useCallback(
    (e: React.WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      const delta = -e.deltaY * ZOOM_SENSITIVITY;
      if (delta !== 0) {
        e.preventDefault();
        setZoomScale((s) => Math.max(ZOOM_SCALE_MIN, Math.min(ZOOM_SCALE_MAX, s + delta)));
      }
    },
    []
  );

  const value: TimelineSyncContextValue = useMemo(
    () => ({
      zoom,
      zoomScale,
      setZoomScale,
      axisHydrated,
      startDate,
      endDate,
      weeks,
      gridTotalWidth,
      columnWidth,
      totalDays,
      scrollToTodayOffset,
      hasScrolledToToday,
      markScrolledToToday,
      reportScroll,
      onWheelZoom,
      registerTimelineRef,
      registerPeopleRef,
    }),
    [
      axisHydrated,
      zoomScale,
      startDate,
      endDate,
      weeks,
      gridTotalWidth,
      columnWidth,
      totalDays,
      scrollToTodayOffset,
      hasScrolledToToday,
      reportScroll,
      onWheelZoom,
      registerTimelineRef,
      registerPeopleRef,
    ]
  );

  return (
    <TimelineSyncContext.Provider value={value}>{children}</TimelineSyncContext.Provider>
  );
}

export function useTimelineSync() {
  const ctx = useContext(TimelineSyncContext);
  if (!ctx) throw new Error('useTimelineSync must be used within TimelineSyncProvider');
  return ctx;
}

export function useTimelineSyncOptional() {
  return useContext(TimelineSyncContext);
}
