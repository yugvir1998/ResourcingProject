'use client';

import { useState } from 'react';

interface AddVentureFormProps {
  onAdded: () => void;
}

export function AddVentureForm({ onAdded }: AddVentureFormProps) {
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch('/api/ventures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        status: 'backlog',
        backlog_priority: 999,
        notes: notes.trim() || null,
        next_steps: nextSteps.trim() || null,
      }),
    });
    if (res.ok) {
      setName('');
      setNotes('');
      setNextSteps('');
      setShow(false);
      onAdded();
    }
    setSubmitting(false);
  };

  const handleCancel = () => {
    setShow(false);
    setName('');
    setNotes('');
    setNextSteps('');
  };

  return (
    <div>
      <button
        onClick={() => setShow(true)}
        className="inline-flex items-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 py-2.5 text-sm font-medium text-zinc-600 transition hover:border-slate-400 hover:bg-slate-50/80"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-500">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add venture
      </button>

      {show && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => e.target === e.currentTarget && handleCancel()}
        >
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md rounded-xl border border-zinc-200 border-l-4 border-l-slate-400/60 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-lg font-semibold text-zinc-900">Add venture</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Venture name"
                  required
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm placeholder:text-zinc-400"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any notes..."
                  rows={2}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm placeholder:text-zinc-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Next steps (optional)</label>
                <input
                  type="text"
                  value={nextSteps}
                  onChange={(e) => setNextSteps(e.target.value)}
                  placeholder="One line for next steps..."
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm placeholder:text-zinc-400"
                />
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button type="submit" disabled={submitting} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60">
                {submitting ? 'Adding…' : 'Add'}
              </button>
              <button type="button" onClick={handleCancel} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
