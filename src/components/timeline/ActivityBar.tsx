'use client';

import { useState, useEffect, useRef } from 'react';
import type { PhaseActivity } from '@/types';

interface ActivityBarProps {
  activity: PhaseActivity;
  startDate: Date;
  endDate: Date;
  totalDays: number;
  gridWidth: number;
  onUpdate: (id: number, updates: { start_date: string; end_date: string }) => void;
  onDelete?: (id: number) => void;
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

export function ActivityBar({
  activity,
  startDate,
  endDate: _endDate,
  totalDays,
  gridWidth,
  onUpdate,
  onDelete,
}: ActivityBarProps) {
  const activityStart = new Date(activity.start_date);
  const activityEnd = new Date(activity.end_date);
  const [dragging, setDragging] = useState<'left' | 'right' | 'move' | null>(null);
  const [dragPos, setDragPos] = useState<{ left: number; right: number } | null>(null);
  const dragRef = useRef({ x: 0, left: 0, right: 0 });

  const baseLeft = dateToOffset(activityStart, startDate, totalDays);
  const baseRight = dateToOffset(activityEnd, startDate, totalDays);
  const leftPct = dragPos?.left ?? baseLeft;
  const rightPct = dragPos?.right ?? baseRight;
  const widthPct = rightPct - leftPct;

  const handleMouseDown = (e: React.MouseEvent, mode: 'left' | 'right' | 'move') => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(mode);
    setDragPos({ left: baseLeft, right: baseRight });
    dragRef.current = { x: e.clientX, left: baseLeft, right: baseRight };
  };

  useEffect(() => {
    if (!dragging || gridWidth <= 0) return;
    const handleMouseMove = (e: MouseEvent) => {
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
        onUpdate(activity.id, {
          start_date: newStart.toISOString().slice(0, 10),
          end_date: newEnd.toISOString().slice(0, 10),
        });
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
  }, [dragging, startDate, totalDays, onUpdate, activity.id, gridWidth, baseLeft, baseRight]);

  return (
    <div
      className="group absolute top-1 h-5 rounded border border-zinc-300 bg-zinc-100/90 cursor-move"
      style={{
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        minWidth: 20,
      }}
      onMouseDown={(e) => handleMouseDown(e, 'move')}
    >
      <div
        className="absolute -left-1 top-0 h-full w-1.5 cursor-ew-resize hover:bg-zinc-300/50 rounded"
        onMouseDown={(e) => handleMouseDown(e, 'left')}
      />
      <div
        className="absolute -right-1 top-0 h-full w-1.5 cursor-ew-resize hover:bg-zinc-300/50 rounded"
        onMouseDown={(e) => handleMouseDown(e, 'right')}
      />
      <span className="absolute inset-0 flex items-center truncate px-2 text-xs text-zinc-700">
        {activity.name}
      </span>
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(activity.id);
          }}
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-400 opacity-0 hover:bg-zinc-300 hover:text-red-600 group-hover:opacity-100"
        >
          ×
        </button>
      )}
    </div>
  );
}
