'use client';

import { useState, useEffect } from 'react';
import { TeamMemberBubbles } from './TeamMemberBubbles';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove, horizontalListSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Venture } from '@/types';
import { useToast } from '@/components/Toast';
import { DeleteVentureConfirmModal } from '@/components/DeleteVentureConfirmModal';

function getWeekStartString(d: Date): string {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  return monday.toISOString().slice(0, 10);
}

/** Get 8 week-start strings (2 months) from a given date for exploration staging allocations */
function getWeekStartsForTwoMonths(fromDate: Date): string[] {
  const start = new Date(fromDate);
  start.setHours(0, 0, 0, 0);
  const firstWeek = getWeekStartString(start);
  const weeks: string[] = [firstWeek];
  for (let i = 1; i < 8; i++) {
    const next = new Date(start);
    next.setDate(next.getDate() + 7 * i);
    weeks.push(getWeekStartString(next));
  }
  return weeks;
}

interface VentureAllocation {
  id: number;
  employee_id: number;
  venture_id: number;
}

interface ExplorationStagingCardProps {
  venture: Venture;
  index: number;
  teamMembers: { id: number; name: string }[];
  ventureAllocations: VentureAllocation[];
  employees: { id: number; name: string }[];
  onUpdate: (id: number, updates: Partial<Venture>) => Promise<{ ok: boolean; error?: string }>;
  onUpdateTeam: (ventureId: number, addEmployeeIds: number[], removeAllocationIds: number[], options?: { tentativeStartDate?: string | null }) => Promise<{ ok: boolean; error?: string }>;
  onDelete: (id: number) => Promise<boolean>;
}

