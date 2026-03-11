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

function getFirstName(name: string): string {
  const first = name.trim().split(/\s+/)[0];
  return first || name || '?';
}

interface VentureAllocation {
  id: number;
  employee_id: number;
  venture_id: number;
}

interface SupportVentureCardProps {
  venture: Venture;
  teamMembers: { id: number; name: string }[];
  ventureAllocations: VentureAllocation[];
  employees: { id: number; name: string }[];
  nextMilestoneDate: string | null;
  onUpdate: (id: number, updates: Partial<Venture>) => Promise<{ ok: boolean; error?: string }>;
  onUpdateTeam: (ventureId: number, addEmployeeIds: number[], removeAllocationIds: number[]) => Promise<{ ok: boolean; error?: string }>;
  onDelete: (id: number) => Promise<boolean>;
}

function getWeekStartString(d: Date): string {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  return monday.toISOString().slice(0, 10);
}

function SupportVentureCard({ venture, teamMembers, ventureAllocations, employees, nextMilestoneDate, onUpdate, onUpdateTeam, onDelete }: SupportVentureCardProps) {
  const toast = useToast();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `support-${venture.id}`,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(venture.name);
  const [editNotes, setEditNotes] = useState(venture.notes || '');
  const [editOneMetric, setEditOneMetric] = useState(venture.one_metric_that_matters || '');
  const [editSelectedEmployeeIds, setEditSelectedEmployeeIds] = useState<number[]>([]);
  const [editError, setEditError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const toggleEmployee = (id: number) => {
    setEditSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    setEditError(null);
    const ventureResult = await onUpdate(venture.id, {
      name: editName.trim(),
      notes: editNotes.trim() || null,
      one_metric_that_matters: editOneMetric.trim() || null,
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
      const teamResult = await onUpdateTeam(venture.id, addIds, removeIds);
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
        className={`group flex min-w-[260px] max-w-[280px] shrink-0 cursor-grab flex-col rounded-xl border border-zinc-200 border-l-4 border-l-cyan-400 bg-white p-4 shadow-sm ring-1 ring-zinc-900/5 transition-all hover:shadow-md active:cursor-grabbing ${isDragging ? 'opacity-50 ring-2 ring-cyan-400' : ''}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 font-medium text-zinc-900">{venture.name}</div>
          <div
            className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                setEditName(venture.name);
                setEditNotes(venture.notes || '');
                setEditOneMetric(venture.one_metric_that_matters || '');
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
        {venture.notes && <div className="mt-2 text-xs text-zinc-600 line-clamp-2">{venture.notes}</div>}
        {teamMembers.length > 0 && (
          <div className="mt-2">
            <TeamMemberBubbles members={teamMembers} />
          </div>
        )}
        {venture.one_metric_that_matters && (
          <div className="mt-2 text-xs text-zinc-600">
            <span className="font-medium">Metric:</span> {venture.one_metric_that_matters}
          </div>
        )}
        {nextMilestoneDate && (
          <div className="mt-1 text-xs text-zinc-500">
            <span className="font-medium">Next milestone:</span> {new Date(nextMilestoneDate).toLocaleDateString()}
          </div>
        )}
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
          onClick={() => setEditing(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-lg font-semibold text-zinc-900">Edit support venture</h3>
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
                <label className="mb-1 block text-sm font-medium text-zinc-700">One metric that matters (optional)</label>
                <input
                  type="text"
                  value={editOneMetric}
                  onChange={(e) => setEditOneMetric(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  placeholder="e.g. Monthly recurring revenue"
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
            <div className="mt-5 flex gap-2">
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

interface SupportVenturesSectionProps {
  refreshTrigger?: number;
  onRefresh?: () => void;
}

interface Milestone {
  venture_id: number;
  target_date: string;
}

export function SupportVenturesSection({ refreshTrigger, onRefresh }: SupportVenturesSectionProps) {
  const [ventures, setVentures] = useState<Venture[]>([]);
  const [allocations, setAllocations] = useState<{ id: number; employee_id: number; venture_id: number }[]>([]);
  const [employees, setEmployees] = useState<{ id: number; name: string }[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [vRes, aRes, eRes, mRes] = await Promise.all([
        fetch('/api/ventures'),
        fetch('/api/allocations'),
        fetch('/api/employees'),
        fetch('/api/hiring-milestones'),
      ]);
      const [vData, aData, eData, mData] = await Promise.all([vRes.json(), aRes.json(), eRes.json(), mRes.json()]);
      if (!cancelled) {
        setVentures(
          Array.isArray(vData)
            ? vData.filter((v: Venture) => v.status === 'support').sort((a: Venture, b: Venture) => a.backlog_priority - b.backlog_priority)
            : []
        );
        setAllocations(Array.isArray(aData) ? aData : []);
        setEmployees(Array.isArray(eData) ? eData : []);
        setMilestones(Array.isArray(mData) ? mData : []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshTrigger]);

  const getTeamForVenture = (ventureId: number): { id: number; name: string }[] => {
    const empIds = [...new Set(allocations.filter((a) => a.venture_id === ventureId).map((a) => a.employee_id))];
    return empIds
      .map((id) => employees.find((e) => e.id === id))
      .filter((e): e is { id: number; name: string } => e != null);
  };

  const getNextMilestoneForVenture = (ventureId: number): string | null => {
    const ventureMilestones = milestones
      .filter((m) => m.venture_id === ventureId)
      .sort((a, b) => a.target_date.localeCompare(b.target_date));
    const future = ventureMilestones.filter((m) => m.target_date >= new Date().toISOString().slice(0, 10));
    return future[0]?.target_date ?? ventureMilestones[0]?.target_date ?? null;
  };

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

  const updateTeam = async (
    ventureId: number,
    addEmployeeIds: number[],
    removeAllocationIds: number[]
  ): Promise<{ ok: boolean; error?: string }> => {
    const weekStart = getWeekStartString(new Date());
    try {
      for (const id of removeAllocationIds) {
        const res = await fetch(`/api/allocations/${id}`, { method: 'DELETE' });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          return { ok: false, error: typeof data?.error === 'string' ? data.error : 'Failed to remove team member' };
        }
      }
      for (const empId of addEmployeeIds) {
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

  const getVentureAllocations = (ventureId: number) =>
    allocations.filter((a) => a.venture_id === ventureId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ventures.findIndex((v) => `support-${v.id}` === active.id);
    const newIndex = ventures.findIndex((v) => `support-${v.id}` === over.id);
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
    }
    onRefresh?.();
  };

  if (loading) {
    return (
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold tracking-tight text-zinc-900">
          <span className="h-2 w-2 rounded-full bg-cyan-400" />
          Support Ventures ({ventures.length})
        </h2>
        <div className="flex flex-wrap gap-4">
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
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-zinc-900">
          <span className="h-2 w-2 rounded-full bg-cyan-400" />
          Support Ventures ({ventures.length})
        </h2>
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="rounded-lg border border-dashed border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:border-zinc-400 hover:text-zinc-700"
        >
          + Add support venture
        </button>
      </div>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={ventures.map((v) => `support-${v.id}`)} strategy={horizontalListSortingStrategy}>
      <div className="flex flex-wrap gap-4">
        {ventures.map((v) => (
          <SupportVentureCard
            key={v.id}
            venture={v}
            teamMembers={getTeamForVenture(v.id)}
            ventureAllocations={getVentureAllocations(v.id)}
            employees={employees}
            nextMilestoneDate={getNextMilestoneForVenture(v.id)}
            onUpdate={updateVenture}
            onUpdateTeam={updateTeam}
            onDelete={deleteVenture}
          />
        ))}
      </div>
        </SortableContext>
      </DndContext>

      {showAddForm && (
        <AddSupportVentureModal
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

type AddSupportMode = 'choose' | 'new' | 'select';

function AddSupportVentureModal({ onAdded, onCancel }: { onAdded: () => void; onCancel: () => void }) {
  const toast = useToast();
  const [mode, setMode] = useState<AddSupportMode>('choose');
  const [ventures, setVentures] = useState<Venture[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'select') {
      setLoading(true);
      fetch('/api/ventures')
        .then((r) => r.json())
        .then((data: Venture[] | { error?: string }) => {
          const list = Array.isArray(data) ? data : [];
          const active = list.filter(
            (v: Venture) => v.timeline_visible === true && v.status !== 'support'
          );
          setVentures(active);
        })
        .finally(() => setLoading(false));
    }
  }, [mode]);

  const handleMoveToSupport = async (v: Venture) => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/ventures/${v.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'support' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        onAdded();
      } else {
        const errMsg = typeof data?.error === 'string' ? data.error : 'Failed to move to support';
        setError(errMsg);
        toast.show(errMsg);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to move to support';
      setError(msg);
      toast.show(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setMode('choose');
    setError(null);
    onCancel();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {mode === 'choose' && (
          <>
            <h3 className="mb-4 text-lg font-semibold text-zinc-900">Add support venture</h3>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setMode('new')}
                className="w-full rounded-lg border border-zinc-200 px-4 py-3 text-left text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                Add new support venture
              </button>
              <button
                type="button"
                onClick={() => setMode('select')}
                className="w-full rounded-lg border border-zinc-200 px-4 py-3 text-left text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                Add from Active Ventures
              </button>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="mt-4 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </button>
          </>
        )}

        {mode === 'new' && (
          <AddSupportVentureForm
            onAdded={onAdded}
            onCancel={handleClose}
            onBack={() => setMode('choose')}
          />
        )}

        {mode === 'select' && (
          <>
            <h3 className="mb-4 text-lg font-semibold text-zinc-900">Add from Active Ventures</h3>
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </div>
            )}
            {loading ? (
              <div className="py-8 text-center text-sm text-zinc-500">Loading…</div>
            ) : ventures.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <p className="text-sm font-medium text-zinc-700">No active ventures on the timeline</p>
                <p className="mt-1 text-sm text-zinc-500">Add ventures in the Active Ventures section above first.</p>
              </div>
            ) : (
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {ventures.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleMoveToSupport(v)}
                    disabled={submitting}
                    className="w-full rounded-lg border border-zinc-200 px-4 py-2.5 text-left text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => { setMode('choose'); setError(null); }}
              className="mt-4 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function AddSupportVentureForm({
  onAdded,
  onCancel,
  onBack,
}: {
  onAdded: () => void;
  onCancel: () => void;
  onBack?: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [oneMetric, setOneMetric] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          status: 'support',
          timeline_visible: true,
          notes: notes.trim() || null,
          one_metric_that_matters: oneMetric.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        onAdded();
      } else {
        const errMsg = typeof data?.error === 'string' ? data.error : 'Failed to add support venture';
        setError(errMsg);
        toast.show(errMsg);
        if (process.env.NODE_ENV === 'development') console.error('Support venture POST failed:', data);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to add support venture';
      setError(msg);
      toast.show(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <h3 className="mb-4 text-lg font-semibold text-zinc-900">Add new support venture</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            placeholder="Venture name"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            placeholder="Any notes..."
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">One metric that matters (optional)</label>
          <input
            type="text"
            value={oneMetric}
            onChange={(e) => setOneMetric(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            placeholder="e.g. Monthly recurring revenue"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!name.trim() || submitting}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            Add
          </button>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Back
            </button>
          )}
          {!onBack && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </>
  );
}
