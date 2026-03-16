'use client';

import type {
  Venture,
  VenturePhase,
  PhaseActivity,
  HiringMilestone,
  Allocation,
  PhaseType,
} from '@/types';
import { PhaseBar } from './PhaseBar';
import { ActivityBar } from './ActivityBar';
import { MilestoneMarker } from './MilestoneMarker';
import { PhasePeopleCards } from './PhasePeopleCards';
import { PHASE_COLORS } from '@/lib/phaseColors';

const PHASE_TYPES = ['explore', 'shape', 'build', 'spin_out'] as const;
const PHASE_LABELS: Record<string, string> = {
  explore: 'Explore',
  shape: 'Concept',
  build: 'Build',
  spin_out: 'Spin out',
  pause: 'Paused',
};
const PHASE_ABBREV: Record<string, string> = {
  explore: 'Exp',
  shape: 'C',
  build: 'Bu',
  spin_out: 'Spin',
  pause: 'Pau',
};

function getFirstName(name: string): string {
  const first = name.trim().split(/\s+/)[0];
  return first || name || '?';
}
function getMilestoneLabel(m: HiringMilestone): string {
  if (m.label && m.label.trim()) return m.label.trim();
  const roleLabels: Record<string, string> = {
    ceo: 'Hire CEO',
    founding_engineer: 'Hire Founding engineer',
    other: 'Milestone',
  };
  return roleLabels[m.role_type] || m.role_type || 'Milestone';
}

interface ProjectRowProps {
  venture: Venture;
  isPlanned?: boolean;
  phases: VenturePhase[];
  phaseActivities: PhaseActivity[];
  milestones: HiringMilestone[];
  allocations: Allocation[];
  employees: { id: number; name: string; scenario_tag?: string | null }[];
  startDate: Date;
  endDate: Date;
  totalDays: number;
  gridWidth: number;
  showPeople: boolean;
  collapsed?: boolean;
  currentPhase?: VenturePhase | null;
  zoom?: 'quarter' | 'month' | 'week';
  expandedPhaseIds: Set<number>;
  onExpandPhase: (phaseId: number) => void;
  onPhaseUpdate: (id: number, updates: { start_date: string; end_date: string }) => void;
  onActivityUpdate?: (id: number, updates: { start_date: string; end_date: string }) => void;
  onActivityDelete?: (id: number) => void;
  onActivityAdd?: (
    venturePhaseId: number,
    name: string,
    startDate: string,
    endDate: string
  ) => void;
  onAddPause?: (afterPhaseId: number) => void;
  onPauseResume?: (phaseId: number) => void;
  onAllocationUpdate?: (id: number, updates: { fte_percentage?: number; phase_id?: number }) => void;
  onAllocationRemove?: (id: number) => void;
  onRefresh?: () => void;
  onOpenPanel?: () => void;
  onPhaseRowClick?: (ventureId: number, e: React.MouseEvent) => void;
  onMilestoneClick?: (milestone: HiringMilestone) => void;
  onMilestoneUpdate?: (id: number, targetDate: string) => void;
  onSetProjectLead?: (ventureId: number, employeeId: number) => void;
}

