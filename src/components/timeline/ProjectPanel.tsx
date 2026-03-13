'use client';

import { useState } from 'react';
import type { Venture, VenturePhase, HiringMilestone, Employee, Allocation } from '@/types';
import { useToast } from '@/components/Toast';
import { DeleteVentureConfirmModal } from '@/components/DeleteVentureConfirmModal';

function MilestoneEditRow({
  milestone,
  onUpdate,
  onDelete,
  roleLabels,
}: {
  milestone: HiringMilestone;
  onUpdate: (id: number, updates: { target_date?: string; notes?: string | null }) => void;
  onDelete: (id: number) => void;
  roleLabels: Record<string, string>;
}) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(milestone.target_date);
  const [notes, setNotes] = useState(milestone.notes || '');

  const handleSave = () => {
    onUpdate(milestone.id, { target_date: date, notes: notes || null });
    setEditing(false);
  };

  return (
    <div className="flex items-center justify-between gap-2 rounded border border-amber-200 bg-amber-50/50 px-2 py-1.5 text-sm text-amber-900">
      {editing ? (
        <div className="flex flex-1 flex-col gap-1">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded border border-amber-300 px-1.5 py-0.5 text-xs"
          />
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes"
            className="rounded border border-amber-300 px-1.5 py-0.5 text-xs placeholder:text-zinc-400"
          />
          <div className="flex gap-1">
            <button
              onClick={handleSave}
              className="rounded bg-amber-600 px-2 py-0.5 text-xs text-white"
            >
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded border border-amber-300 px-2 py-0.5 text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <span>
            {milestone.label?.trim() || roleLabels[milestone.role_type] || milestone.role_type}: {milestone.target_date}
            {milestone.notes && ` (${milestone.notes})`}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setEditing(true)}
              className="text-zinc-500 hover:text-zinc-700"
              title="Edit"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              onClick={() => onDelete(milestone.id)}
              className="text-zinc-500 hover:text-red-600"
              title="Delete"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const PHASE_OPTIONS: Array<'explore' | 'shape' | 'build' | 'spin_out'> = [
  'explore',
  'shape',
  'build',
  'spin_out',
];
const ROLE_OPTIONS: Array<'ceo' | 'founding_engineer' | 'other'> = ['ceo', 'founding_engineer', 'other'];

const PHASE_LABELS: Record<string, string> = {
  explore: 'Explore',
  shape: 'Concept',
  build: 'Build',
  spin_out: 'Spin out',
};
const ROLE_LABELS: Record<string, string> = {
  ceo: 'CEO',
  founding_engineer: 'Founding engineer',
  other: 'Other',
};

function getWeekStart(d: Date): string {
  const d2 = new Date(d);
  const day = d2.getDay();
  const diff = d2.getDate() - day + (day === 0 ? -6 : 1);
  d2.setDate(diff);
  return d2.toISOString().slice(0, 10);
}

interface ProjectPanelProps {
  venture: Venture;
  phases: VenturePhase[];
  milestones: HiringMilestone[];
  allocations: Allocation[];
  employees: Employee[];
  onClose: () => void;
  onSave: (updates: {
    venture: Partial<Venture>;
    phases: VenturePhase[];
    milestones: HiringMilestone[];
    allocations: Allocation[];
  }) => void;
  onRemove: () => void;
  onDelete?: () => void | Promise<void>;
  onMoveToSupport?: () => void | Promise<void>;
  onGreenlight?: () => void | Promise<void>;
}

export function ProjectPanel({
  venture,
  phases,
  milestones,
  allocations,
  employees,
  onClose,
  onSave,
  onRemove,
  onDelete,
  onMoveToSupport,
  onGreenlight,
}: ProjectPanelProps) {
  const toast = useToast();
  const [name, setName] = useState(venture.name);
  const [notes, setNotes] = useState(venture.notes || '');
  const [nextSteps, setNextSteps] = useState(venture.next_steps || '');
  const [notionLink, setNotionLink] = useState(venture.notion_link || '');
  const [designPartner, setDesignPartner] = useState(venture.design_partner || '');
  const [tentativeStartDate, setTentativeStartDate] = useState(venture.tentative_start_date || '');
  const [oneMetric, setOneMetric] = useState(venture.one_metric_that_matters || '');
  const [primaryContactId, setPrimaryContactId] = useState<string>(venture.primary_contact_id ? String(venture.primary_contact_id) : '');
  const [localPhases, setLocalPhases] = useState<VenturePhase[]>(phases);
  const [localMilestones, setLocalMilestones] = useState<HiringMilestone[]>(milestones);
  const [localAllocations, setLocalAllocations] = useState<Allocation[]>(allocations);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleDeletePhase = async (id: number) => {
    const res = await fetch(`/api/venture-phases/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setLocalPhases((p) => p.filter((x) => x.id !== id));
    }
  };

  const handleDeleteMilestone = async (id: number) => {
    const res = await fetch(`/api/hiring-milestones/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setLocalMilestones((m) => m.filter((x) => x.id !== id));
    }
  };

  const handleUpdateMilestone = async (
    id: number,
    updates: { target_date?: string; notes?: string | null }
  ) => {
    const res = await fetch(`/api/hiring-milestones/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const updated = await res.json();
      setLocalMilestones((m) => m.map((x) => (x.id === id ? updated : x)));
    }
  };

  const handleAddPhase = async () => {
    const usedTypes = new Set(localPhases.map((p) => p.phase));
    const nextType = PHASE_OPTIONS.find((t) => !usedTypes.has(t)) || PHASE_OPTIONS[0];
    const today = new Date();
    const start = today.toISOString().slice(0, 10);
    const end = new Date(today);
    end.setDate(end.getDate() + 60);
    const res = await fetch('/api/venture-phases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        venture_id: venture.id,
        phase: nextType,
        start_date: start,
        end_date: end.toISOString().slice(0, 10),
        sort_order: localPhases.length,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setLocalPhases((p) => [...p, created].sort((a, b) => a.sort_order - b.sort_order));
    }
  };

  const handleAddMilestone = async () => {
    const today = new Date();
    today.setDate(today.getDate() + 90);
    const res = await fetch('/api/hiring-milestones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        venture_id: venture.id,
        role_type: 'ceo',
        target_date: today.toISOString().slice(0, 10),
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setLocalMilestones((m) => [...m, created].sort((a, b) => a.target_date.localeCompare(b.target_date)));
    }
  };

  const handleAddPerson = async (employeeId: number, phaseId: number) => {
    const weekStart = getWeekStart(new Date());
    const res = await fetch('/api/allocations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_id: employeeId,
        venture_id: venture.id,
        phase_id: phaseId,
        fte_percentage: 50,
        week_start: weekStart,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setLocalAllocations((a) => [...a, created]);
    }
  };

  const handleRemoveAllocation = async (id: number) => {
    const res = await fetch(`/api/allocations/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setLocalAllocations((a) => a.filter((x) => x.id !== id));
    }
  };

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/ventures/${venture.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          notes: notes.trim() || null,
          next_steps: nextSteps.trim() || null,
          notion_link: notionLink.trim() || null,
          design_partner: designPartner.trim() || null,
          tentative_start_date: tentativeStartDate || null,
          one_metric_that_matters: oneMetric.trim() || null,
          primary_contact_id: primaryContactId ? parseInt(primaryContactId, 10) : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        onSave({
          venture: {
            name: name.trim(),
            notes: notes.trim() || null,
            next_steps: nextSteps.trim() || null,
            notion_link: notionLink.trim() || null,
            design_partner: designPartner.trim() || null,
            tentative_start_date: tentativeStartDate || null,
            one_metric_that_matters: oneMetric.trim() || null,
            primary_contact_id: primaryContactId ? parseInt(primaryContactId, 10) : null,
          },
          phases: localPhases,
          milestones: localMilestones,
          allocations: localAllocations,
        });
        onClose();
      } else {
        const errMsg = typeof data?.error === 'string' ? data.error : 'Failed to save';
        setError(errMsg);
        toast.show(errMsg);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save';
      setError(msg);
      toast.show(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-zinc-200 p-4">
        <h3 id="edit-project-title" className="text-lg font-semibold text-zinc-900">Edit project</h3>
        <button
          onClick={onClose}
          className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {onGreenlight && (
            <button
              type="button"
              onClick={() => {
                onGreenlight();
                onClose();
              }}
              className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Greenlight project
            </button>
          )}
          {onMoveToSupport && (
            <button
              type="button"
              onClick={() => {
                onMoveToSupport();
                onClose();
              }}
              className="w-full rounded-lg border border-cyan-400 px-3 py-2 text-sm font-medium text-cyan-700 hover:bg-cyan-50"
            >
              Move to Support
            </button>
          )}
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
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm placeholder:text-zinc-400"
              placeholder="Venture name"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm placeholder:text-zinc-400"
              placeholder="Any notes..."
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Next steps (optional)</label>
            <input
              type="text"
              value={nextSteps}
              onChange={(e) => setNextSteps(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm placeholder:text-zinc-400"
              placeholder="e.g. Schedule design partner call"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Notion link (optional)</label>
            <input
              type="text"
              value={notionLink}
              onChange={(e) => setNotionLink(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm placeholder:text-zinc-400"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Design partner (optional)</label>
            <input
              type="text"
              value={designPartner}
              onChange={(e) => setDesignPartner(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm placeholder:text-zinc-400"
              placeholder="Company or contact name"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Tentative start date (optional)</label>
            <input
              type="date"
              value={tentativeStartDate}
              onChange={(e) => setTentativeStartDate(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm placeholder:text-zinc-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">One metric that matters (optional)</label>
            <input
              type="text"
              value={oneMetric}
              onChange={(e) => setOneMetric(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm placeholder:text-zinc-400"
              placeholder="e.g. Monthly recurring revenue"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Project lead (optional)</label>
            <select
              value={primaryContactId}
              onChange={(e) => setPrimaryContactId(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
            >
              <option value="">None</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-700">Phases</label>
              <button
                onClick={handleAddPhase}
                className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
              >
                + Add phase
              </button>
            </div>
            <div className="space-y-1">
              {localPhases.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded border border-zinc-200 px-2 py-1.5 text-sm"
                >
                  <span>{PHASE_LABELS[p.phase] || p.phase}</span>
                  <span className="text-zinc-500">
                    {p.start_date} → {p.end_date}
                  </span>
                  <button
                    onClick={() => handleDeletePhase(p.id)}
                    className="text-zinc-400 hover:text-red-600"
                    title="Delete phase"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-700">Milestones</label>
              <button
                onClick={handleAddMilestone}
                className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
              >
                + Add milestone
              </button>
            </div>
            <div className="space-y-1">
              {localMilestones.map((m) => (
                <MilestoneEditRow
                  key={m.id}
                  milestone={m}
                  onUpdate={handleUpdateMilestone}
                  onDelete={handleDeleteMilestone}
                  roleLabels={ROLE_LABELS}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">People (by phase)</label>
            <div className="max-h-64 space-y-3 overflow-y-auto overscroll-contain pr-1">
              {localPhases.map((phase) => {
                const phaseAllocations = localAllocations.filter((a) => a.phase_id === phase.id);
                const assignedInPhase = new Set(phaseAllocations.map((a) => a.employee_id));
                const availableInPhase = employees.filter((e) => !assignedInPhase.has(e.id));
                return (
                  <div key={phase.id} className="rounded border border-zinc-200 p-2">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-xs font-medium text-zinc-600">
                        {PHASE_LABELS[phase.phase] || phase.phase}
                      </span>
                      {availableInPhase.length > 0 && (
                        <select
                          onChange={(e) => {
                            const id = parseInt(e.target.value, 10);
                            if (id) handleAddPerson(id, phase.id);
                            e.target.value = '';
                          }}
                          className="rounded border border-zinc-200 px-1.5 py-0.5 text-xs text-zinc-900"
                        >
                          <option value="">+ Add</option>
                          {availableInPhase.map((emp) => (
                            <option key={emp.id} value={emp.id} className="text-zinc-900">
                              {emp.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div className="space-y-1">
                      {phaseAllocations.map((a) => {
                        const emp = employees.find((e) => e.id === a.employee_id);
                        return (
                          <div
                            key={a.id}
                            className="flex items-center justify-between rounded bg-zinc-50 px-2 py-1 text-xs"
                          >
                            <span className="text-zinc-900">{emp?.name || 'Unknown'}</span>
                            <span className="text-zinc-500">{a.fte_percentage}%</span>
                            <button
                              onClick={() => handleRemoveAllocation(a.id)}
                              className="text-zinc-400 hover:text-red-600"
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-zinc-200 p-4">
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={onRemove}
          className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Remove from timeline
        </button>
        {onDelete && (
          <button
            onClick={() => setShowDeleteModal(true)}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Delete project
          </button>
        )}
      </div>
      {onDelete && (
        <DeleteVentureConfirmModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={onDelete}
          ventureName={venture.name}
        />
      )}
    </div>
  );
}
