'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Venture, VenturePhase, HiringMilestone, Employee, Allocation, PhaseActivity } from '@/types';
import { AddProjectModal } from './timeline/AddProjectModal';
import { TimeAxis, getColumnWidth, getDateRange, getGridTotalWidth, type ZoomLevel } from './timeline/TimeAxis';
import { ProjectRow } from './timeline/ProjectRow';
import { ProjectPanel } from './timeline/ProjectPanel';
import { MilestoneModal } from './timeline/MilestoneModal';
import { PeopleView } from './timeline/PeopleView';
import { ImpactPanel } from './ImpactPanel';
import { useToast } from './Toast';

export function TimelineView() {
  const toast = useToast();
  const [ventures, setVentures] = useState<Venture[]>([]);
  const [phases, setPhases] = useState<VenturePhase[]>([]);
  const [phaseActivities, setPhaseActivities] = useState<PhaseActivity[]>([]);
  const [milestones, setMilestones] = useState<HiringMilestone[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [expandedPhaseIds, setExpandedPhaseIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const [showPeopleView, setShowPeopleView] = useState(false);
  const [visibleDateRange, setVisibleDateRange] = useState<{ start: Date; end: Date } | null>(null);
  const [impactPanelOpen, setImpactPanelOpen] = useState(false);
  const [impactInitialMessage, setImpactInitialMessage] = useState<string | null>(null);
  const [zoom] = useState<ZoomLevel>('month');
  const [zoomScale, setZoomScale] = useState(1);
  const [selectedVentureId, setSelectedVentureId] = useState<number | null>(null);
  const [collapsedProjectIds, setCollapsedProjectIds] = useState<Set<number>>(new Set());
  const [milestoneModal, setMilestoneModal] = useState<{
    open: boolean;
    mode: 'add' | 'edit';
    ventureId: number;
    initialDate?: string;
    milestone?: HiringMilestone;
  } | null>(null);
  const [resumePausePhaseId, setResumePausePhaseId] = useState<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasScrolledToTodayRef = useRef(false);

  const toggleProjectCollapse = useCallback((ventureId: number) => {
    setCollapsedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(ventureId)) next.delete(ventureId);
      else next.add(ventureId);
      return next;
    });
  }, []);

  const fetchData = async () => {
    const [vRes, pRes, paRes, mRes, aRes, eRes] = await Promise.all([
      fetch('/api/ventures'),
      fetch('/api/venture-phases'),
      fetch('/api/phase-activities'),
      fetch('/api/hiring-milestones'),
      fetch('/api/allocations'),
      fetch('/api/employees'),
    ]);
    const [vData, pData, paData, mData, aData, eData] = await Promise.all([
      vRes.json(),
      pRes.json(),
      paRes.json(),
      mRes.json(),
      aRes.json(),
      eRes.json(),
    ]);
    const list = Array.isArray(vData) ? vData.filter((x: Venture) => x.timeline_visible !== false) : [];
    setVentures(list);
    setPhases(pData || []);
    setPhaseActivities(paData || []);
    setMilestones(mData || []);
    setAllocations(aData || []);
    setEmployees(eData || []);
  };

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, []);

  const isTimelineVisible = (v: Venture) => v.timeline_visible === true;
  const timelineVentures = ventures.filter(isTimelineVisible);

  const PHASE_PILL_COLORS: Record<string, string> = {
    explore: 'bg-teal-500/90 text-white',
    validate: 'bg-violet-500/90 text-white',
    define: 'bg-amber-500/90 text-white',
    build: 'bg-rose-500/90 text-white',
    spin_out: 'bg-blue-500/90 text-white',
    pause: 'bg-zinc-200 text-zinc-700 border border-dashed border-zinc-400',
  };
  const getCurrentPhaseForVenture = (venturePhases: VenturePhase[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sorted = [...venturePhases].sort(
      (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    );
    for (const p of sorted) {
      const start = new Date(p.start_date);
      const end = new Date(p.end_date);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      if (today >= start && today <= end) return p;
    }
    return null;
  };
  const { start: startDate, end: endDate } = getDateRange(
    phases,
    milestones
  );
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) || 90;
  const baseColumnWidth = getColumnWidth(zoom);
  const baseGridWidth = getGridTotalWidth(zoom, startDate, endDate);
  const columnWidth = baseColumnWidth * zoomScale;
  const gridTotalWidth = baseGridWidth * zoomScale;

  // Snap scroll to today on initial load
  useEffect(() => {
    if (loading || !scrollContainerRef.current || hasScrolledToTodayRef.current || timelineVentures.length === 0) return;
    const el = scrollContainerRef.current;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();
    const totalMs = endTime - startTime;
    if (totalMs <= 0) return;
    const todayOffsetPct = Math.max(0, Math.min(1, (today.getTime() - startTime) / totalMs));
    const sidebarWidth = 192; // w-48
    const todayPixelOffset = sidebarWidth + todayOffsetPct * gridTotalWidth;
    el.scrollLeft = todayPixelOffset;
    hasScrolledToTodayRef.current = true;
  }, [loading, timelineVentures.length, startDate, endDate, gridTotalWidth]);

  // Compute visible date range from scroll (for People view)
  const startTime = startDate.getTime();
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || gridTotalWidth <= 0 || totalDays <= 0) return;
    const updateVisibleRange = () => {
      const sidebarWidth = 192;
      const visibleGridStartPx = Math.max(0, el.scrollLeft - sidebarWidth);
      const visibleGridEndPx = Math.min(gridTotalWidth, el.scrollLeft + el.clientWidth - sidebarWidth);
      const startPct = visibleGridStartPx / gridTotalWidth;
      const endPct = visibleGridEndPx / gridTotalWidth;
      const totalMs = totalDays * 24 * 60 * 60 * 1000;
      const visibleStart = new Date(startTime + startPct * totalMs);
      const visibleEnd = new Date(startTime + endPct * totalMs);
      setVisibleDateRange({ start: visibleStart, end: visibleEnd });
    };
    updateVisibleRange();
    el.addEventListener('scroll', updateVisibleRange);
    window.addEventListener('resize', updateVisibleRange);
    return () => {
      el.removeEventListener('scroll', updateVisibleRange);
      window.removeEventListener('resize', updateVisibleRange);
    };
  }, [startTime, totalDays, gridTotalWidth]);

  const ZOOM_SCALE_MIN = 0.5;
  const ZOOM_SCALE_MAX = 2.5;
  const ZOOM_SENSITIVITY = 0.0015;
  const handleWheelZoom = useCallback(
    (e: React.WheelEvent) => {
      // Only zoom when Ctrl/Cmd is held; otherwise let vertical scroll work normally
      if (!e.ctrlKey && !e.metaKey) return;
      const delta = -e.deltaY * ZOOM_SENSITIVITY;
      if (delta !== 0) {
        e.preventDefault();
        setZoomScale((s) => Math.max(ZOOM_SCALE_MIN, Math.min(ZOOM_SCALE_MAX, s + delta)));
      }
    },
    []
  );

  const updateAllocation = async (
    id: number,
    updates: { fte_percentage?: number; phase_id?: number }
  ) => {
    const prev = allocations.find((a) => a.id === id);
    if (prev) {
      setAllocations((a) =>
        a.map((x) => (x.id === id ? { ...x, ...updates } : x))
      );
    }
    const res = await fetch(`/api/allocations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const updated = await res.json();
      setAllocations((a) => a.map((x) => (x.id === id ? updated : x)));
    } else if (prev) {
      setAllocations((a) => a.map((x) => (x.id === id ? prev : x)));
    }
  };

  const removeAllocation = async (id: number) => {
    setAllocations((a) => a.filter((x) => x.id !== id));
    const res = await fetch(`/api/allocations/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      await fetchData();
    }
  };

  const updatePhaseActivity = async (id: number, updates: { start_date: string; end_date: string }) => {
    const prev = phaseActivities.find((a) => a.id === id);
    if (prev) {
      setPhaseActivities((pa) =>
        pa.map((x) => (x.id === id ? { ...x, ...updates } : x))
      );
    }
    const res = await fetch(`/api/phase-activities/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const updated = await res.json();
      setPhaseActivities((pa) => pa.map((x) => (x.id === id ? updated : x)));
    } else if (prev) {
      setPhaseActivities((pa) => pa.map((x) => (x.id === id ? prev : x)));
    }
  };

  const deletePhaseActivity = async (id: number) => {
    setPhaseActivities((pa) => pa.filter((x) => x.id !== id));
    const res = await fetch(`/api/phase-activities/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      await fetchData();
    }
  };

  const addPhaseActivity = async (
    venturePhaseId: number,
    name: string,
    startDateStr: string,
    endDateStr: string
  ) => {
    const res = await fetch('/api/phase-activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        venture_phase_id: venturePhaseId,
        name,
        start_date: startDateStr,
        end_date: endDateStr,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setPhaseActivities((pa) => [...pa, created]);
    } else {
      await fetchData();
    }
  };

  const PHASE_ORDER = ['explore', 'validate', 'define', 'build', 'spin_out'] as const;

  const sortVenturePhasesByDate = useCallback(
    (venturePhases: { phase: string; start_date: string }[]) =>
      [...venturePhases].sort(
        (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      ),
    []
  );

  const updatePhase = async (id: number, updates: { start_date: string; end_date: string }) => {
    const prev = phases.find((p) => p.id === id);
    if (prev) {
      setPhases((p) =>
        p.map((x) => (x.id === id ? { ...x, ...updates } : x))
      );
    }
    const res = await fetch(`/api/venture-phases/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const updated = await res.json();
      setPhases((p) => p.map((x) => (x.id === id ? updated : x)));
    } else if (prev) {
      setPhases((p) => p.map((x) => (x.id === id ? prev : x)));
    }
  };

  const updatePhaseCascade = useCallback(
    async (phaseId: number, updates: { start_date: string; end_date: string }) => {
      const ventureId = phases.find((x) => x.id === phaseId)?.venture_id;
      if (!ventureId) {
        await updatePhase(phaseId, updates);
        return;
      }
      const venturePhasesRaw = phases.filter((p) => p.venture_id === ventureId);
      const hasPause = venturePhasesRaw.some((p) => p.phase === 'pause');
      const venturePhases = hasPause
        ? sortVenturePhasesByDate(venturePhasesRaw)
        : [...venturePhasesRaw].sort(
            (a, b) =>
              PHASE_ORDER.indexOf(a.phase as (typeof PHASE_ORDER)[number]) -
              PHASE_ORDER.indexOf(b.phase as (typeof PHASE_ORDER)[number])
          );
      const idx = venturePhases.findIndex((p) => p.id === phaseId);
      if (idx < 0) {
        await updatePhase(phaseId, updates);
        return;
      }
      const phase = venturePhases[idx];
      const newStart = updates.start_date ?? phase.start_date;
      const newEnd = updates.end_date ?? phase.end_date;
      const toUpdate: { id: number; start_date: string; end_date: string }[] = [];
      toUpdate.push({ id: phaseId, start_date: newStart, end_date: newEnd });
      let runningEnd = newEnd;
      for (let i = idx + 1; i < venturePhases.length; i++) {
        const p = venturePhases[i];
        const deltaMs = new Date(runningEnd).getTime() - new Date(p.start_date).getTime();
        const newPStart = runningEnd;
        const newPEnd = new Date(p.end_date);
        newPEnd.setTime(newPEnd.getTime() + deltaMs);
        runningEnd = newPEnd.toISOString().slice(0, 10);
        toUpdate.push({ id: p.id, start_date: newPStart, end_date: runningEnd });
      }
      if (idx > 0) {
        const prev = venturePhases[idx - 1];
        toUpdate.push({ id: prev.id, start_date: prev.start_date, end_date: newStart });
      }
      const prevPhases = phases;
      setPhases((p) => {
        const next = [...p];
        for (const u of toUpdate) {
          const i = next.findIndex((x) => x.id === u.id);
          if (i >= 0) next[i] = { ...next[i], start_date: u.start_date, end_date: u.end_date };
        }
        return next;
      });
      try {
        for (const u of toUpdate) {
          const res = await fetch(`/api/venture-phases/${u.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ start_date: u.start_date, end_date: u.end_date }),
          });
          if (!res.ok) throw new Error('Failed to update');
        }
      } catch {
        setPhases(prevPhases);
      }
    },
    [phases, sortVenturePhasesByDate]
  );

  const handleAddPause = useCallback(
    async (afterPhaseId: number) => {
      const phase = phases.find((p) => p.id === afterPhaseId);
      if (!phase) return;
      const venturePhases = sortVenturePhasesByDate(
        phases.filter((p) => p.venture_id === phase.venture_id)
      );
      const idx = venturePhases.findIndex((p) => p.id === afterPhaseId);
      if (idx < 0) return;
      const end = new Date(phase.end_date);
      end.setDate(end.getDate() + 1);
      const pauseStart = end.toISOString().slice(0, 10);
      const pauseEndDate = new Date(end);
      pauseEndDate.setDate(pauseEndDate.getDate() + 14);
      const pauseEnd = pauseEndDate.toISOString().slice(0, 10);
      const pauseDurationMs = new Date(pauseEnd).getTime() - new Date(pauseStart).getTime();
      try {
        const res = await fetch('/api/venture-phases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            venture_id: phase.venture_id,
            phase: 'pause',
            start_date: pauseStart,
            end_date: pauseEnd,
            sort_order: idx + 1,
          }),
        });
        if (!res.ok) throw new Error('Failed to create pause');
        const created = await res.json();
        const shifted: { id: number; start_date: string; end_date: string }[] = [];
        for (let i = idx + 1; i < venturePhases.length; i++) {
          const p = venturePhases[i];
          const newStart = new Date(p.start_date);
          newStart.setTime(newStart.getTime() + pauseDurationMs);
          const newEnd = new Date(p.end_date);
          newEnd.setTime(newEnd.getTime() + pauseDurationMs);
          const patchRes = await fetch(`/api/venture-phases/${p.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              start_date: newStart.toISOString().slice(0, 10),
              end_date: newEnd.toISOString().slice(0, 10),
            }),
          });
          if (!patchRes.ok) throw new Error('Failed to shift phase');
          shifted.push({
            id: p.id,
            start_date: newStart.toISOString().slice(0, 10),
            end_date: newEnd.toISOString().slice(0, 10),
          });
        }
        setPhases((prev) => {
          let next = [...prev, created];
          for (const u of shifted) {
            const i = next.findIndex((x) => x.id === u.id);
            if (i >= 0) next[i] = { ...next[i], start_date: u.start_date, end_date: u.end_date };
          }
          return next;
        });
        toast.show('Pause added');
      } catch (e) {
        toast.show(e instanceof Error ? e.message : 'Failed to add pause');
      }
    },
    [phases, sortVenturePhasesByDate, toast]
  );

  const handlePauseResume = useCallback((phaseId: number) => {
    setResumePausePhaseId(phaseId);
  }, []);

  const handleResumePauseAction = useCallback(
    async (action: 'resume_previous' | 'start_next') => {
      const phaseId = resumePausePhaseId;
      if (!phaseId) return;
      const pausePhase = phases.find((p) => p.id === phaseId);
      if (!pausePhase || pausePhase.phase !== 'pause') return;
      const venturePhases = sortVenturePhasesByDate(
        phases.filter((p) => p.venture_id === pausePhase.venture_id)
      );
      const idx = venturePhases.findIndex((p) => p.id === phaseId);
      if (idx < 0) return;
      const prevPhase = idx > 0 ? venturePhases[idx - 1] : null;
      const nextPhase = idx < venturePhases.length - 1 ? venturePhases[idx + 1] : null;
      setResumePausePhaseId(null);
      try {
        if (action === 'resume_previous' && prevPhase) {
          const newEnd = pausePhase.end_date;
          await fetch(`/api/venture-phases/${prevPhase.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ end_date: newEnd }),
          });
          const pauseDurationMs =
            new Date(pausePhase.end_date).getTime() - new Date(pausePhase.start_date).getTime();
          for (let i = idx + 1; i < venturePhases.length; i++) {
            const p = venturePhases[i];
            const newStart = new Date(p.start_date);
            newStart.setTime(newStart.getTime() - pauseDurationMs);
            const newEndDate = new Date(p.end_date);
            newEndDate.setTime(newEndDate.getTime() - pauseDurationMs);
            await fetch(`/api/venture-phases/${p.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                start_date: newStart.toISOString().slice(0, 10),
                end_date: newEndDate.toISOString().slice(0, 10),
              }),
            });
          }
          await fetch(`/api/venture-phases/${phaseId}`, { method: 'DELETE' });
        } else if (action === 'start_next' && nextPhase) {
          const newStart = pausePhase.start_date;
          const prevEnd = new Date(pausePhase.start_date);
          prevEnd.setDate(prevEnd.getDate() - 1);
          const prevEndStr = prevEnd.toISOString().slice(0, 10);
          if (prevPhase) {
            await fetch(`/api/venture-phases/${prevPhase.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ end_date: prevEndStr }),
            });
          }
          await fetch(`/api/venture-phases/${nextPhase.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ start_date: newStart }),
          });
          await fetch(`/api/venture-phases/${phaseId}`, { method: 'DELETE' });
        } else {
          return;
        }
        toast.show('Resumed');
        fetchData();
      } catch (e) {
        toast.show(e instanceof Error ? e.message : 'Failed to resume');
      }
    },
    [resumePausePhaseId, phases, sortVenturePhasesByDate, toast]
  );

  const RESUME_PHASE_LABELS: Record<string, string> = {
    explore: 'Explore',
    validate: 'Validate',
    define: 'Define',
    build: 'Build',
    spin_out: 'Spin out',
  };

  const selectedVenture = selectedVentureId
    ? ventures.find((v) => v.id === selectedVentureId)
    : null;

  const handlePhaseRowClick = useCallback(
    (ventureId: number, e: React.MouseEvent) => {
      const grid = (e.target as HTMLElement).closest('[data-timeline-grid]') as HTMLElement | null;
      if (!grid) return;
      const rect = grid.getBoundingClientRect();
      const offsetPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const totalMs = totalDays * 24 * 60 * 60 * 1000;
      const date = new Date(startDate.getTime() + (offsetPct / 100) * totalMs);
      setMilestoneModal({
        open: true,
        mode: 'add',
        ventureId,
        initialDate: date.toISOString().slice(0, 10),
      });
    },
    [startDate, totalDays]
  );

  const handleMilestoneSave = useCallback((updated: HiringMilestone) => {
    setMilestones((prev) => {
      const exists = prev.some((m) => m.id === updated.id);
      if (exists) return prev.map((m) => (m.id === updated.id ? updated : m));
      return [...prev, updated].sort((a, b) => a.target_date.localeCompare(b.target_date));
    });
    toast.show('Saved');
  }, [toast]);

  const handleMilestoneDelete = useCallback((id: number) => {
    setMilestones((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const handleMilestoneUpdate = useCallback(async (id: number, targetDate: string) => {
    const res = await fetch(`/api/hiring-milestones/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_date: targetDate }),
    });
    if (res.ok) {
      const updated = await res.json();
      handleMilestoneSave(updated);
    }
  }, [handleMilestoneSave]);

  const handleAnalyzeImpact = useCallback(() => {
    setImpactInitialMessage('Analyze the current portfolio for delays, risks, overload, and recommendations.');
    setImpactPanelOpen(true);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-zinc-200" />
        <div className="h-96 animate-pulse rounded-xl border border-zinc-200 bg-zinc-50" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-900">Active Ventures</h2>
          <p className="mt-0.5 text-sm text-zinc-500">
            Drag phases to resize · Drag milestones to move · Ctrl+scroll to zoom
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {zoomScale !== 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 tabular-nums">{Math.round(zoomScale * 100)}%</span>
              <button
                onClick={() => setZoomScale(1)}
                className="text-xs text-zinc-400 hover:text-zinc-600"
                title="Reset zoom"
              >
                Reset
              </button>
            </div>
          )}
          <button
            onClick={() => {
              const next = !showPeopleView;
              setShowPeopleView(next);
              setShowPeople(next);
            }}
            className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${
              showPeopleView
                ? 'border-amber-300 bg-amber-50 text-amber-800'
                : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
            }`}
          >
            {showPeopleView ? 'People view on' : 'People view'}
          </button>
          <button
            onClick={handleAnalyzeImpact}
            className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Analyze impact
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add project
          </button>
        </div>
      </div>

      {timelineVentures.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-200 py-20">
          <p className="text-zinc-600">No projects on timeline.</p>
          <p className="mt-1 text-sm text-zinc-500">Add a project to get started.</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Add project
          </button>
        </div>
      ) : (
        <div className="flex max-h-[calc(100vh-14rem)] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div
            ref={scrollContainerRef}
            className="relative flex flex-1 flex-col overflow-auto"
            onWheel={handleWheelZoom}
          >
            <div className="flex min-w-max">
              <div className="sticky left-0 z-20 w-48 shrink-0 border-r border-zinc-200 bg-zinc-50" />
              <div className="timeline-grid shrink-0" style={{ width: gridTotalWidth }}>
                <TimeAxis
                  zoom={zoom}
                  startDate={startDate}
                  endDate={endDate}
                  columnWidth={columnWidth}
                />
              </div>
            </div>
            {timelineVentures.map((v, ventureIndex) => {
              const isCollapsed = collapsedProjectIds.has(v.id);
              const venturePhases = phases.filter((p) => p.venture_id === v.id);
              const currentPhase = getCurrentPhaseForVenture(venturePhases);
              const phaseTypes = ['explore', 'validate', 'define', 'build', 'spin_out', 'pause'] as const;
              const phaseLabels: Record<string, string> = {
                explore: 'Explore',
                validate: 'Validate',
                define: 'Define',
                build: 'Build',
                spin_out: 'Spin out',
                pause: 'Paused',
              };

              return (
                <div key={v.id} className="flex flex-col">
                  {ventureIndex > 0 && (
                    <div className="flex min-w-max border-t-2 border-zinc-900 pt-4">
                      <div className="sticky left-0 z-20 w-48 shrink-0 border-r border-zinc-200 bg-zinc-50" />
                      <div className="shrink-0 bg-zinc-50" style={{ width: gridTotalWidth }} />
                    </div>
                  )}
                  <div className="flex min-w-max">
                    <div className="sticky left-0 z-20 w-48 shrink-0 border-r border-zinc-200 bg-zinc-50">
                      {isCollapsed ? (
                        <div className="flex h-10 items-center gap-1.5 border-b border-zinc-100 px-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleProjectCollapse(v.id);
                            }}
                            className="mr-1 shrink-0 rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
                            aria-label="Expand project"
                            title="Expand"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="-rotate-90"><polyline points="6 9 12 15 18 9" /></svg>
                          </button>
                          <button onClick={() => setSelectedVentureId(v.id)} className="shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700" aria-label="Edit project" title="Edit project">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                          </button>
                          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="truncate text-sm font-medium text-zinc-900">{v.name}</span>
                            <span className={`self-start rounded-full px-2 py-0.5 text-xs font-medium ${currentPhase ? PHASE_PILL_COLORS[currentPhase.phase] || 'bg-zinc-200 text-zinc-700' : 'bg-zinc-200 text-zinc-500'}`}>
                              {currentPhase ? phaseLabels[currentPhase.phase] ?? '—' : '—'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex h-8 items-center gap-2 border-b border-zinc-100 px-3">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleProjectCollapse(v.id);
                              }}
                              className="shrink-0 rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
                              aria-label={isCollapsed ? 'Expand project' : 'Collapse project'}
                              title={isCollapsed ? 'Expand' : 'Collapse'}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={isCollapsed ? '-rotate-90' : ''}>
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </button>
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-900">{v.name}</span>
                            <button onClick={() => setSelectedVentureId(v.id)} className="shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700" aria-label="Edit project" title="Edit project">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                          </div>
                          <div className="flex h-10 items-center gap-2 border-b border-zinc-100 px-3">
                            <div className="flex flex-1 items-center justify-center gap-0.5">
                              {phaseTypes.map((type) => {
                                const phase = venturePhases.find((p) => p.phase === type);
                                if (!phase) return null;
                                const isPhaseExpanded = expandedPhaseIds.has(phase.id);
                                const isCurrentPhase = currentPhase?.id === phase.id;
                                const abbrev: Record<string, string> = {
                                  explore: 'E',
                                  validate: 'V',
                                  define: 'D',
                                  build: 'B',
                                  spin_out: 'S',
                                  pause: 'P',
                                };
                                return (
                                  <button
                                    key={phase.id}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedPhaseIds((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(phase.id)) next.delete(phase.id);
                                        else next.add(phase.id);
                                        return next;
                                      });
                                    }}
                                    className={`flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded px-1 text-[10px] font-medium transition ${isPhaseExpanded ? `${PHASE_PILL_COLORS[phase.phase] || 'bg-zinc-300'} ${phase.phase === 'pause' ? 'text-zinc-700' : 'text-white'}` : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'} ${isCurrentPhase && !isPhaseExpanded ? 'ring-1 ring-zinc-400' : ''}`}
                                    title={`${phaseLabels[phase.phase]}${isCurrentPhase ? ' (current)' : ''} · ${isPhaseExpanded ? 'Collapse' : 'Expand'}`}
                                  >
                                    {abbrev[phase.phase] ?? '?'}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div className="h-6 border-b border-zinc-100" aria-hidden />
                          {phaseTypes.map((type) => {
                            const phase = venturePhases.find((p) => p.phase === type);
                            if (!phase) return null;
                            const isExpanded = expandedPhaseIds.has(phase.id);
                            const activities = isExpanded
                              ? [...phaseActivities.filter((a) => a.venture_phase_id === phase.id)].sort(
                                  (a, b) => a.sort_order - b.sort_order
                                )
                              : [];
                            const phaseAllocs = allocations.filter((a) => a.venture_id === v.id && a.phase_id === phase.id);
                            const peopleNames = phaseAllocs
                              .map((a) => employees.find((e) => e.id === a.employee_id)?.name)
                              .filter(Boolean)
                              .join(', ');
                            return (
                              <div key={phase.id}>
                                {activities.map((act) => (
                                  <div key={act.id} className="flex h-8 items-center border-b border-zinc-100 pl-6 pr-3">
                                    <span className="truncate text-xs text-zinc-600">{act.name}</span>
                                  </div>
                                ))}
                                {showPeople && (phaseAllocs.length > 0 || employees.some((e) => !phaseAllocs.some((a) => a.employee_id === e.id))) && (
                                  <div className="flex h-8 items-center border-b border-zinc-100 pl-6 pr-3">
                                    <span className="truncate text-xs text-zinc-500">{peopleNames || '\u00A0'}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                    <div className="timeline-grid relative shrink-0 pb-4" data-timeline-grid style={{ width: gridTotalWidth }}>
                      <ProjectRow
                        key={v.id}
                        venture={v}
                        phases={phases.filter((p) => p.venture_id === v.id)}
                        phaseActivities={phaseActivities}
                        collapsed={collapsedProjectIds.has(v.id)}
                        currentPhase={getCurrentPhaseForVenture(phases.filter((p) => p.venture_id === v.id))}
                        zoom={zoom}
                        milestones={milestones.filter((m) => m.venture_id === v.id)}
                        allocations={allocations.filter((a) => a.venture_id === v.id)}
                        employees={employees}
                        startDate={startDate}
                        endDate={endDate}
                        totalDays={totalDays}
                        gridWidth={gridTotalWidth}
                        showPeople={showPeople}
                        expandedPhaseIds={expandedPhaseIds}
                        onExpandPhase={(id) => setExpandedPhaseIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(id)) next.delete(id);
                          else next.add(id);
                          return next;
                        })}
                        onPhaseUpdate={updatePhaseCascade}
                        onActivityUpdate={updatePhaseActivity}
                        onActivityDelete={deletePhaseActivity}
                        onActivityAdd={addPhaseActivity}
                        onAddPause={handleAddPause}
                        onPauseResume={handlePauseResume}
                        onAllocationUpdate={updateAllocation}
                        onAllocationRemove={removeAllocation}
                        onRefresh={fetchData}
                        onOpenPanel={() => setSelectedVentureId(v.id)}
                        onPhaseRowClick={handlePhaseRowClick}
                        onMilestoneClick={(m) => setMilestoneModal({ open: true, mode: 'edit', ventureId: v.id, milestone: m })}
                        onMilestoneUpdate={handleMilestoneUpdate}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {selectedVenture && (
            <div className="w-80 shrink-0">
              <ProjectPanel
                venture={selectedVenture}
                phases={phases.filter((p) => p.venture_id === selectedVenture.id)}
                milestones={milestones.filter((m) => m.venture_id === selectedVenture.id)}
                allocations={allocations.filter((a) => a.venture_id === selectedVenture.id)}
                employees={employees}
                onClose={() => setSelectedVentureId(null)}
                onSave={async (updates) => {
                  setVentures((prev) =>
                    prev.map((v) =>
                      v.id === selectedVenture.id ? { ...v, ...updates.venture } : v
                    )
                  );
                  setPhases((prev) =>
                    updates.phases.length > 0
                      ? prev.filter((p) => p.venture_id !== selectedVenture.id).concat(updates.phases)
                      : prev
                  );
                  setMilestones((prev) =>
                    updates.milestones.length > 0
                      ? prev.filter((m) => m.venture_id !== selectedVenture.id).concat(updates.milestones)
                      : prev
                  );
                  setAllocations((prev) =>
                    updates.allocations.length > 0
                      ? prev.filter((a) => a.venture_id !== selectedVenture.id).concat(updates.allocations)
                      : prev
                  );
                  toast.show('Saved');
                }}
                onRemove={async () => {
                  const id = selectedVenture.id;
                  setVentures((prev) =>
                    prev.map((v) => (v.id === id ? { ...v, timeline_visible: false } : v))
                  );
                  setSelectedVentureId(null);
                  const res = await fetch(`/api/ventures/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ timeline_visible: false }),
                  });
                  if (!res.ok) {
                    setVentures((prev) =>
                      prev.map((v) => (v.id === id ? { ...v, timeline_visible: true } : v))
                    );
                  }
                }}
              />
            </div>
          )}
        </div>
      )}

      {showPeopleView && timelineVentures.length > 0 && visibleDateRange && (
        <PeopleView
          ventures={ventures}
          phases={phases}
          allocations={allocations}
          employees={employees}
          visibleStartDate={visibleDateRange.start}
          visibleEndDate={visibleDateRange.end}
        />
      )}

      {milestoneModal && (
        <MilestoneModal
          isOpen={milestoneModal.open}
          onClose={() => setMilestoneModal(null)}
          ventureId={milestoneModal.ventureId}
          mode={milestoneModal.mode}
          initialDate={milestoneModal.initialDate}
          milestone={milestoneModal.milestone}
          onSave={handleMilestoneSave}
          onDelete={milestoneModal.mode === 'edit' ? handleMilestoneDelete : undefined}
        />
      )}
      {resumePausePhaseId && (() => {
        const pausePhase = phases.find((p) => p.id === resumePausePhaseId);
        if (!pausePhase || pausePhase.phase !== 'pause') return null;
        const venturePhases = sortVenturePhasesByDate(
          phases.filter((p) => p.venture_id === pausePhase.venture_id)
        );
        const idx = venturePhases.findIndex((p) => p.id === resumePausePhaseId);
        const prevPhase = idx > 0 ? venturePhases[idx - 1] : null;
        const nextPhase = idx < venturePhases.length - 1 ? venturePhases[idx + 1] : null;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setResumePausePhaseId(null)}
          >
            <div
              className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="mb-3 text-lg font-semibold text-zinc-900">Resume from pause</h3>
              <p className="mb-4 text-sm text-zinc-600">
                Choose how to resume this venture:
              </p>
              <div className="flex flex-col gap-2">
                {prevPhase && (
                  <button
                    type="button"
                    onClick={() => handleResumePauseAction('resume_previous')}
                    className="rounded-lg border border-zinc-200 border-l-4 border-l-teal-400 bg-white px-4 py-2 text-left text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                  >
                    Resume as {RESUME_PHASE_LABELS[prevPhase.phase] ?? prevPhase.phase}
                  </button>
                )}
                {nextPhase && (
                  <button
                    type="button"
                    onClick={() => handleResumePauseAction('start_next')}
                    className="rounded-lg border border-zinc-200 border-l-4 border-l-violet-400 bg-white px-4 py-2 text-left text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                  >
                    Start {RESUME_PHASE_LABELS[nextPhase.phase] ?? nextPhase.phase}
                  </button>
                )}
                {!prevPhase && !nextPhase && (
                  <p className="text-sm text-zinc-500">No adjacent phases to resume into.</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setResumePausePhaseId(null)}
                className="mt-4 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
            </div>
          </div>
        );
      })()}
      <AddProjectModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdded={async (ventureId, venture) => {
          const addedVenture = venture ? { ...venture, timeline_visible: true } : null;
          if (addedVenture) {
            setVentures((prev) => {
              const filtered = prev.filter((x) => x.id !== addedVenture.id);
              return [...filtered, addedVenture];
            });
          }
          await fetchData();
          if (addedVenture) {
            setVentures((prev) => {
              const hasIt = prev.some((v) => v.id === addedVenture.id);
              const withVisible = { ...addedVenture, timeline_visible: true };
              if (hasIt) {
                return prev.map((v) => (v.id === addedVenture.id ? { ...v, ...withVisible } : v));
              }
              return [...prev, withVisible];
            });
          }
          if (ventureId != null) setSelectedVentureId(ventureId);
        }}
      />
      <ImpactPanel
        isOpen={impactPanelOpen}
        onClose={() => setImpactPanelOpen(false)}
        initialMessage={impactInitialMessage}
        onInitialMessageSent={() => setImpactInitialMessage(null)}
      />
    </div>
  );
}
