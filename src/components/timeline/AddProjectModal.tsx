'use client';

import { useState, useEffect } from 'react';
import type { Venture } from '@/types';

async function applyTimelineTemplate(ventureId: number): Promise<void> {
  const res = await fetch(`/api/ventures/${ventureId}/apply-timeline-template`, {
    method: 'POST',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to apply template');
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
  const [mode, setMode] = useState<'choose' | 'new' | 'select'>('choose');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [ventures, setVentures] = useState<Venture[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && mode === 'select') {
      setLoading(true);
      fetch('/api/ventures')
        .then((r) => r.json())
        .then((data: Venture[] | { error?: string }) => {
          const list = Array.isArray(data) ? data : [];
          const filtered = list.filter(
            (v) =>
              (v.status === 'backlog' || v.status === 'active') &&
              v.timeline_visible !== true
          );
          setVentures(filtered);
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, mode]);

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

  const handleSelect = async (v: Venture) => {
    setError(null);
    setSubmitting(true);
    setSubmittingId(v.id);
    try {
      const res = await fetch(`/api/ventures/${v.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeline_visible: true }),
      });
      const data = await res.json();
      if (res.ok) {
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
      } else {
        setError(data.error || 'Failed to add project');
      }
    } catch (err) {
      console.error(err);
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
      setSubmittingId(null);
    }
  };

  const handleClose = () => {
    setMode('choose');
    setName('');
    setNotes('');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {mode === 'choose' && (
          <>
            <h3 className="mb-4 text-lg font-semibold text-zinc-900">Add project</h3>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setMode('new')}
                className="rounded-lg border border-zinc-200 px-4 py-3 text-left text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                Add a new project
              </button>
              <button
                onClick={() => setMode('select')}
                className="rounded-lg border border-zinc-200 px-4 py-3 text-left text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                Select from Venture Tracker
              </button>
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
                  placeholder="Project name"
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
            </div>
            {error && (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            )}
            <p className="mt-2 text-xs text-zinc-500">
              Template: Explore 2mo → Validate 1mo → Define 1mo → Build 2mo → Spin out 1mo + placeholder milestone
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
            <h3 className="mb-4 text-lg font-semibold text-zinc-900">Select from Venture Tracker</h3>
            {error && (
              <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            )}
            {loading ? (
              <div className="py-8 text-center text-sm text-zinc-500">Loading…</div>
            ) : ventures.length === 0 ? (
              <p className="py-4 text-sm text-zinc-500">
                No exploration projects available. All have been added to the timeline, or create a new one.
              </p>
            ) : (
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {ventures.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelect(v);
                    }}
                    disabled={submitting}
                    className="w-full rounded-lg border border-zinc-200 px-4 py-2.5 text-left text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
                  >
                    {submittingId === v.id ? 'Adding…' : v.name}
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
      </div>
    </div>
  );
}
