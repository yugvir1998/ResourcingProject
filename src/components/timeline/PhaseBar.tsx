'use client';

import { useState, useEffect, useRef } from 'react';
import type { VenturePhase } from '@/types';

const PHASE_COLORS: Record<string, string> = {
  explore: 'bg-teal-500/90',
  shape: 'bg-violet-500/90',
  build: 'bg-rose-500/90',
  spin_out: 'bg-blue-500/90',
  support: 'bg-cyan-500/90',
  pause: 'border-2 border-dashed border-zinc-300 bg-zinc-100',
};

interface PhaseBarProps {
  phase: VenturePhase;
  startDate: Date;
  endDate: Date;
  totalDays: number;
  gridWidth: number;
  onUpdate: (id: number, updates: { start_date: string; end_date: string }) => void;
  onExpandClick?: () => void;
  onPauseResume?: (phaseId: number) => void;
  /** People assigned to this phase (for showing initials on the bar) */
  assignedPeople?: { id: number; name: string }[];
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

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0]?.slice(0, 2).toUpperCase() || '?';
}

export function PhaseBar({
  phase,
  startDate,
  endDate: _endDate,
  totalDays,
  gridWidth,
  onUpdate,
  onExpandClick,
  onPauseResume,
  assignedPeople = [],
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

  const phaseLabel =
    phase.phase === 'explore'
      ? 'Explore'
      : phase.phase === 'shape'
        ? 'Shape'
        : phase.phase === 'build'
          ? 'Build'
          : phase.phase === 'spin_out'
            ? 'Spin out'
            : phase.phase === 'support'
              ? 'Support'
              : phase.phase === 'pause'
                ? 'Paused'
                : phase.phase;

  const isPause = phase.phase === 'pause';

  return (
    <div
      data-phase-bar
      data-phase-type={phase.phase}
      className={`group absolute top-1 h-6 rounded ${PHASE_COLORS[phase.phase] || 'bg-zinc-400'} cursor-move ${isPause ? 'text-zinc-600' : ''}`}
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
      <span className={`absolute inset-0 flex items-center justify-center gap-1.5 truncate px-2 text-xs font-medium ${isPause ? 'text-zinc-600' : 'text-white'}`}>
        {phaseLabel}
        {assignedPeople.length > 0 && (
          <span className="flex shrink-0 items-center gap-1">
            {assignedPeople.slice(0, 3).map((p) => (
              <span
                key={p.id}
                className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-medium ${isPause ? 'bg-zinc-300/80 text-zinc-700' : 'bg-white/30 text-white'}`}
                title={p.name}
              >
                {getInitials(p.name)}
              </span>
            ))}
            {assignedPeople.length > 3 && (
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-medium ${isPause ? 'bg-zinc-300/80 text-zinc-700' : 'bg-white/30 text-white'}`}
                title={assignedPeople.slice(3).map((e) => e.name).join(', ')}
              >
                +{assignedPeople.length - 3}
              </span>
            )}
          </span>
        )}
      </span>
    </div>
  );
}
