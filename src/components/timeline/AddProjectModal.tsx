'use client';

import { useState, useEffect } from 'react';
import type { Venture } from '@/types';

async function applyTimelineTemplate(ventureId: number): Promise<void> {
  const res = await fetch(`/api/ventures/${ventureId}/apply-timeline-template`, {
    method: 'POST',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = data.error || 'Failed to apply template';
    throw new Error(data.hint ? `${msg}. ${data.hint}` : msg);
  }
  // Add placeholder milestone
  const today = new Date();
  const milestoneDate = new Date(today);
  milestoneDate.setDate(milestoneDate.getDate() + 90);
  await fetch('/api/hiring-milestones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      venture_id: ventureId,
      role_type: 'other',
      label: 'Milestone',
      target_date: milestoneDate.toISOString().slice(0, 10),
    }),
  });
}

interface AddProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdded: (ventureId?: number, venture?: Venture) => void | Promise<void>;
}

export function AddProjectModal({ isOpen, onClose, onAdded }: AddProjectModalProps) {
  const [mode, setMode] = useState<'choose' | 'new' | 'select' | 'selectChoice'>('choose');
  const [selectedVenture, setSelectedVenture] = useState<Venture | null>(null);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [primaryContactId, setPrimaryContactId] = useState<string>('');
  const [notionLink, setNotionLink] = useState('');
  const [ventures, setVentures] = useState<Venture[]>([]);
  const [employees, setEmployees] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && mode === 'select') {
      setLoading(true);
      fetch('/api/ventures')
        .then((r) => r.json())
        .then((data: Venture[] | { error?: string }) => {
          const list = Array.isArray(data) ? data : [];
          const filtered = list.filter((v) => v.status === 'exploration_staging');
          setVentures(filtered);
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, mode]);

  useEffect(() => {
    if (isOpen && mode === 'new') {
      fetch('/api/employees')
        .then((r) => r.json())
        .then((data: { id: number; name: string }[] | { error?: string }) => {
          setEmployees(Array.isArray(data) ? data : []);
        });
    }
  }, [isOpen, mode]);

  const promoteFromExploration = async (v: Venture, choice: 'active' | 'planned') => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/ventures/${v.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: choice === 'active' ? 'active' : v.status,
          timeline_visible: true,
          exploration_phase: 'discovery',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to add project');
        return;
      }
      const phasesRes = await fetch(`/api/venture-phases?ventureId=${v.id}`);
      const phases = await phasesRes.json();
      if (Array.isArray(phases) && phases.length === 0) {
        try {
          await applyTimelineTemplate(v.id);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to apply timeline template');
          return;
        }
      }
      const updatedVenture = { ...data, timeline_visible: true };
      await onAdded(v.id, updatedVenture);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/ventures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          notes: notes.trim() || null,
          next_steps: nextSteps.trim() || null,
          primary_contact_id: primaryContactId ? parseInt(primaryContactId, 10) : null,
          notion_link: notionLink.trim() || null,
          status: 'backlog',
          backlog_priority: 999,
          timeline_visible: true,
        }),
      });
      const venture = await res.json();
      if (res.ok) {
        try {
          await applyTimelineTemplate(venture.id);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to apply timeline template');
          return;
        }
        const fullVenture = { ...venture, timeline_visible: true };
        await onAdded(venture.id, fullVenture);
        handleClose();
      } else {
        setError(venture.error || 'Failed to create project');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectVenture = (v: Venture) => {
    setSelectedVenture(v);
    setMode('selectChoice');
  };

  const handleClose = () => {
    setMode('choose');
    setSelectedVenture(null);
    setName('');
    setNotes('');
    setNextSteps('');
    setPrimaryContactId('');
    setNotionLink('');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {mode === 'choose' && (
          <>
            <h3 className="mb-4 text-lg font-semibold text-zinc-900">Add project</h3>
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Add new</p>
                <button
                  onClick={() => setMode('new')}
                  className="w-full rounded-lg border border-zinc-200 px-4 py-3 text-left text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                >
                  Add a new project
                </button>
              </div>
              <div className="border-t border-zinc-200 pt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Add from Exploration Staging</p>
                <button
                  onClick={() => setMode('select')}
                  className="w-full rounded-lg border border-zinc-200 px-4 py-3 text-left text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                >
                  Add from Exploration Staging
                </button>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="mt-4 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
            >
              Cancel
            </button>
          </>
        )}

        {mode === 'new' && (
          <form onSubmit={handleAddNew}>
            <h3 className="mb-4 text-lg font-semibold text-zinc-900">Add new project</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm placeholder:text-zinc-400"
                  placeholder="Venture name"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
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
                <label className="mb-1 block text-sm font-medium text-zinc-700">Primary contact (optional)</label>
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
                <label className="mb-1 block text-sm font-medium text-zinc-700">Notion link (optional)</label>
                <input
                  type="text"
                  value={notionLink}
                  onChange={(e) => setNotionLink(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm placeholder:text-zinc-400"
                  placeholder="https://..."
                />
              </div>
            </div>
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </div>
            )}
            <p className="mt-2 text-xs text-zinc-500">
              Template: Explore 2mo → Concept 2mo → Build 2mo → Spin out 2mo → Support 6mo + placeholder milestone
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={submitting || !name.trim()}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {submitting ? 'Adding…' : 'Add'}
              </button>
              <button
                type="button"
                onClick={() => setMode('choose')}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
              >
                Back
              </button>
            </div>
          </form>
        )}

        {mode === 'select' && (
          <>
            <h3 className="mb-4 text-lg font-semibold text-zinc-900">Add from Exploration Staging</h3>
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </div>
            )}
            {loading ? (
              <div className="py-8 text-center text-sm text-zinc-500">Loading…</div>
            ) : ventures.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-zinc-700">No ventures in Exploration Staging</p>
                <p className="mt-1 text-sm text-zinc-500">Add ventures in the Exploration Staging section above, or create a new one.</p>
              </div>
            ) : (
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {ventures.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelectVenture(v);
                    }}
                    disabled={submitting}
                    className="w-full rounded-lg border border-zinc-200 px-4 py-2.5 text-left text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setMode('choose')}
              className="mt-4 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
            >
              Back
            </button>
          </>
        )}

        {mode === 'selectChoice' && selectedVenture && (
          <>
            <h3 className="mb-4 text-lg font-semibold text-zinc-900">Add &quot;{selectedVenture.name}&quot; to timeline</h3>
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </div>
            )}
            <p className="mb-4 text-sm text-zinc-600">Choose how to add this project:</p>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => promoteFromExploration(selectedVenture, 'active')}
                disabled={submitting}
                className="w-full rounded-lg border-2 border-emerald-200 bg-emerald-50 px-4 py-3 text-left text-sm font-medium text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50"
              >
                <span className="font-semibold">Greenlight</span> – Fully active project on the timeline
              </button>
              <button
                type="button"
                onClick={() => promoteFromExploration(selectedVenture, 'planned')}
                disabled={submitting}
                className="w-full rounded-lg border border-zinc-200 px-4 py-3 text-left text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
              >
                <span className="font-semibold">Plan</span> – Tentative project (grayed out) until you greenlight it
              </button>
            </div>
            <button
              onClick={() => { setMode('select'); setSelectedVenture(null); }}
              className="mt-4 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
            >
              Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
