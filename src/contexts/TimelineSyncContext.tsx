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

const SIDEBAR_WIDTH = 192;
const ZOOM_SCALE_MIN = 0.5;
const ZOOM_SCALE_MAX = 2.5;

type TimelineSyncContextValue = {
  zoom: ZoomLevel;
  zoomScale: number;
  setZoomScale: (v: number | ((prev: number) => number)) => void;
  scrollLeft: number;
  setScrollLeft: (v: number) => void;
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
  const [scrollLeft, setScrollLeftState] = useState(0);
  const [hasScrolledToToday, setHasScrolledToToday] = useState(false);
  const [syncData, setSyncData] = useState<{
    phases: { start_date: string; end_date: string }[];
    milestones: { target_date: string }[];
    allocations: { week_start: string }[];
  }>({ phases: [], milestones: [], allocations: [] });
  const lastReportedScrollRef = useRef<number>(0);
  const isSyncingRef = useRef(false);

  useEffect(() => {
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
    });
  }, [refreshTrigger]);

  const { phases, milestones, allocations } = syncData;
  const zoom: ZoomLevel = 'month';

  let { start: startDate, end: endDate } = getDateRange(phases, milestones);
  if (allocations.length > 0) {
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

  const weeks = useMemo(() => getWeeksBetween(startDate, endDate), [startDate, endDate]);
  const baseColumnWidth = getColumnWidth(zoom);
  const baseGridWidth = getGridTotalWidth(zoom, startDate, endDate);
  const gridTotalWidth = baseGridWidth * zoomScale;
  const columnWidth = baseColumnWidth * zoomScale;
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) || 90;

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const scrollToTodayOffset = useMemo(() => {
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();
    const totalMs = endTime - startTime;
    if (totalMs <= 0) return SIDEBAR_WIDTH;
    const todayOffsetPct = Math.max(0, Math.min(1, (today.getTime() - startTime) / totalMs));
    return SIDEBAR_WIDTH + todayOffsetPct * gridTotalWidth;
  }, [startDate, endDate, gridTotalWidth, today]);

  const setScrollLeft = useCallback((v: number) => {
    lastReportedScrollRef.current = v;
    setScrollLeftState(v);
  }, []);

  const reportScroll = useCallback(
    (source: 'timeline' | 'people', newScrollLeft: number) => {
      if (isSyncingRef.current) return;
      if (Math.abs(newScrollLeft - lastReportedScrollRef.current) < 1) return;
      lastReportedScrollRef.current = newScrollLeft;
      setScrollLeftState(newScrollLeft);
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
      scrollLeft,
      setScrollLeft,
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
    }),
    [
      zoomScale,
      scrollLeft,
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
