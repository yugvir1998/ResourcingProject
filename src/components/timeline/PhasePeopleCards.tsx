'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { VenturePhase, Allocation } from '@/types';

interface PhasePeopleCardsProps {
  phase: VenturePhase;
  allocations: Allocation[];
  employees: { id: number; name: string }[];
  ventureId: number;
  leftOffsetPct?: number;
  widthPct?: number;
  onUpdate?: (id: number, updates: { fte_percentage?: number; phase_id?: number }) => void;
  onRemove?: (id: number) => void;
  onRefresh?: () => void;
}

export function PhasePeopleCards({
  phase,
  allocations,
  employees,
  ventureId,
  leftOffsetPct = 0,
  widthPct,
  onUpdate,
  onRemove,
  onRefresh,
}: PhasePeopleCardsProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingFte, setEditingFte] = useState<number>(0);

  const assignedIds = new Set(allocations.map((a) => a.employee_id));
  const availableEmployees = employees.filter((e) => !assignedIds.has(e.id));

  const handleStartEdit = (a: Allocation) => {
    setEditingId(a.id);
    setEditingFte(a.fte_percentage);
  };

  const handleSaveFte = async (id: number) => {
    if (onUpdate && editingFte >= 0 && editingFte <= 100) {
      onUpdate(id, { fte_percentage: editingFte });
    }
    setEditingId(null);
  };

  if (allocations.length === 0 && availableEmployees.length === 0) return null;

  return (
    <div
      className={`flex flex-wrap gap-1.5 border-b border-zinc-50 py-1.5 ${widthPct != null ? 'min-w-0 overflow-hidden' : ''}`}
      style={{ paddingLeft: leftOffsetPct > 0 ? `${leftOffsetPct}%` : undefined }}
    >
      {allocations.map((a) => {
        const emp = employees.find((e) => e.id === a.employee_id);
        const isEditing = editingId === a.id;
        return (
          <div
            key={a.id}
            className="flex items-center gap-1 rounded border border-zinc-200 bg-white px-2 py-1 text-xs shadow-sm"
          >
            <span className="font-medium text-zinc-800">{emp?.name || 'Unknown'}</span>
            {isEditing ? (
              <input
                type="number"
                min={0}
                max={100}
                value={editingFte}
                onChange={(e) => setEditingFte(Number(e.target.value))}
                onBlur={() => handleSaveFte(a.id)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveFte(a.id)}
                className="w-12 rounded border border-zinc-200 px-1 py-0.5 text-center placeholder:text-zinc-400"
                autoFocus
              />
            ) : (
              <span
                className="cursor-pointer text-zinc-500 hover:text-zinc-700"
                onClick={() => handleStartEdit(a)}
              >
                {a.fte_percentage}%
              </span>
            )}
            {onRemove && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(a.id);
                }}
                className="ml-0.5 text-zinc-400 hover:text-red-600"
              >
                ×
              </button>
            )}
          </div>
        );
      })}
      {availableEmployees.length > 0 && (
        <AddPersonDropdown
          employees={availableEmployees}
          ventureId={ventureId}
          phaseId={phase.id}
          onAdded={onRefresh}
        />
      )}
    </div>
  );
}

function AddPersonDropdown({
  employees,
  ventureId,
  phaseId,
  onAdded,
}: {
  employees: { id: number; name: string }[];
  ventureId: number;
  phaseId: number;
  onAdded?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && buttonRef.current) {
      setDropdownRect(buttonRef.current.getBoundingClientRect());
    } else {
      setDropdownRect(null);
    }
  }, [open]);

  const handleAdd = async (employeeId: number) => {
    setError(null);
    setAdding(true);
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    const weekStart = d.toISOString().slice(0, 10);
    try {
      const res = await fetch('/api/allocations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employeeId,
          venture_id: ventureId,
          phase_id: phaseId,
          fte_percentage: 50,
          week_start: weekStart,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setOpen(false);
        onAdded?.();
      } else {
        const msg = data?.error || res.statusText || 'Failed to add person';
        if (msg.includes('phase_id') || msg.includes('does not exist')) {
          setError('Database needs migration. Run: ALTER TABLE allocations ADD COLUMN IF NOT EXISTS phase_id BIGINT REFERENCES venture_phases(id) ON DELETE SET NULL;');
        } else {
          setError(msg);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add person');
    } finally {
      setAdding(false);
    }
  };

  const dropdownContent =
    open && typeof document !== 'undefined' ? (
      createPortal(
        <>
          <div
            className="fixed inset-0 z-[100] bg-black/20"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            className="fixed z-[101] max-h-48 w-52 overflow-y-auto overscroll-contain rounded border border-zinc-200 bg-white py-1 shadow-lg"
            style={
              dropdownRect
                ? {
                    left: dropdownRect.left,
                    top: dropdownRect.bottom + 4,
                  }
                : undefined
            }
            onWheel={(e) => e.stopPropagation()}
          >
            {error && (
              <div className="border-b border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}
            {employees.map((emp) => (
              <button
                key={emp.id}
                type="button"
                onClick={() => handleAdd(emp.id)}
                disabled={adding}
                className="w-full px-3 py-1.5 text-left text-xs text-zinc-900 hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-80"
              >
                {emp.name}
              </button>
            ))}
          </div>
        </>,
        document.body
      )
    ) : null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="rounded border border-dashed border-zinc-300 px-2 py-1 text-xs text-zinc-500 hover:border-zinc-400 hover:text-zinc-700"
      >
        + Add person
      </button>
      {dropdownContent}
    </div>
  );
}
