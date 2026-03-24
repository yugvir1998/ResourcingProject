'use client';

import { useState, useEffect, useRef } from 'react';
import type { VenturePhase } from '@/types';
import { PHASE_COLORS } from '@/lib/phaseColors';

interface PhaseBarProps {
  phase: VenturePhase;
  isPlanned?: boolean;
  startDate: Date;
  endDate: Date;
  totalDays: number;
  gridWidth: number;
  onUpdate: (id: number, updates: { start_date: string; end_date: string }) => void;
  onExpandClick?: () => void;
  onPauseResume?: (phaseId: number) => void;
  /** People assigned to this phase (for showing initials on the bar) */
  assignedPeople?: { id: number; name: string; scenario_tag?: string | null }[];
  /** Project lead employee id (for lead styling) */
  primaryContactId?: number | null;
  ventureId?: number;
  onSetProjectLead?: (ventureId: number, employeeId: number) => void;
}

function dateToOffset(date: Date, startDate: Date, totalDays: number): number {
  const startTime = startDate.getTime();
  const dateTime = date.getTime();
  const totalMs = totalDays * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.min(100, ((dateTime - startTime) / totalMs) * 100));
}

function offsetToDate(offset: number, startDate: Date, totalDays: number): Date {
  const totalMs = totalDays * 24 * 60 * 60 * 1000;
  return new Date(startDate.getTime() + (offset / 100) * totalMs);
}

function getFirstName(name: string): string {
  const first = name.trim().split(/\s+/)[0];
  return first || name || '?';
}

