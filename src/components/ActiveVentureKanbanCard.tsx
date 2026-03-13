'use client';

import type { Venture, Employee, Allocation } from '@/types';
import { TeamMemberBubbles } from './TeamMemberBubbles';

function formatStartDate(dateStr: string): string {
  return new Date(dateStr)
    .toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })
    .replace(/\//g, '.');
}

function getVentureTag(v: Venture): 'greenlit' | 'battling' | 'paused' | null {
  if (v.is_paused === true) return 'paused';
  if (v.is_greenlit === true) return 'greenlit';
  if (v.is_active === true) return 'battling';
  return null;
}

interface ActiveVentureKanbanCardProps {
  venture: Venture;
  allocations: Allocation[];
  employees: Employee[];
  currentPhase?: 'explore' | 'shape' | 'build' | 'spin_out' | 'pause' | null;
  onSelect: (ventureId: number) => void;
  onHide?: (ventureId: number) => void;
}

const PHASE_BORDER_COLORS: Record<string, string> = {
  explore: 'border-l-[#80E3D1]',
  shape: 'border-l-[#9F6AE2]',
  build: 'border-l-[#4A7AFF]',
  spin_out: 'border-l-[#FFA166]',
  pause: 'border-l-zinc-400',
};

export function ActiveVentureKanbanCard({
  venture,
  allocations,
  employees,
  currentPhase,
  onSelect,
  onHide,
}: ActiveVentureKanbanCardProps) {
  const ventureAllocations = allocations.filter((a) => a.venture_id === venture.id);
  const teamEmployeeIds = [...new Set(ventureAllocations.map((a) => a.employee_id))];
  const teamMembers = teamEmployeeIds
    .map((id) => employees.find((e) => e.id === id))
    .filter((e): e is Employee => e != null);

  const isPlanned = venture.status === 'planned' || venture.status === 'exploration_staging';
  const tentativeStartDate = venture.tentative_start_date;
  const borderColor =
    currentPhase && PHASE_BORDER_COLORS[currentPhase]
      ? PHASE_BORDER_COLORS[currentPhase]
      : isPlanned
        ? 'border-l-zinc-400'
        : 'border-l-amber-400';

  return (
    <div
      className={`group cursor-pointer rounded-lg border border-zinc-200 border-l-4 bg-white shadow-sm ring-1 ring-zinc-900/5 transition-all hover:shadow-md ${borderColor}`}
      onClick={() => onSelect(venture.id)}
    >
      <div className="p-2">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-zinc-900">{venture.name}</span>
                {(() => {
                  const tag = getVentureTag(venture);
                  const dotClass = tag === 'greenlit' ? 'bg-emerald-500' : tag === 'battling' ? 'bg-amber-500' : tag === 'paused' ? 'bg-zinc-400' : '';
                  return tag ? <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${dotClass}`} title={tag} aria-label={tag} /> : null;
                })()}
              </div>
              {tentativeStartDate && (
                <span className="text-[10px] text-zinc-500">Start: {formatStartDate(tentativeStartDate)}</span>
              )}
            </div>
            {isPlanned && (
              <span className="mt-0.5 inline-block text-[10px] text-zinc-500">(planned)</span>
            )}
            {teamMembers.length > 0 && (
              <div className="mt-1.5">
                <TeamMemberBubbles members={teamMembers} size="compact" />
              </div>
            )}
          </div>
          <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            {onHide && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onHide(venture.id);
                }}
                className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                aria-label="Hide from timeline"
                title="Hide from timeline"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