function ExplorationStagingCard({ venture, index, teamMembers, ventureAllocations, employees, onUpdate, onUpdateTeam, onDelete }: ExplorationStagingCardProps) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(venture.name);
  const [editNotes, setEditNotes] = useState(venture.notes || '');
  const [editNextSteps, setEditNextSteps] = useState(venture.next_steps || '');
  const [editNotionLink, setEditNotionLink] = useState(venture.notion_link || '');
  const [editTentativeStart, setEditTentativeStart] = useState(venture.tentative_start_date || '');
  const [editDesignPartner, setEditDesignPartner] = useState(venture.design_partner || '');
  const [editSelectedEmployeeIds, setEditSelectedEmployeeIds] = useState<number[]>([]);
  const [editError, setEditError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const toggleEmployee = (id: number) => {
    setEditSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `exploration-${venture.id}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleSave = async () => {
    setEditError(null);
    const ventureResult = await onUpdate(venture.id, {
      name: editName.trim(),
      notes: editNotes.trim() || null,
      next_steps: editNextSteps.trim() || null,
      notion_link: editNotionLink.trim() || null,
      tentative_start_date: editTentativeStart || null,
      design_partner: editDesignPartner.trim() || null,
    });
    if (!ventureResult.ok) {
      const errMsg = ventureResult.error || 'Failed to save';
      setEditError(errMsg);
      toast.show(errMsg);
      if (process.env.NODE_ENV === 'development') console.error('Venture update failed:', ventureResult.error);
      return;
    }
    const currentEmpIds = new Set(ventureAllocations.map((a) => a.employee_id));
    const newEmpIds = new Set(editSelectedEmployeeIds);
    const addIds = [...newEmpIds].filter((id) => !currentEmpIds.has(id));
    const removeIds = ventureAllocations
      .filter((a) => !newEmpIds.has(a.employee_id))
      .map((a) => a.id);
    if (addIds.length > 0 || removeIds.length > 0) {
      const teamResult = await onUpdateTeam(venture.id, addIds, removeIds, { tentativeStartDate: editTentativeStart || venture.tentative_start_date });
      if (!teamResult.ok) {
        const errMsg = teamResult.error || 'Failed to save team';
        setEditError(errMsg);
        toast.show(errMsg);
        if (process.env.NODE_ENV === 'development') console.error('Team update failed:', teamResult.error);
        return;
      }
    }
    setEditing(false);
  };

  const handleDeleteClick = () => setShowDeleteModal(true);

  const handleDeleteConfirm = async () => {
    const success = await onDelete(venture.id);
    if (!success) {
      toast.show('Failed to delete venture');
    }
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`group flex min-w-[200px] max-w-[240px] shrink-0 cursor-grab flex-col rounded-lg border border-zinc-200 border-l-4 border-l-teal-400 bg-white p-2 shadow-sm ring-1 ring-zinc-900/5 transition-all hover:shadow-md active:cursor-grabbing ${isDragging ? 'opacity-50 ring-2 ring-teal-400' : ''}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <span className="shrink-0 text-[10px] font-medium tabular-nums text-zinc-400" aria-label={`Position ${index}`}>{index}</span>
            <div className="min-w-0 flex-1 font-medium text-zinc-900">{venture.name}</div>
          </div>
          <div
            className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
              setEditName(venture.name);
              setEditNotes(venture.notes || '');
              setEditNextSteps(venture.next_steps || '');
              setEditNotionLink(venture.notion_link || '');
              setEditTentativeStart(venture.tentative_start_date || '');
              setEditDesignPartner(venture.design_partner || '');
              setEditSelectedEmployeeIds(ventureAllocations.map((a) => a.employee_id));
              setEditError(null);
              setEditing(true);
            }}
            className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
            title="Edit"
            aria-label="Edit"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleDeleteClick}
            className="rounded p-1.5 text-zinc-500 hover:bg-red-50 hover:text-red-600"
            title="Delete"
            aria-label="Delete"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </button>
          </div>
        </div>
        {venture.notes && <div className="mt-1.5 text-xs text-zinc-600 line-clamp-2">{venture.notes}</div>}
        {teamMembers.length > 0 && (
          <div className="mt-1.5">
            <TeamMemberBubbles members={teamMembers} />
          </div>
        )}
        {venture.tentative_start_date && (
          <div className="mt-1 text-xs text-zinc-500">
            <span className="font-medium">Start:</span>{' '}
            {new Date(venture.tentative_start_date).toLocaleDateString()}
          </div>
        )}
        {venture.design_partner && (
          <div className="mt-1 text-xs text-zinc-500">
            <span className="font-medium">Partner:</span> {venture.design_partner}
          </div>
        )}
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
          onClick={() => setEditing(false)}
        >
          <div
            className="flex max-h-[calc(100vh-4rem)] w-full max-w-md flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="shrink-0 px-6 pt-6 pb-2 text-lg font-semibold text-zinc-900">Edit venture</h3>
            <div className="flex-1 overflow-y-auto px-6 pb-4">
            <div className="space-y-4">
              {editError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                  {editError}
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  placeholder="Venture name"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Notes (optional)</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  placeholder="Any notes..."
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Next steps (optional)</label>
                <input
                  type="text"
                  value={editNextSteps}
                  onChange={(e) => setEditNextSteps(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  placeholder="e.g. Schedule design partner call"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Notion link (optional)</label>
                <input
                  type="text"
                  value={editNotionLink}
                  onChange={(e) => setEditNotionLink(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Design partner (optional)</label>
                <input
                  type="text"
                  value={editDesignPartner}
                  onChange={(e) => setEditDesignPartner(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  placeholder="Company or contact name"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Tentative start date (optional)</label>
                <input
                  type="date"
                  value={editTentativeStart}
                  onChange={(e) => setEditTentativeStart(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Team members</label>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-zinc-300 p-2">
                  {employees.length === 0 ? (
                    <p className="text-xs text-zinc-500">No employees</p>
                  ) : (
                    <div className="space-y-1">
                      {employees.map((emp) => (
                        <label
                          key={emp.id}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-zinc-50"
                        >
                          <input
                            type="checkbox"
                            checked={editSelectedEmployeeIds.includes(emp.id)}
                            onChange={() => toggleEmployee(emp.id)}
                            className="rounded border-zinc-300"
                          />
                          <span className="text-sm text-zinc-700">{emp.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            </div>
            <div className="shrink-0 border-t border-zinc-200 px-6 py-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={!editName.trim()}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
            </div>
            </div>
          </div>
        </div>
      )}
      <DeleteVentureConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        ventureName={venture.name}
      />
    </>
  );
}

interface ExplorationStagingSectionProps {
  refreshTrigger?: number;
  onRefresh?: () => void;
}

export function ExplorationStagingSection({ refreshTrigger, onRefresh }: ExplorationStagingSectionProps) {
  const [ventures, setVentures] = useState<Venture[]>([]);
  const [allocations, setAllocations] = useState<{ id: number; employee_id: number; venture_id: number }[]>([]);
  const [employees, setEmployees] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [vRes, aRes, eRes] = await Promise.all([
        fetch('/api/ventures'),
        fetch('/api/allocations'),
        fetch('/api/employees'),
      ]);
      const [vData, aData, eData] = await Promise.all([vRes.json(), aRes.json(), eRes.json()]);
      if (!cancelled) {
        const filtered = Array.isArray(vData) ? vData.filter((v: Venture) => v.status === 'exploration_staging') : [];
        setVentures(filtered.sort((a: Venture, b: Venture) => a.backlog_priority - b.backlog_priority));
        setAllocations(Array.isArray(aData) ? aData : []);
        setEmployees(Array.isArray(eData) ? eData : []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshTrigger]);

  const updateVenture = async (id: number, updates: Partial<Venture>): Promise<{ ok: boolean; error?: string }> => {
    const res = await fetch(`/api/ventures/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setVentures((v) => v.map((x) => (x.id === id ? data : x)));
      onRefresh?.();
      return { ok: true };
    }
    return { ok: false, error: typeof data?.error === 'string' ? data.error : 'Failed to update venture' };
  };

  const deleteVenture = async (id: number): Promise<boolean> => {
    const res = await fetch(`/api/ventures/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setVentures((v) => v.filter((x) => x.id !== id));
      onRefresh?.();
      return true;
    }
    return false;
  };

  const getTeamForVenture = (ventureId: number): { id: number; name: string }[] => {
    const empIds = [...new Set(allocations.filter((a) => a.venture_id === ventureId).map((a) => a.employee_id))];
    return empIds
      .map((id) => employees.find((e) => e.id === id))
      .filter((e): e is { id: number; name: string } => e != null);
  };

  const getVentureAllocations = (ventureId: number): { id: number; employee_id: number; venture_id: number }[] =>
    allocations.filter((a) => a.venture_id === ventureId);

  const updateTeam = async (
    ventureId: number,
    addEmployeeIds: number[],
    removeAllocationIds: number[],
    options?: { tentativeStartDate?: string | null }
  ): Promise<{ ok: boolean; error?: string }> => {
    const startDate = options?.tentativeStartDate
      ? new Date(options.tentativeStartDate)
      : new Date();
    const weekStarts = getWeekStartsForTwoMonths(startDate);
    try {
      for (const id of removeAllocationIds) {
        const res = await fetch(`/api/allocations/${id}`, { method: 'DELETE' });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          return { ok: false, error: typeof data?.error === 'string' ? data.error : 'Failed to remove team member' };
        }
      }
      for (const empId of addEmployeeIds) {
        for (const weekStart of weekStarts) {
          const res = await fetch('/api/allocations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              venture_id: ventureId,
              employee_id: empId,
              fte_percentage: 50,
              week_start: weekStart,
            }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            return { ok: false, error: typeof data?.error === 'string' ? data.error : 'Failed to add team member' };
          }
        }
      }
      const aRes = await fetch('/api/allocations');
      const aData = await aRes.json();
      setAllocations(Array.isArray(aData) ? aData : []);
      onRefresh?.();
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update team';
      return { ok: false, error: msg };
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ventures.findIndex((v) => `exploration-${v.id}` === active.id);
    const newIndex = ventures.findIndex((v) => `exploration-${v.id}` === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(ventures, oldIndex, newIndex);
    setVentures(reordered);
    const ventureIds = reordered.map((v) => v.id);
    const res = await fetch('/api/ventures/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ventureIds }),
    });
    if (!res.ok) {
      setVentures(ventures);
      onRefresh?.();
    } else {
      onRefresh?.();
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  if (loading) {
    return (
      <section>
        <h2 className="mb-1.5 flex items-center gap-2 text-lg font-semibold tracking-tight text-zinc-900">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
          Pre-Exploration ({ventures.length})
        </h2>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="min-w-[260px] animate-pulse rounded-xl border-2 border-zinc-200 bg-zinc-50/50 p-4">
              <div className="h-4 w-32 rounded bg-zinc-200" />
              <div className="mt-3 h-3 w-24 rounded bg-zinc-100" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-zinc-900">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
          Pre-Exploration ({ventures.length})
        </h2>
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="rounded-lg border border-dashed border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:border-zinc-400 hover:text-zinc-700"
        >
          + Add
        </button>
      </div>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={ventures.map((v) => `exploration-${v.id}`)} strategy={horizontalListSortingStrategy}>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {ventures.map((v, i) => (
              <ExplorationStagingCard
                key={v.id}
                venture={v}
                index={i + 1}
                teamMembers={getTeamForVenture(v.id)}
                ventureAllocations={getVentureAllocations(v.id)}
                employees={employees}
                onUpdate={updateVenture}
                onUpdateTeam={updateTeam}
                onDelete={deleteVenture}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {showAddForm && (
        <AddExplorationVentureForm
          onAdded={() => {
            setShowAddForm(false);
            onRefresh?.();
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}
    </section>
  );
}

function AddExplorationVentureForm({
  onAdded,
  onCancel,
}: {
  onAdded: () => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [notionLink, setNotionLink] = useState('');
  const [tentativeStart, setTentativeStart] = useState('');
  const [designPartner, setDesignPartner] = useState('');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
  const [employees, setEmployees] = useState<{ id: number; name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/employees')
      .then((r) => r.json())
      .then((data: { id: number; name: string }[] | { error?: string }) => {
        setEmployees(Array.isArray(data) ? data : []);
      });
  }, []);

  const toggleEmployee = (id: number) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/ventures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          status: 'exploration_staging',
          notes: notes.trim() || null,
          notion_link: notionLink.trim() || null,
          tentative_start_date: tentativeStart || null,
          design_partner: designPartner.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const venture = data as { id: number };
        const startDate = tentativeStart ? new Date(tentativeStart) : new Date();
        const weekStarts = getWeekStartsForTwoMonths(startDate);
        for (const empId of selectedEmployeeIds) {
          for (const weekStart of weekStarts) {
            const allocRes = await fetch('/api/allocations', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                venture_id: venture.id,
                employee_id: empId,
                fte_percentage: 50,
                week_start: weekStart,
              }),
            });
            if (!allocRes.ok) {
              const allocData = await allocRes.json().catch(() => ({}));
              const allocErr = typeof allocData?.error === 'string' ? allocData.error : 'Failed to add team member';
              setError(allocErr);
              toast.show(allocErr);
              if (process.env.NODE_ENV === 'development') console.error('Allocation POST failed:', allocErr);
              return;
            }
          }
        }
        onAdded();
      } else {
        const errMsg = typeof data?.error === 'string' ? data.error : 'Failed to add venture';
        setError(errMsg);
        toast.show(errMsg);
        if (process.env.NODE_ENV === 'development') console.error('Venture POST failed:', data);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to add venture';
      setError(msg);
      toast.show(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-lg font-semibold text-zinc-900">Add venture to Exploration Staging</h3>
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Notion link (optional)</label>
            <input
              type="text"
              value={notionLink}
              onChange={(e) => setNotionLink(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Tentative start date</label>
            <input
              type="date"
              value={tentativeStart}
              onChange={(e) => setTentativeStart(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Design partner</label>
            <input
              type="text"
              value={designPartner}
              onChange={(e) => setDesignPartner(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Team members</label>
            <div className="max-h-32 overflow-y-auto rounded-lg border border-zinc-300 p-2">
              {employees.length === 0 ? (
                <p className="text-xs text-zinc-500">Loading employees...</p>
              ) : (
                <div className="space-y-1">
                  {employees.map((emp) => (
                    <label
                      key={emp.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-zinc-50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedEmployeeIds.includes(emp.id)}
                        onChange={() => toggleEmployee(emp.id)}
                        className="rounded border-zinc-300"
                      />
                      <span className="text-sm text-zinc-700">{emp.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!name.trim() || submitting}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              Add
            </button>
            <button type="button" onClick={onCancel} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
