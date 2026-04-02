'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Venture, VenturePhase, HiringMilestone, Employee, Allocation, PhaseActivity } from '@/types';

function TagPickerDropdown({
  anchorRect,
  ventureId,
  currentTag,
  onSelect,
  onClose,
}: {
  anchorRect: DOMRect;
  ventureId: number;
  currentTag: 'greenlit' | 'battling' | 'paused' | null;
  onSelect: (ventureId: number, tag: 'greenlit' | 'battling' | 'paused' | null) => void;
  onClose: () => void;
}) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const options: { value: 'greenlit' | 'battling' | 'paused' | null; label: string }[] = [
    { value: 'greenlit', label: 'Greenlit' },
    { value: 'battling', label: 'Battling' },
    { value: 'paused', label: 'Paused' },
    { value: null, label: 'None' },
  ];

  return (
    <div
      ref={dropdownRef}
      className="fixed z-50 min-w-[140px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
      style={{
        left: anchorRect.left,
        top: anchorRect.bottom + 4,
      }}
    >
      <div className="px-2 py-1.5 text-[10px] font-medium uppercase text-zinc-400">
        Set tag
      </div>
      {options.map((opt) => (
        <button
          key={opt.label}
          type="button"
          onClick={() => {
            onSelect(ventureId, opt.value);
            onClose();
          }}
          className={`flex w-full items-center px-3 py-2 text-left text-sm hover:bg-zinc-50 ${opt.value === currentTag ? 'bg-zinc-50 font-medium text-zinc-900' : 'text-zinc-700'}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function HiddenVenturesDropdown({
  ventures,
  unhidingId,
  onUnhide,
  onClose,
  anchorRef,
}: {
  ventures: Venture[];
  unhidingId: number | null;
  onUnhide: (id: number) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        anchorRef.current &&
        !anchorRef.current.contains(target)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [anchorRef, onClose]);

  const rect = anchorRef.current?.getBoundingClientRect();
  if (!rect) return null;

  return (
    <div
      ref={dropdownRef}
      className="fixed z-50 min-w-[200px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
      style={{
        left: rect.left,
        top: rect.bottom + 4,
      }}
    >
      <div className="px-2 py-1.5 text-[10px] font-medium uppercase text-zinc-400">
        Hidden projects
      </div>
      {ventures.map((v) => (
        <button
          key={v.id}
          type="button"
          onClick={() => onUnhide(v.id)}
          disabled={unhidingId === v.id}
          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          <span className="truncate">{v.name}</span>
          <span className="shrink-0 text-xs text-zinc-500">
            {unhidingId === v.id ? 'Adding…' : 'Unhide'}
          </span>
        </button>
      ))}
    </div>
  );
}

function SortableVentureRow({
  venture,
  children,
}: {
  venture: Venture;
  children: (params: {
    setNodeRef: (el: HTMLElement | null) => void;
    style: React.CSSProperties;
    attributes: Record<string, unknown>;
    listeners: Record<string, unknown>;
  }) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: venture.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return <>{children({ setNodeRef, style, attributes: attributes as unknown as Record<string, unknown>, listeners: listeners as unknown as Record<string, unknown> })}</>;
}

import { ActiveVentureKanbanCard } from './ActiveVentureKanbanCard';
import { AddProjectModal } from './timeline/AddProjectModal';
import { TimeAxis, getColumnWidth, getDateRange, getGridTotalWidth, getMonthsBetween, type ZoomLevel } from './timeline/TimeAxis';
import { ProjectRow } from './timeline/ProjectRow';
import { ProjectPanel } from './timeline/ProjectPanel';
import { MilestoneModal } from './timeline/MilestoneModal';
import { ImpactPanel } from './ImpactPanel';
import { useToast } from './Toast';
import { useTimelineSyncOptional } from '@/contexts/TimelineSyncContext';
import { useUndoOptional } from '@/contexts/UndoContext';

interface TimelineViewProps {
  defaultCollapsed?: boolean;
  showSectionHeader?: boolean;
  refreshTrigger?: number;
  onVentureDeleted?: () => void;
  /** Bump global refresh (e.g. People Allocation + sync) after local timeline mutations. */
  onRefresh?: () => void;
}

export function TimelineView(props?: TimelineViewProps) {
  const { defaultCollapsed = false, showSectionHeader = true, refreshTrigger, onVentureDeleted, onRefresh } =
    props ?? {};
  const toast = useToast();
  const undo = useUndoOptional();
  const [ventures, setVentures] = useState<Venture[]>([]);
  const [phases, setPhases] = useState<VenturePhase[]>([]);
  const [phaseActivities, setPhaseActivities] = useState<PhaseActivity[]>([]);
  const [milestones, setMilestones] = useState<HiringMilestone[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [expandedPhaseIds, setExpandedPhaseIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showHiddenDropdown, setShowHiddenDropdown] = useState(false);
  const [unhidingId, setUnhidingId] = useState<number | null>(null);
  const showHiddenButtonRef = useRef<HTMLButtonElement>(null);
  const [impactPanelOpen, setImpactPanelOpen] = useState(false);
  const [impactInitialMessage, setImpactInitialMessage] = useState<string | null>(null);
  const [zoom] = useState<ZoomLevel>('month');
  const [localZoomScale, setLocalZoomScale] = useState(1);
  const sync = useTimelineSyncOptional();
  const useSyncedAxis = !!(sync?.axisHydrated);
  const zoomScale = useSyncedAxis ? sync!.zoomScale : localZoomScale;
  const setZoomScale = useSyncedAxis ? sync!.setZoomScale : setLocalZoomScale;
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
  const [tagPickerVentureId, setTagPickerVentureId] = useState<number | null>(null);
  const [tagPickerAnchorRect, setTagPickerAnchorRect] = useState<DOMRect | null>(null);
  const [viewMode, setViewMode] = useState<'timeline' | 'kanban'>('timeline');
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

  const handleHideFromTimeline = useCallback(
    async (ventureId: number) => {
      const prevV = ventures.find((v) => v.id === ventureId);
      setVentures((prev) => prev.map((v) => (v.id === ventureId ? { ...v, timeline_visible: false } : v)));
      setSelectedVentureId((id) => (id === ventureId ? null : id));
      const res = await fetch(`/api/ventures/${ventureId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeline_visible: false }),
      });
      if (!res.ok) {
        setVentures((prev) => prev.map((v) => (v.id === ventureId ? { ...v, timeline_visible: true } : v)));
        toast.show('Failed to hide');
      } else {
        toast.show('Hidden from timeline');
        onRefresh?.();
        if (prevV) {
          undo?.pushUndo({
            label: 'Hide from timeline',
            undo: async () => {
              const r = await fetch(`/api/ventures/${ventureId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  timeline_visible: prevV.timeline_visible,
                  hidden_from_venture_tracker: prevV.hidden_from_venture_tracker,
                }),
              });
              if (!r.ok) throw new Error('Undo failed');
              const data = await r.json();
              setVentures((prev) => prev.map((v) => (v.id === ventureId ? data : v)));
            },
          });
        }
      }
    },
    [toast, undo, ventures, onRefresh]
  );

  const applyTimelineTemplate = useCallback(async (ventureId: number) => {
    const res = await fetch(`/api/ventures/${ventureId}/apply-timeline-template`, { method: 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.hint ? `${data.error || 'Failed'}. ${data.hint}` : data.error || 'Failed to apply template');
    }
    const today = new Date();
    const milestoneDate = new Date(today);
    milestoneDate.setDate(milestoneDate.getDate() + 90);
    await fetch('/api/hiring-milestones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        venture_id: ventureId,
        role_type: 'other',
        label: 'Milestone',
        target_date: milestoneDate.toISOString().slice(0, 10),
      }),
    });
  }, []);

  const handleGreenlight = useCallback(
    async (ventureId: number) => {
      const prevV = ventures.find((v) => v.id === ventureId);
      try {
        const res = await fetch(`/api/ventures/${ventureId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'active' }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.show(data.error || 'Failed to greenlight');
          return;
        }
        setVentures((prev) => prev.map((v) => (v.id === ventureId ? data : v)));
        toast.show('Project greenlit');
        await fetchData();
        onRefresh?.();
        if (prevV) {
          undo?.pushUndo({
            label: 'Greenlight project',
            undo: async () => {
              const r = await fetch(`/api/ventures/${ventureId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: prevV.status }),
              });
              if (!r.ok) throw new Error('Undo failed');
              const restored = await r.json();
              setVentures((prev) => prev.map((v) => (v.id === ventureId ? restored : v)));
              await fetchData();
              onRefresh?.();
            },
          });
        }
      } catch (err) {
        toast.show(err instanceof Error ? err.message : 'Something went wrong');
      }
    },
    [toast, undo, ventures, onRefresh]
  );

  const handleUnhide = useCallback(
    async (ventureId: number) => {
      const prevV = ventures.find((v) => v.id === ventureId);
      setUnhidingId(ventureId);
      try {
        const res = await fetch(`/api/ventures/${ventureId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timeline_visible: true, hidden_from_venture_tracker: false }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.show(data.error || 'Failed to add back');
          return;
        }
        const phasesRes = await fetch(`/api/venture-phases?ventureId=${ventureId}`);
        const phasesJson = await phasesRes.json();
        if (Array.isArray(phasesJson) && phasesJson.length === 0) {
          try {
            await applyTimelineTemplate(ventureId);
          } catch (err) {
            toast.show(err instanceof Error ? err.message : 'Failed to apply template');
            return;
          }
        }
        setVentures((prev) =>
          prev.map((v) => (v.id === ventureId ? { ...data, timeline_visible: true } : v))
        );
        setShowHiddenDropdown(false);
        toast.show('Added back to timeline');
        await fetchData();
        onRefresh?.();
        if (prevV) {
          undo?.pushUndo({
            label: 'Add back to timeline',
            undo: async () => {
              const r = await fetch(`/api/ventures/${ventureId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  timeline_visible: prevV.timeline_visible,
                  hidden_from_venture_tracker: prevV.hidden_from_venture_tracker,
                }),
              });
              if (!r.ok) throw new Error('Undo failed');
              const restored = await r.json();
              setVentures((prev) => prev.map((v) => (v.id === ventureId ? restored : v)));
              await fetchData();
              onRefresh?.();
            },
          });
        }
      } catch (err) {
        toast.show(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setUnhidingId(null);
      }
    },
    [toast, applyTimelineTemplate, undo, ventures, onRefresh]
  );

  const timelineSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

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
    const list = Array.isArray(vData) ? vData : [];
    setVentures(list);
    setPhases(pData || []);
    setPhaseActivities(paData || []);
    setMilestones(mData || []);
    setAllocations(aData || []);
    setEmployees(eData || []);
  };

  /** Refetch timeline data and bump Command Center refresh so People Allocation stays in sync. */
  const refreshTimelineAndPeople = async () => {
    await fetchData();
    onRefresh?.();
  };

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [refreshTrigger]);

  const isTimelineVisible = (v: Venture) => v.timeline_visible === true;
  const timelineVentures = ventures
    .filter(isTimelineVisible)
    .sort(
      (a, b) =>
        (a.timeline_priority ?? 0) - (b.timeline_priority ?? 0) ||
        a.backlog_priority - b.backlog_priority ||
        a.name.localeCompare(b.name)
    );

  const getVentureTag = (v: Venture): 'greenlit' | 'battling' | 'paused' | null => {
    if (v.is_paused === true) return 'paused';
    if (v.is_greenlit === true) return 'greenlit';
    if (v.is_active === true) return 'battling';
    return null;
  };

  const handleSetVentureTag = useCallback(
    async (ventureId: number, tag: 'greenlit' | 'battling' | 'paused' | null) => {
      const prevV = ventures.find((v) => v.id === ventureId);
      const before = prevV
        ? {
            is_greenlit: prevV.is_greenlit ?? false,
            is_paused: prevV.is_paused ?? false,
            is_active: prevV.is_active ?? false,
          }
        : null;
      const flags =
        tag === 'greenlit'
          ? { is_greenlit: true, is_paused: false, is_active: false }
          : tag === 'battling'
            ? { is_greenlit: false, is_paused: false, is_active: true }
            : tag === 'paused'
              ? { is_greenlit: false, is_paused: true, is_active: false }
              : { is_greenlit: false, is_paused: false, is_active: false };
      const res = await fetch(`/api/ventures/${ventureId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(flags),
      });
      if (res.ok) {
        const data = await res.json();
        setVentures((prev) => prev.map((v) => (v.id === ventureId ? data : v)));
        if (before) {
          undo?.pushUndo({
            label: 'Change venture tag',
            undo: async () => {
              const r = await fetch(`/api/ventures/${ventureId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(before),
              });
              if (!r.ok) throw new Error('Undo failed');
              const restored = await r.json();
              setVentures((prev) => prev.map((v) => (v.id === ventureId ? restored : v)));
            },
          });
        }
      } else {
        toast.show('Failed to update tag');
      }
    },
    [toast, undo, ventures]
  );

  // Include exploration_staging so ventures added as "Plan" before status was fixed to `planned`
  // still appear here after Hide from timeline (they stayed exploration_staging + timeline_visible false).
  const hiddenVentures = ventures.filter(
    (v) =>
      (v.status === 'backlog' ||
        v.status === 'active' ||
        v.status === 'planned' ||
        v.status === 'exploration_staging') &&
      (v.timeline_visible !== true || v.hidden_from_venture_tracker === true)
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = timelineVentures.findIndex((v) => v.id === active.id);
      const newIndex = timelineVentures.findIndex((v) => v.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;
      const previousVentureIds = timelineVentures.map((v) => v.id);
      const reordered = arrayMove(timelineVentures, oldIndex, newIndex);
      const ventureIds = reordered.map((v) => v.id);
      setVentures((prev) =>
        prev.map((v) => {
          const idx = ventureIds.indexOf(v.id);
          if (idx >= 0) return { ...v, timeline_priority: idx };
          return v;
        })
      );
      const res = await fetch('/api/ventures/timeline-reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ventureIds }),
      });
      if (!res.ok) {
        fetchData();
        toast.show('Failed to reorder');
      } else {
        undo?.pushUndo({
          label: 'Reorder timeline',
          undo: async () => {
            const r = await fetch('/api/ventures/timeline-reorder', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ventureIds: previousVentureIds }),
            });
            if (!r.ok) throw new Error('Undo failed');
            await fetchData();
          },
        });
      }
    },
    [timelineVentures, toast, undo]
  );

  const handleSetProjectLead = useCallback(
    async (ventureId: number, employeeId: number) => {
      const prevV = ventures.find((v) => v.id === ventureId);
      const prevLead = prevV?.primary_contact_id ?? null;
      const res = await fetch(`/api/ventures/${ventureId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primary_contact_id: employeeId }),
      });
      if (res.ok) {
        const data = await res.json();
        setVentures((prev) => prev.map((v) => (v.id === ventureId ? data : v)));
        undo?.pushUndo({
          label: 'Set project lead',
          undo: async () => {
            const r = await fetch(`/api/ventures/${ventureId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ primary_contact_id: prevLead }),
            });
            if (!r.ok) throw new Error('Undo failed');
            const restored = await r.json();
            setVentures((prev) => prev.map((v) => (v.id === ventureId ? restored : v)));
          },
        });
      } else {
        toast.show('Failed to set project lead');
      }
    },
    [toast, undo, ventures]
  );

  // When defaultCollapsed, start with all projects collapsed (once on initial load)
  const hasInitializedCollapsedRef = useRef(false);
  useEffect(() => {
    if (defaultCollapsed && !loading && timelineVentures.length > 0 && !hasInitializedCollapsedRef.current) {
      hasInitializedCollapsedRef.current = true;
      setCollapsedProjectIds(new Set(timelineVentures.map((v) => v.id)));
    }
  }, [defaultCollapsed, loading, timelineVentures]);

  const PHASE_PILL_COLORS: Record<string, string> = {
    explore: 'bg-[#80E3D1] text-white',
    shape: 'bg-[#9F6AE2] text-white',
    build: 'bg-[#4A7AFF] text-white',
    spin_out: 'bg-[#FFA166] text-white',
    support: 'bg-cyan-500/90 text-white',
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

  const KANBAN_PHASE_COLUMNS = [
    { id: 'explore', label: 'Explore', phase: 'explore' as const, columnClass: 'border-2 border-[#80E3D1] bg-[#80E3D1]/20', titleClass: 'text-[#0d9488]' },
    { id: 'shape', label: 'Concept', phase: 'shape' as const, columnClass: 'border-2 border-[#9F6AE2] bg-[#9F6AE2]/20', titleClass: 'text-[#7c3aed]' },
    { id: 'build', label: 'Build', phase: 'build' as const, columnClass: 'border-2 border-[#4A7AFF] bg-[#4A7AFF]/20', titleClass: 'text-[#2563eb]' },
    { id: 'spin_out', label: 'Spin out', phase: 'spin_out' as const, columnClass: 'border-2 border-[#FFA166] bg-[#FFA166]/20', titleClass: 'text-[#ea580c]' },
    { id: 'pause', label: 'Paused', phase: 'pause' as const, columnClass: 'border-2 border-dashed border-zinc-300 bg-zinc-100/80', titleClass: 'text-zinc-600' },
  ] as const;

  const getCurrentPhaseTypeForKanban = (venturePhases: VenturePhase[]) => {
    const phaseObj = getCurrentPhaseForVenture(venturePhases);
    if (!phaseObj) return null;
    if (phaseObj.phase === 'support') return null;
    return phaseObj.phase === 'pause' ? 'pause' : phaseObj.phase;
  };

  const ventureCurrentPhase = new Map<number, (typeof KANBAN_PHASE_COLUMNS)[number]['phase']>();
  for (const v of timelineVentures) {
    const vPhases = phases.filter((p) => p.venture_id === v.id);
    const phaseType = getCurrentPhaseTypeForKanban(vPhases);
    if (phaseType != null) ventureCurrentPhase.set(v.id, phaseType);
  }

  const getVenturesByPhase = (phase: (typeof KANBAN_PHASE_COLUMNS)[number]['phase']) => {
    return timelineVentures.filter((v) => ventureCurrentPhase.get(v.id) === phase);
  };
  const localDateRange = getDateRange(phases, milestones);
  const startDate = useSyncedAxis ? sync!.startDate : localDateRange.start;
  const endDate = useSyncedAxis ? sync!.endDate : localDateRange.end;
  const totalDays = useSyncedAxis
    ? sync!.totalDays
    : (Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) || 90);
  const baseColumnWidth = getColumnWidth(zoom);
  const baseGridWidth = getGridTotalWidth(zoom, startDate, endDate);
  const columnWidth = useSyncedAxis ? sync!.columnWidth : baseColumnWidth * zoomScale;
  const gridTotalWidth = useSyncedAxis ? sync!.gridTotalWidth : baseGridWidth * zoomScale;

  const ZOOM_SCALE_MIN = 0.5;
  const ZOOM_SCALE_MAX = 2.5;
  const ZOOM_SENSITIVITY = 0.0015;
  const localHandleWheelZoom = useCallback(
    (e: React.WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      const delta = -e.deltaY * ZOOM_SENSITIVITY;
      if (delta !== 0) {
        e.preventDefault();
        setLocalZoomScale((s) => Math.max(ZOOM_SCALE_MIN, Math.min(ZOOM_SCALE_MAX, s + delta)));
      }
    },
    []
  );
  const handleWheelZoom = useSyncedAxis ? sync!.onWheelZoom : localHandleWheelZoom;

  // Snap scroll to today on initial load (use sync context when available)
  useEffect(() => {
    if (loading || !scrollContainerRef.current || timelineVentures.length === 0 || hasScrolledToTodayRef.current) return;
    const el = scrollContainerRef.current;
    let offset: number;
    if (useSyncedAxis && sync?.scrollToTodayOffset != null) {
      offset = sync.scrollToTodayOffset;
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startTime = startDate.getTime();
      const endTime = endDate.getTime();
      const totalMs = endTime - startTime;
      offset = totalMs <= 0 ? 192 : 192 + Math.max(0, Math.min(1, (today.getTime() - startTime) / totalMs)) * gridTotalWidth;
    }
    el.scrollLeft = offset;
    hasScrolledToTodayRef.current = true;
  }, [loading, timelineVentures.length, startDate, endDate, gridTotalWidth, sync, useSyncedAxis]);

  const handleScroll = useCallback(() => {
    if (sync?.axisHydrated && scrollContainerRef.current) {
      sync.reportScroll('timeline', scrollContainerRef.current.scrollLeft);
    }
  }, [sync]);

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
      onRefresh?.();
      if (prev) {
        const inv: { fte_percentage?: number; phase_id?: number | null } = {};
        if (updates.fte_percentage !== undefined) inv.fte_percentage = prev.fte_percentage;
        if (updates.phase_id !== undefined) inv.phase_id = prev.phase_id ?? null;
        if (Object.keys(inv).length > 0) {
          undo?.pushUndo({
            label: 'Edit allocation',
            undo: async () => {
              const r = await fetch(`/api/allocations/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(inv),
              });
              if (!r.ok) throw new Error('Undo failed');
              const restored = await r.json();
              setAllocations((a) => a.map((x) => (x.id === id ? restored : x)));
            },
          });
        }
      }
    } else if (prev) {
      setAllocations((a) => a.map((x) => (x.id === id ? prev : x)));
    }
  };

  const removeAllocation = async (id: number) => {
    const prev = allocations.find((a) => a.id === id);
    if (!prev) return;
    setAllocations((a) => a.filter((x) => x.id !== id));
    const res = await fetch(`/api/allocations/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      await fetchData();
      onRefresh?.();
      return;
    }
    onRefresh?.();
    undo?.pushUndo({
      label: 'Remove allocation',
      undo: async () => {
        const r = await fetch('/api/allocations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employee_id: prev.employee_id,
            venture_id: prev.venture_id,
            phase_id: prev.phase_id ?? undefined,
            fte_percentage: prev.fte_percentage,
            week_start: prev.week_start,
            notes: prev.notes,
          }),
        });
        if (!r.ok) throw new Error('Undo failed');
        const created = await r.json();
        setAllocations((a) => [...a, created]);
        onRefresh?.();
      },
    });
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
      if (prev) {
        undo?.pushUndo({
          label: 'Edit activity dates',
          undo: async () => {
            const r = await fetch(`/api/phase-activities/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ start_date: prev.start_date, end_date: prev.end_date }),
            });
            if (!r.ok) throw new Error('Undo failed');
            const restored = await r.json();
            setPhaseActivities((pa) => pa.map((x) => (x.id === id ? restored : x)));
          },
        });
      }
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
      setExpandedPhaseIds((prev) => new Set([...prev, venturePhaseId]));
      const ventureId = phases.find((p) => p.id === venturePhaseId)?.venture_id;
      if (ventureId != null) {
        setCollapsedProjectIds((prev) => {
          const next = new Set(prev);
          next.delete(ventureId);
          return next;
        });
      }
    } else {
      await fetchData();
    }
  };

  const PHASE_ORDER = ['explore', 'shape', 'build', 'spin_out', 'support'] as const;

  const sortVenturePhasesByDate = useCallback(
    (venturePhases: VenturePhase[]) =>
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
      if (prev) {
        undo?.pushUndo({
          label: 'Edit phase dates',
          undo: async () => {
            const r = await fetch(`/api/venture-phases/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ start_date: prev.start_date, end_date: prev.end_date }),
            });
            if (!r.ok) throw new Error('Undo failed');
            const restored = await r.json();
            setPhases((p) => p.map((x) => (x.id === id ? restored : x)));
          },
        });
      }
    } else if (prev) {
      setPhases((p) => p.map((x) => (x.id === id ? prev : x)));
    }
  };

  const togglePhaseCapacityHidden = async (phaseId: number, hiddenFromCapacity: boolean) => {
    const prev = phases.find((p) => p.id === phaseId);
    if (!prev) return;
    setPhases((p) =>
      p.map((x) => (x.id === phaseId ? { ...x, hidden_from_capacity: hiddenFromCapacity } : x))
    );
    const res = await fetch(`/api/venture-phases/${phaseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hidden_from_capacity: hiddenFromCapacity }),
    });
    if (res.ok) {
      const updated = await res.json();
      setPhases((p) => p.map((x) => (x.id === phaseId ? updated : x)));
      onRefresh?.();
      const prevHidden = prev.hidden_from_capacity ?? false;
      undo?.pushUndo({
        label: hiddenFromCapacity ? 'Hide phase from capacity' : 'Show phase in capacity',
        undo: async () => {
          const r = await fetch(`/api/venture-phases/${phaseId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hidden_from_capacity: prevHidden }),
          });
          if (!r.ok) throw new Error('Undo failed');
          const restored = await r.json();
          setPhases((p) => p.map((x) => (x.id === phaseId ? restored : x)));
          onRefresh?.();
        },
      });
    } else {
      setPhases((p) => p.map((x) => (x.id === phaseId ? prev : x)));
      toast.show('Failed to update phase visibility');
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
    shape: 'Concept',
    build: 'Build',
    spin_out: 'Spin out',
    support: 'Support',
  };

  const selectedVenture = selectedVentureId
    ? ventures.find((v) => v.id === selectedVentureId)
    : null;

  const selectedVenturePanelPhases = useMemo(() => {
    if (!selectedVentureId) return [];
    return phases.filter((p) => p.venture_id === selectedVentureId);
  }, [phases, selectedVentureId]);

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

  const handleMilestoneUpdate = useCallback(
    async (id: number, targetDate: string) => {
      const prevM = milestones.find((m) => m.id === id);
      const res = await fetch(`/api/hiring-milestones/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_date: targetDate }),
      });
      if (res.ok) {
        const updated = await res.json();
        handleMilestoneSave(updated);
        if (prevM) {
          undo?.pushUndo({
            label: 'Milestone date',
            undo: async () => {
              const r = await fetch(`/api/hiring-milestones/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_date: prevM.target_date }),
              });
              if (!r.ok) throw new Error('Undo failed');
              const restored = await r.json();
              setMilestones((prev) =>
                prev.map((m) => (m.id === id ? restored : m)).sort((a, b) => a.target_date.localeCompare(b.target_date))
              );
            },
          });
        }
      }
    },
    [handleMilestoneSave, milestones, undo]
  );

  const handleAnalyzeImpact = useCallback(() => {
    setImpactInitialMessage('Analyze the current portfolio for delays, risks, overload, and recommendations.');
    setImpactPanelOpen(true);
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded bg-zinc-200" />
        <div className="h-96 animate-pulse rounded-xl border border-zinc-200 bg-zinc-50" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          {showSectionHeader && (
            <h2 className="text-xl font-semibold tracking-tight text-zinc-900">Active Ventures</h2>
          )}
          <div className={`flex flex-wrap items-center gap-2 ${showSectionHeader ? 'mt-0.5' : ''}`}>
            <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('timeline')}
                title="Drag phases to resize · Drag milestones to move · Ctrl+scroll to zoom"
                className={`rounded-md px-2.5 py-1 text-sm font-medium transition-colors ${
                  viewMode === 'timeline' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Timeline
              </button>
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`rounded-md px-2.5 py-1 text-sm font-medium transition-colors ${
                  viewMode === 'kanban' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Kanban
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {viewMode === 'timeline' && zoomScale !== 1 && (
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
            onClick={handleAnalyzeImpact}
            className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Analyze impact
          </button>
          {hiddenVentures.length > 0 && (
            <div className="relative">
              <button
                ref={showHiddenButtonRef}
                type="button"
                onClick={() => setShowHiddenDropdown((o) => !o)}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                Show hidden ({hiddenVentures.length})
              </button>
              {showHiddenDropdown &&
                typeof document !== 'undefined' &&
                createPortal(
                  <HiddenVenturesDropdown
                    ventures={hiddenVentures}
                    unhidingId={unhidingId}
                    onUnhide={handleUnhide}
                    onClose={() => setShowHiddenDropdown(false)}
                    anchorRef={showHiddenButtonRef}
                  />,
                  document.body
                )}
            </div>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2"
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
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-200 py-12">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <p className="text-base font-medium text-zinc-700">No projects on timeline</p>
          <p className="mt-1 text-sm text-zinc-500">Add a project to visualize phases and capacity.</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Add project
          </button>
        </div>
      ) : viewMode === 'kanban' ? (
        <div className="flex w-full gap-2 pb-4">
            {KANBAN_PHASE_COLUMNS.map((col) => {
              const phaseVentures = getVenturesByPhase(col.phase);
              const hasVentures = phaseVentures.length > 0;
              return (
                <div
                  key={col.id}
                  className={`min-w-0 flex-1 rounded-lg p-2 ring-1 ring-zinc-900/5 transition-all ${col.columnClass} ${hasVentures ? 'opacity-100' : 'opacity-40'}`}
                >
                  <h3 className={`mb-1 text-xs font-medium ${col.titleClass}`}>
                    {col.label} ({phaseVentures.length})
                  </h3>
                  <div className="space-y-1.5">
                    {phaseVentures.map((v) => (
                      <ActiveVentureKanbanCard
                        key={v.id}
                        venture={v}
                        allocations={allocations}
                        employees={employees}
                        currentPhase={col.phase}
                        onSelect={setSelectedVentureId}
                        onHide={handleHideFromTimeline}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
      ) : (
        <div className="flex max-h-[calc(100vh-10rem)] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm ring-1 ring-zinc-900/5">
          <div
            ref={(el) => {
              (scrollContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
              sync?.registerTimelineRef(el);
            }}
            className="relative flex flex-1 flex-col overflow-auto overscroll-contain"
            onWheel={handleWheelZoom}
            onScroll={handleScroll}
          >
            <div className="relative flex min-w-max flex-col pt-1">
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
            <DndContext sensors={timelineSensors} onDragEnd={handleDragEnd}>
              <SortableContext items={timelineVentures.map((v) => v.id)} strategy={verticalListSortingStrategy}>
            {timelineVentures.map((v, ventureIndex) => {
              const isCollapsed = collapsedProjectIds.has(v.id);
              const isPlanned = v.status === 'planned' || v.status === 'exploration_staging';
              const venturePhases = phases.filter((p) => p.venture_id === v.id);
              const currentPhase = getCurrentPhaseForVenture(venturePhases);
              const phaseTypes = ['explore', 'shape', 'build', 'spin_out', 'support', 'pause'] as const;
              const phaseLabels: Record<string, string> = {
                explore: 'Explore',
                shape: 'Concept',
                build: 'Build',
                spin_out: 'Spin out',
                support: 'Support',
                pause: 'Paused',
              };

              return (
                <SortableVentureRow key={v.id} venture={v}>
                {({ setNodeRef, style, attributes, listeners }) => (
                <div
                  ref={setNodeRef}
                  style={style}
                  className="flex flex-col"
                >
                  {ventureIndex > 0 && (
                    <div className="flex min-w-max border-t border-zinc-200 pt-1">
                      <div className="sticky left-0 z-20 w-48 shrink-0 border-r border-zinc-200 bg-zinc-50" />
                      <div className="shrink-0 bg-zinc-50" style={{ width: gridTotalWidth }} />
                    </div>
                  )}
                  <div className="flex min-w-max">
                    <div className={`group sticky left-0 z-20 w-48 shrink-0 border-r border-zinc-200 ${isPlanned ? 'bg-zinc-200' : 'bg-zinc-50'}`}>
                      {isCollapsed ? (
                        <div className="flex h-9 min-w-0 flex-col justify-between border-b border-zinc-100 px-1 py-0.5">
                          <div className="flex min-w-0 items-center gap-x-1">
                            <button
                              type="button"
                              {...attributes}
                              {...listeners}
                              className="shrink-0 cursor-grab touch-none rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 active:cursor-grabbing"
                              aria-label="Drag to reorder"
                              title="Drag to reorder"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="9" cy="5" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="19" r="1" />
                                <circle cx="15" cy="5" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="19" r="1" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleProjectCollapse(v.id);
                              }}
                              className="shrink-0 rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
                              aria-label="Expand project"
                              title="Expand"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="-rotate-90"><polyline points="6 9 12 15 18 9" /></svg>
                            </button>
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900">{v.name}{isPlanned && <span className="ml-1 text-xs text-zinc-500">(planned)</span>}</span>
                            <div className="flex shrink-0 items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
                              {(() => {
                                const tag = getVentureTag(v);
                                const dotClass = tag === 'greenlit' ? 'bg-emerald-500' : tag === 'battling' ? 'bg-amber-500' : tag === 'paused' ? 'bg-zinc-400' : '';
                                return (
                                  <>
                                    {tag && <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${dotClass}`} title={tag} aria-label={tag} />}
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); setTagPickerAnchorRect(rect); setTagPickerVentureId((prev) => (prev === v.id ? null : v.id)); }}
                                      className="shrink-0 rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 opacity-0 group-hover:opacity-100"
                                      title="Set tag"
                                      aria-label="Set tag"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
                                    </button>
                                  </>
                                );
                              })()}
                            </div>
                            <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100" onPointerDown={(e) => e.stopPropagation()}>
                              <button onClick={() => setSelectedVentureId(v.id)} className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700" aria-label="Edit project" title="Edit project">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleHideFromTimeline(v.id); }}
                                className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
                                aria-label="Hide from timeline"
                                title="Hide from timeline"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                  <circle cx="12" cy="12" r="3" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex h-6 min-w-0 items-center gap-x-1 gap-y-1 border-b border-zinc-100 px-1.5">
                            <button
                              type="button"
                              {...attributes}
                              {...listeners}
                              className="shrink-0 cursor-grab touch-none rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 active:cursor-grabbing"
                              aria-label="Drag to reorder"
                              title="Drag to reorder"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="9" cy="5" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="19" r="1" />
                                <circle cx="15" cy="5" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="19" r="1" />
                              </svg>
                            </button>
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
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-900" title={`${v.name}${isPlanned ? ' (planned)' : ''}`}>{v.name}{isPlanned && <span className="ml-1 shrink-0 text-xs font-normal text-zinc-500">(planned)</span>}</span>
                            <div className="flex shrink-0 items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
                              {(() => {
                                const tag = getVentureTag(v);
                                const dotClass = tag === 'greenlit' ? 'bg-emerald-500' : tag === 'battling' ? 'bg-amber-500' : tag === 'paused' ? 'bg-zinc-400' : '';
                                return (
                                  <>
                                    {tag && <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${dotClass}`} title={tag} aria-label={tag} />}
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); setTagPickerAnchorRect(rect); setTagPickerVentureId((prev) => (prev === v.id ? null : v.id)); }}
                                      className="shrink-0 rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 opacity-0 group-hover:opacity-100"
                                      title="Set tag"
                                      aria-label="Set tag"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
                                    </button>
                                  </>
                                );
                              })()}
                            </div>
                            <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100" onPointerDown={(e) => e.stopPropagation()}>
                              <button onClick={() => setSelectedVentureId(v.id)} className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700" aria-label="Edit project" title="Edit project">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleHideFromTimeline(v.id); }}
                                className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
                                aria-label="Hide from timeline"
                                title="Hide from timeline"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                  <circle cx="12" cy="12" r="3" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          <div className="h-3 border-b border-zinc-100" aria-hidden />
                          {phaseTypes.map((type) => {
                            const phase = venturePhases.find((p) => p.phase === type);
                            if (!phase) return null;
                            const isExpanded = expandedPhaseIds.has(phase.id);
                            const activities = isExpanded
                              ? [...phaseActivities.filter((a) => a.venture_phase_id === phase.id)].sort(
                                  (a, b) => a.sort_order - b.sort_order
                                )
                              : [];
                            return (
                              <div key={phase.id}>
                                {activities.map((act) => (
                                  <div key={act.id} className="flex h-6 items-center border-b border-zinc-100 pl-4 pr-1.5">
                                    <span className="truncate text-[11px] text-zinc-600">{act.name}</span>
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                    <div className={`timeline-grid relative shrink-0 pb-1 ${isPlanned ? 'bg-zinc-200' : ''}`} data-timeline-grid style={{ width: gridTotalWidth }}>
                      {(() => {
                        const months = getMonthsBetween(startDate, endDate);
                        return (
                          <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
                            {months.slice(1).map((m, i) => (
                              <div
                                key={m.toISOString().slice(0, 7)}
                                className="absolute top-0 bottom-0 w-px bg-zinc-100"
                                style={{ left: `${(i + 1) * columnWidth}px` }}
                              />
                            ))}
                          </div>
                        );
                      })()}
                      <ProjectRow
                        key={v.id}
                        venture={v}
                        isPlanned={isPlanned}
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
                        showPeople={true}
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
                        onRefresh={refreshTimelineAndPeople}
                        onOpenPanel={() => setSelectedVentureId(v.id)}
                        onPhaseRowClick={handlePhaseRowClick}
                        onMilestoneClick={(m) => setMilestoneModal({ open: true, mode: 'edit', ventureId: v.id, milestone: m })}
                        onMilestoneUpdate={handleMilestoneUpdate}
                        onSetProjectLead={handleSetProjectLead}
                      />
                    </div>
                  </div>
                </div>
                )}
                </SortableVentureRow>
              );
            })}
              </SortableContext>
            </DndContext>
            {(() => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const startTime = startDate.getTime();
              const endTime = endDate.getTime();
              const totalMs = endTime - startTime;
              if (totalMs <= 0) return null;
              const todayOffsetPct = Math.max(0, Math.min(1, (today.getTime() - startTime) / totalMs));
              const sidebarWidth = 192;
              const leftPx = sidebarWidth + todayOffsetPct * gridTotalWidth;
              return (
                <div
                  className="pointer-events-none absolute left-0 top-0 z-10 flex min-w-0 flex-col"
                  style={{ left: leftPx, width: 0, height: '100%' }}
                  aria-hidden
                >
                  <span
                    className="absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-semibold text-amber-950"
                    title="Today"
                  >
                    Today
                  </span>
                  <div
                    className="absolute left-0 top-6 bottom-0 w-0 border-l-2 border-amber-500"
                    title="Today"
                  />
                </div>
              );
            })()}
          </div>
          {selectedVenture && (
            <>
              <div
                className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
                onClick={() => setSelectedVentureId(null)}
                aria-hidden
              />
              <div
                className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-zinc-200 bg-white shadow-2xl animate-slide-in-right"
                role="dialog"
                aria-labelledby="edit-project-title"
              >
                <ProjectPanel
                venture={selectedVenture}
                phases={selectedVenturePanelPhases}
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
                  onRefresh?.();
                }}
                onPhaseCapacityHiddenChange={togglePhaseCapacityHidden}
                onRemove={async () => {
                  const id = selectedVenture.id;
                  const snapAllocs = allocations.filter((a) => a.venture_id === id);
                  const prevVis = selectedVenture.timeline_visible;
                  const prevHidden = selectedVenture.hidden_from_venture_tracker;
                  setVentures((prev) =>
                    prev.map((v) => (v.id === id ? { ...v, timeline_visible: false } : v))
                  );
                  setSelectedVentureId(null);
                  const patchRes = await fetch(`/api/ventures/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ timeline_visible: false }),
                  });
                  if (!patchRes.ok) {
                    setVentures((prev) =>
                      prev.map((v) => (v.id === id ? { ...v, timeline_visible: true } : v))
                    );
                    toast.show('Failed to remove from timeline');
                    return;
                  }
                  const delRes = await fetch(`/api/allocations?ventureId=${id}`, { method: 'DELETE' });
                  if (!delRes.ok) {
                    await fetch(`/api/ventures/${id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ timeline_visible: true }),
                    });
                    setVentures((prev) =>
                      prev.map((v) => (v.id === id ? { ...v, timeline_visible: true } : v))
                    );
                    toast.show('Failed to clear allocations');
                    return;
                  }
                  setAllocations((prev) => prev.filter((a) => a.venture_id !== id));
                  toast.show('Removed from timeline');
                  onRefresh?.();
                  undo?.pushUndo({
                    label: 'Remove from timeline',
                    undo: async () => {
                      const pr = await fetch(`/api/ventures/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          timeline_visible: prevVis,
                          hidden_from_venture_tracker: prevHidden,
                        }),
                      });
                      if (!pr.ok) throw new Error('Undo failed');
                      const vData = await pr.json();
                      setVentures((prev) => prev.map((v) => (v.id === id ? vData : v)));
                      for (const a of snapAllocs) {
                        const ar = await fetch('/api/allocations', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            employee_id: a.employee_id,
                            venture_id: a.venture_id,
                            phase_id: a.phase_id ?? undefined,
                            fte_percentage: a.fte_percentage,
                            week_start: a.week_start,
                            notes: a.notes,
                          }),
                        });
                        if (!ar.ok) throw new Error('Undo failed');
                        const created = await ar.json();
                        setAllocations((prev) => [...prev, created]);
                      }
                      await fetchData();
                      onRefresh?.();
                    },
                  });
                }}
                onDelete={async () => {
                  const id = selectedVenture.id;
                  const res = await fetch(`/api/ventures/${id}`, { method: 'DELETE' });
                  const data = await res.json().catch(() => ({}));
                  if (res.ok) {
                    setVentures((prev) => prev.filter((v) => v.id !== id));
                    setPhases((prev) => prev.filter((p) => p.venture_id !== id));
                    setMilestones((prev) => prev.filter((m) => m.venture_id !== id));
                    setAllocations((prev) => prev.filter((a) => a.venture_id !== id));
                    setSelectedVentureId(null);
                    onVentureDeleted?.();
                    toast.show('Project deleted');
                    onRefresh?.();
                    undo?.pushUndo({
                      label: 'Delete project',
                      undo: async () => {
                        const r = await fetch(`/api/ventures/${id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ deleted_at: null }),
                        });
                        if (!r.ok) throw new Error('Undo failed');
                        await fetchData();
                        onRefresh?.();
                      },
                    });
                  } else {
                    toast.show(data.error || 'Failed to delete project');
                  }
                }}
                onGreenlight={(selectedVenture.status === 'planned' || selectedVenture.status === 'exploration_staging') ? async () => {
                  await handleGreenlight(selectedVenture.id);
                  setSelectedVentureId(null);
                } : undefined}
                onMoveToSupport={selectedVenture.status === 'active' ? async () => {
                  const id = selectedVenture.id;
                  const prevStatus = selectedVenture.status;
                  const res = await fetch(`/api/ventures/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'support' }),
                  });
                  if (res.ok) {
                    const data = await res.json();
                    setVentures((prev) => prev.map((v) => (v.id === id ? data : v)));
                    setSelectedVentureId(null);
                    onVentureDeleted?.(); // triggers page refresh so Support Ventures section updates
                    toast.show('Tagged as Support');
                    onRefresh?.();
                    undo?.pushUndo({
                      label: 'Move to Support',
                      undo: async () => {
                        const r = await fetch(`/api/ventures/${id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ status: prevStatus }),
                        });
                        if (!r.ok) throw new Error('Undo failed');
                        const restored = await r.json();
                        setVentures((prev) => prev.map((v) => (v.id === id ? restored : v)));
                        onVentureDeleted?.();
                        await fetchData();
                        onRefresh?.();
                      },
                    });
                  } else {
                    toast.show('Failed to tag as Support');
                  }
                } : undefined}
              />
              </div>
            </>
          )}
        </div>
        </div>
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
            onClick={() => setResumePausePhaseId(null)}
          >
            <div
              className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-xl"
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
          await refreshTimelineAndPeople();
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
      {tagPickerVentureId != null &&
        tagPickerAnchorRect != null &&
        typeof document !== 'undefined' &&
        (() => {
          const v = ventures.find((x) => x.id === tagPickerVentureId);
          if (!v) return null;
          return createPortal(
            <TagPickerDropdown
              anchorRect={tagPickerAnchorRect}
              ventureId={tagPickerVentureId}
              currentTag={getVentureTag(v)}
              onSelect={handleSetVentureTag}
              onClose={() => {
                setTagPickerVentureId(null);
                setTagPickerAnchorRect(null);
              }}
            />,
            document.body
          );
        })()}
    </div>
  );
}
