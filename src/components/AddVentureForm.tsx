'use client';

import { useState, useEffect } from 'react';
import { useToast } from './Toast';

interface AddVentureFormProps {
  onAdded: () => void;
}

interface Employee {
  id: number;
  name: string;
}

export function AddVentureForm({ onAdded }: AddVentureFormProps) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [primaryContactId, setPrimaryContactId] = useState<number | null>(null);
  const [notionLink, setNotionLink] = useState('');
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    if (show) {
      fetch('/api/employees')
        .then((r) => r.json())
        .then((data: Employee[] | { error?: string }) => {
          setEmployees(Array.isArray(data) ? data : []);
        });
    }
  }, [show]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/ventures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          status: 'backlog',
          backlog_priority: 999,
          notes: notes.trim() || null,
          next_steps: nextSteps.trim() || null,
          primary_contact_id: primaryContactId || null,
          notion_link: notionLink.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setName('');
        setNotes('');
        setNextSteps('');
        setPrimaryContactId(null);
        setNotionLink('');
        setShow(false);
        onAdded();
      } else {
        setError(typeof data?.error === 'string' ? data.error : 'Failed to add venture');
        toast.show(typeof data?.error === 'string' ? data.error : 'Failed to add venture');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to add venture';
      setError(msg);
      toast.show(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setShow(false);
    setName('');
    setNotes('');
    setNextSteps('');
    setPrimaryContactId(null);
    setNotionLink('');
    setError(null);
  };

  return (
    <div>
      <button
        onClick={() => setShow(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-500">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add venture
      </button>

      {show && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && handleCancel()}
        >
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md rounded-xl border border-zinc-200 border-l-4 border-l-slate-400/60 bg-white p-6 shadow-xl"
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
                  rows={3}
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
              {employees.length > 0 && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Project lead (optional)</label>
                  <select
                    value={primaryContactId ?? ''}
                    onChange={(e) => setPrimaryContactId(e.target.value ? parseInt(e.target.value, 10) : null)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  >
                    <option value="">None</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Notion link (optional)</label>
                <input
                  type="text"
                  value={notionLink}
                  onChange={(e) => setNotionLink(e.target.value)}
                  placeholder="https://notion.so/..."
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm placeholder:text-zinc-400"
                />
                <p className="mt-0.5 text-xs text-zinc-500">Link to reading materials and docs</p>
              </div>
            </div>
            {error && (
              <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            )}
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