export function ProjectRow({
  venture,
  isPlanned = false,
  phases,
  phaseActivities,
  milestones,
  allocations,
  employees,
  startDate,
  endDate,
  totalDays,
  gridWidth,
  showPeople,
  collapsed = false,
  currentPhase: _currentPhase,
  zoom: _zoom = 'month',
  expandedPhaseIds,
  onExpandPhase,
  onPhaseUpdate,
  onActivityUpdate,
  onActivityDelete,
  onActivityAdd,
  onAddPause,
  onPauseResume,
  onAllocationUpdate,
  onAllocationRemove,
  onRefresh,
  onOpenPanel: _onOpenPanel,
  onPhaseRowClick,
  onMilestoneClick,
  onMilestoneUpdate,
  onSetProjectLead,
}: ProjectRowProps) {
  const venturePhases = phases.filter((p) => p.venture_id === venture.id && p.phase !== 'support');
  const hasPause = venturePhases.some((p) => p.phase === 'pause');
  const sortedPhases = hasPause
    ? [...venturePhases].sort(
        (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      )
    : PHASE_TYPES.map((type) => venturePhases.find((p) => p.phase === type)).filter(
        (p): p is VenturePhase => p != null
      );

  if (collapsed) {
    return (
      <div>
        <div className="relative flex h-10 flex-col justify-center">
          {sortedPhases.length > 0 ? (
            <>
              <div className="relative mb-0.5 flex h-3 items-end">
                {sortedPhases.map((phase) => {
                  const leftPct = dateToOffset(phase.start_date, startDate, totalDays);
                  const rightPct = dateToOffset(phase.end_date, startDate, totalDays);
                  const widthPct = Math.max(rightPct - leftPct, 1);
                  const phaseLabel = PHASE_LABELS[phase.phase] || phase.phase;
                  return (
                    <div
                      key={phase.id}
                      className="absolute flex items-center justify-start"
                      style={{
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                      }}
                    >
                      <span
                        className="truncate text-[8px] font-medium uppercase tracking-wide text-zinc-400"
                        title={phaseLabel}
                      >
                        {phaseLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="relative flex h-6 items-center">
                {sortedPhases.map((phase) => {
                  const leftPct = dateToOffset(phase.start_date, startDate, totalDays);
                  const rightPct = dateToOffset(phase.end_date, startDate, totalDays);
                  const widthPct = Math.max(rightPct - leftPct, 1);
                  const phaseColor =
                    isPlanned
                      ? 'border-2 border-dashed border-zinc-300 bg-zinc-200/70'
                      : phase.phase === 'pause'
                        ? 'bg-zinc-200/90 border border-dashed border-zinc-300'
                        : PHASE_COLORS[phase.phase] || 'bg-zinc-400/80';
                  const isPause = phase.phase === 'pause';
                  const phaseAllocations = allocations.filter((a) => a.phase_id === phase.id);
                  const assignedIds = [...new Set(phaseAllocations.map((a) => a.employee_id))];
                  const assignedEmployees = assignedIds
                    .map((id) => employees.find((e) => e.id === id))
                    .filter((e): e is { id: number; name: string } => e != null)
                    .sort((a, b) => {
                      if (venture.primary_contact_id != null && a.id === venture.primary_contact_id) return -1;
                      if (venture.primary_contact_id != null && b.id === venture.primary_contact_id) return 1;
                      return 0;
                    });
                  const getAvatarClass = (isLead: boolean) =>
                    isLead
                      ? isPause
                        ? 'bg-zinc-100 text-zinc-800 ring-1 ring-zinc-300'
                        : 'bg-white text-zinc-800 ring-1 ring-zinc-900/10'
                      : isPause
                        ? 'bg-zinc-100/60 text-zinc-800 ring-1 ring-zinc-300'
                        : 'bg-white/60 text-zinc-800 ring-1 ring-zinc-900/10';

                  return (
                    <div
                      key={phase.id}
                      className={`absolute top-1/2 h-6 min-w-[48px] -translate-y-1/2 rounded-none px-2 first:rounded-l last:rounded-r ${phaseColor}`}
                      style={{
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                      }}
                    >
                      <div className="flex h-full min-w-0 items-center justify-start gap-2 overflow-hidden">
                        {assignedEmployees.length > 0 && (
                          <div className="flex shrink-0 items-center gap-1.5">
                            {assignedEmployees.map((emp, idx) => {
                              const isLead = venture.primary_contact_id != null ? emp.id === venture.primary_contact_id : idx === 0;
                              return (
                                <div
                                  key={emp.id}
                                  className={`flex h-4 min-w-4 max-w-12 items-center justify-center gap-0.5 rounded-full px-1 ${getAvatarClass(isLead)}`}
                                  title={emp.name}
                                  onContextMenu={
                                    onSetProjectLead
                                      ? (e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          onSetProjectLead(venture.id, emp.id);
                                        }
                                      : undefined
                                  }
                                >
                                  <span className="truncate text-[9px] font-semibold">{getFirstName(emp.name)}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="absolute top-1/2 left-1/2 h-1.5 w-1/2 -translate-x-1/2 -translate-y-1/2 rounded bg-zinc-200/60" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="h-4" aria-hidden />
      <div className="relative flex h-7 items-center group">
        <div
          className="absolute inset-0 cursor-pointer"
          onClick={(e) => {
            if (onPhaseRowClick && !(e.target as HTMLElement).closest('[data-phase-bar], [data-milestone-marker]')) {
              onPhaseRowClick(venture.id, e);
            }
          }}
        >
          {onPhaseRowClick && (
            <div
              className="absolute left-0 top-0 bottom-0 z-10 w-8 cursor-pointer rounded-r border-r border-dashed border-zinc-300/60 hover:bg-zinc-100/80"
              title="Add milestone"
              aria-label="Add milestone"
            >
              <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100">
                +
              </span>
            </div>
          )}
          {sortedPhases.map((phase) => {
            const phaseAllocs = allocations.filter((a) => a.phase_id === phase.id);
            const assignedPeople = [
              ...new Map(
                phaseAllocs
                  .map((a) => employees.find((e) => e.id === a.employee_id))
                  .filter((e): e is { id: number; name: string } => e != null)
                  .map((e) => [e.id, e])
              ).values(),
            ];
            return (
              <PhaseBar
                key={phase.id}
                phase={phase}
                isPlanned={isPlanned}
                startDate={startDate}
                endDate={endDate}
                totalDays={totalDays}
                gridWidth={gridWidth}
                onUpdate={onPhaseUpdate}
                onExpandClick={() => onExpandPhase(phase.id)}
                onPauseResume={onPauseResume}
                assignedPeople={assignedPeople}
                primaryContactId={venture.primary_contact_id ?? undefined}
                ventureId={venture.id}
                onSetProjectLead={onSetProjectLead}
              />
            );
          })}
        </div>
        {(() => {
          const rendered = new Set<number>();
          return sortedPhases.flatMap((phase) => {
            if (phase.phase === 'pause') return [];
            return milestones
              .filter((m) => {
                if (rendered.has(m.id)) return false;
                const d = new Date(m.target_date).getTime();
                const start = new Date(phase.start_date).getTime();
                const end = new Date(phase.end_date).getTime();
                const inPhase = d >= start && d <= end;
                if (inPhase) rendered.add(m.id);
                return inPhase;
              })
              .map((m) => {
                const left = dateToOffset(m.target_date, startDate, totalDays);
                return (
                  <MilestoneMarker
                    key={m.id}
                    date={m.target_date}
                    label={getMilestoneLabel(m)}
                    left={left}
                    startDate={startDate}
                    totalDays={totalDays}
                    gridWidth={gridWidth}
                    onClick={onMilestoneClick ? () => onMilestoneClick(m) : undefined}
                    onUpdate={onMilestoneUpdate ? (targetDate) => onMilestoneUpdate(m.id, targetDate) : undefined}
                  />
                );
              });
          });
        })()}
      </div>
      {sortedPhases
        .filter((phase) => phase.phase !== 'pause')
        .map((phase) => {
        const isExpanded = expandedPhaseIds.has(phase.id);
        const activities =
          onActivityUpdate && onActivityDelete
            ? [...phaseActivities.filter((a) => a.venture_phase_id === phase.id)].sort(
                (a, b) => a.sort_order - b.sort_order
              )
            : [];
        return (
          <div key={phase.id}>
            {isExpanded &&
              onActivityUpdate &&
              onActivityDelete &&
              activities.map((activity) => (
                <div key={activity.id} className="relative flex h-6 items-center">
                  <div className="absolute inset-0 pl-2">
                    <ActivityBar
                      activity={activity}
                      isPlanned={isPlanned}
                      startDate={startDate}
                      endDate={endDate}
                      totalDays={totalDays}
                      gridWidth={gridWidth}
                      onUpdate={onActivityUpdate}
                      onDelete={onActivityDelete}
                    />
                  </div>
                </div>
              ))}
          </div>
        );
      })}
      {showPeople && (
        <div className="relative flex min-h-20 items-start pt-1.5 pb-1.5">
          {sortedPhases
            .filter((phase) => phase.phase !== 'pause')
            .map((phase) => {
            const leftPct = dateToOffset(phase.start_date, startDate, totalDays);
            const rightPct = dateToOffset(phase.end_date, startDate, totalDays);
            const widthPct = Math.max(rightPct - leftPct, 2);
            return (
              <div
                key={phase.id}
                className="absolute flex items-center pl-2"
                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                onClick={(e) => e.stopPropagation()}
              >
                <PhasePeopleCards
                  phase={phase}
                  allocations={allocations.filter((a) => a.phase_id === phase.id)}
                  employees={employees}
                  ventureId={venture.id}
                  leftOffsetPct={0}
                  widthPct={100}
                  onUpdate={onAllocationUpdate}
                  onRemove={onAllocationRemove}
                  onRefresh={onRefresh}
                  onActivityAdd={onActivityAdd}
                  onAddPause={onAddPause}
                  primaryContactId={venture.primary_contact_id ?? undefined}
                  onSetProjectLead={onSetProjectLead}
                />
              </div>
            );
          })}
        </div>
      )}
      <div className="h-6" aria-hidden />
    </div>
  );
}

function dateToOffset(dateStr: string, startDate: Date, totalDays: number): number {
  const startTime = startDate.getTime();
  const dateTime = new Date(dateStr).getTime();
  const totalMs = totalDays * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.min(100, ((dateTime - startTime) / totalMs) * 100));
}
