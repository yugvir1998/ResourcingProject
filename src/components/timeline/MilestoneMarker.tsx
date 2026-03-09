'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

interface MilestoneMarkerProps {
  date: string;
  label: string;
  left: number;
  color?: string;
  startDate?: Date;
  totalDays?: number;
  gridWidth?: number;
  onClick?: () => void;
  onUpdate?: (targetDate: string) => void;
}

function offsetToDate(offset: number, startDate: Date, totalDays: number): string {
  const totalMs = totalDays * 24 * 60 * 60 * 1000;
  const d = new Date(startDate.getTime() + (offset / 100) * totalMs);
  return d.toISOString().slice(0, 10);
}

export function MilestoneMarker({
  date,
  label,
  left,
  color = 'amber',
  startDate,
  totalDays = 1,
  gridWidth = 1,
  onClick,
  onUpdate,
}: MilestoneMarkerProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragLeft, setDragLeft] = useState<number | null>(null);
  const dragRef = useRef({ x: 0, leftPct: 0 });
  const didMoveRef = useRef(false);

  const canDrag = Boolean(onUpdate && startDate && totalDays > 0 && gridWidth > 0);
  const displayLeft = dragLeft ?? left;
  const borderColor = color === 'amber' ? 'border-amber-400' : 'border-zinc-400';
  const bgColor = color === 'amber' ? 'bg-amber-500' : 'bg-zinc-500';

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!canDrag) return;
      didMoveRef.current = false;
      setDragging(true);
      setDragLeft(left);
      dragRef.current = { x: e.clientX, leftPct: left };
    },
    [canDrag, left]
  );

  useEffect(() => {
    if (!dragging || !canDrag || gridWidth <= 0) return;
    const handleMouseMove = (e: MouseEvent) => {
      didMoveRef.current = true;
      const deltaPct = ((e.clientX - dragRef.current.x) / gridWidth) * 100;
      const newLeft = Math.max(0, Math.min(100, dragRef.current.leftPct + deltaPct));
      dragRef.current = { x: e.clientX, leftPct: newLeft };
      setDragLeft(newLeft);
    };
    const handleMouseUp = () => {
      if (didMoveRef.current && onUpdate && startDate && totalDays > 0) {
        const newDate = offsetToDate(dragRef.current.leftPct, startDate, totalDays);
        onUpdate(newDate);
      } else if (!didMoveRef.current && onClick) {
        onClick();
      }
      setDragging(false);
      setDragLeft(null);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, canDrag, gridWidth, onUpdate, startDate, totalDays, onClick]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canDrag && onClick) onClick();
  };

  return (
    <div
      data-milestone-marker
      className={`group absolute top-1/2 z-10 -translate-y-1/2 ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
      style={{ left: `${displayLeft}%`, transform: 'translate(-50%, -50%)' }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      <div
        className={`h-3 w-3 rotate-45 border-2 transition-shadow ${borderColor} ${bgColor} ${dragging ? 'shadow-lg ring-2 ring-amber-300/50' : ''}`}
        aria-hidden
      />
      {showTooltip && !dragging && (
        <div className="absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 whitespace-nowrap rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs font-medium text-zinc-800 shadow-lg">
          {label}: {date}
          {canDrag && <span className="ml-1 text-zinc-400">• Drag to move</span>}
        </div>
      )}
    </div>
  );
}