export function PhaseBar({
  phase,
  isPlanned = false,
  startDate,
  endDate: _endDate,
  totalDays,
  gridWidth,
  onUpdate,
  onExpandClick,
  onPauseResume,
  assignedPeople = [],
  primaryContactId,
  ventureId,
  onSetProjectLead,
}: PhaseBarProps) {
  const phaseStart = new Date(phase.start_date);
  const phaseEnd = new Date(phase.end_date);
  const [dragging, setDragging] = useState<'left' | 'right' | 'move' | null>(null);
  const [dragPos, setDragPos] = useState<{ left: number; right: number } | null>(null);
  const dragRef = useRef({ x: 0, left: 0, right: 0 });
  const didMoveRef = useRef(false);

  const baseLeft = dateToOffset(phaseStart, startDate, totalDays);
  const baseRight = dateToOffset(phaseEnd, startDate, totalDays);
  const leftPct = dragPos?.left ?? baseLeft;
  const rightPct = dragPos?.right ?? baseRight;
  const widthPct = rightPct - leftPct;

  const handleMouseDown = (e: React.MouseEvent, mode: 'left' | 'right' | 'move') => {
    e.preventDefault();
    e.stopPropagation();
    didMoveRef.current = false;
    setDragging(mode);
    setDragPos({ left: baseLeft, right: baseRight });
    dragRef.current = { x: e.clientX, left: baseLeft, right: baseRight };
  };

  useEffect(() => {
    if (!dragging || gridWidth <= 0) return;
    const handleMouseMove = (e: MouseEvent) => {
      didMoveRef.current = true;
      const deltaPct = ((e.clientX - dragRef.current.x) / gridWidth) * 100;
      let newLeft = dragRef.current.left;
      let newRight = dragRef.current.right;
      if (dragging === 'left') {
        newLeft = Math.max(0, Math.min(dragRef.current.right - 2, dragRef.current.left + deltaPct));
      } else if (dragging === 'right') {
        newRight = Math.max(dragRef.current.left + 2, Math.min(100, dragRef.current.right + deltaPct));
      } else {
        const width = dragRef.current.right - dragRef.current.left;
        newLeft = Math.max(0, Math.min(100 - width, dragRef.current.left + deltaPct));
        newRight = newLeft + width;
      }
      dragRef.current = { x: e.clientX, left: newLeft, right: newRight };
      setDragPos({ left: newLeft, right: newRight });
    };
    const handleMouseUp = () => {
      if (dragRef.current.left !== baseLeft || dragRef.current.right !== baseRight) {
        const newStart = offsetToDate(dragRef.current.left, startDate, totalDays);
        const newEnd = offsetToDate(dragRef.current.right, startDate, totalDays);
        onUpdate(phase.id, {
          start_date: newStart.toISOString().slice(0, 10),
          end_date: newEnd.toISOString().slice(0, 10),
        });
      } else if (!didMoveRef.current) {
        if (phase.phase === 'pause' && onPauseResume) {
          onPauseResume(phase.id);
        } else if (onExpandClick) {
          onExpandClick();
        }
      }
      setDragging(null);
      setDragPos(null);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, startDate, totalDays, onUpdate, phase.id, gridWidth, baseLeft, baseRight, onExpandClick]);

  const isPause = phase.phase === 'pause';
  const barColor = isPlanned
    ? 'border-2 border-dashed border-zinc-400 bg-zinc-300/60'
    : PHASE_COLORS[phase.phase] || 'bg-zinc-400';
  const textColor = isPlanned || isPause ? 'text-zinc-600' : 'text-white';

  return (
    <div
      data-phase-bar
      data-phase-type={phase.phase}
      className={`group absolute top-0.5 h-6 rounded ${barColor} cursor-move ${textColor}`}
      style={{
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        minWidth: 24,
      }}
      onMouseDown={(e) => handleMouseDown(e, 'move')}
    >
      <div
        className="absolute -left-2 top-0 h-full w-4 cursor-ew-resize hover:bg-white/30"
        onMouseDown={(e) => handleMouseDown(e, 'left')}
      />
      <div
        className="absolute -right-2 top-0 h-full w-4 cursor-ew-resize hover:bg-white/30"
        onMouseDown={(e) => handleMouseDown(e, 'right')}
      />
      <span className={`absolute inset-0 flex items-center justify-center gap-2 truncate px-3 text-xs font-medium ${textColor}`}>
        {assignedPeople.length > 0 ? (
          <span className="flex shrink-0 items-center gap-1.5">
            {[...assignedPeople]
              .sort((a, b) => {
                if (primaryContactId != null && a.id === primaryContactId) return -1;
                if (primaryContactId != null && b.id === primaryContactId) return 1;
                return 0;
              })
              .map((p, idx) => {
              const isSmall = assignedPeople.length >= 5;
              const isLead = primaryContactId != null ? p.id === primaryContactId : idx === 0;
              const isPotentialHire = String(p.scenario_tag ?? '').toLowerCase() === 'potential_hire';
              const bgClass = isPotentialHire
                ? 'potential-hire-outline-compact text-zinc-800'
                : isLead
                  ? isPlanned || isPause
                    ? 'bg-zinc-300 text-zinc-700'
                    : 'bg-white text-zinc-800'
                  : isPlanned || isPause
                    ? 'bg-zinc-300/60 text-zinc-700'
                    : 'bg-white/60 text-white';
              const sizeClass = isSmall ? 'h-3 min-w-3 text-[8px]' : 'h-4 min-w-4 text-[9px]';
              const handleContextMenu = ventureId != null && onSetProjectLead
                ? (e: React.MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSetProjectLead(ventureId, p.id);
                  }
                : undefined;
              return (
                <span
                  key={p.id}
                  className={'flex max-w-12 items-center justify-center gap-0.5 overflow-hidden rounded-full px-1.5 font-medium ' + sizeClass + ' ' + bgClass}
                  title={isPotentialHire ? `${p.name} (Potential hire)` : p.name}
                  onContextMenu={handleContextMenu}
                >
                  <span className="truncate">{getFirstName(p.name)}</span>
                </span>
              );
            })}
          </span>
        ) : null}
      </span>
    </div>
  );
}
