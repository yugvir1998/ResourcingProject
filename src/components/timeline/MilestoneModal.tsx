'use client';

import { useState, useEffect } from 'react';
import type { HiringMilestone } from '@/types';

function getDisplayLabel(m: HiringMilestone): string {
  if (m.label && m.label.trim()) return m.label.trim();
  const roleLabels: Record<string, string> = {
    ceo: 'Hire CEO',
    founding_engineer: 'Hire Founding engineer',
    other: 'Milestone',
  };
  return roleLabels[m.role_type] || m.role_type || 'Milestone';
}

interface MilestoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  ventureId: number;
  mode: 'add' | 'edit';
  initialDate?: string;
  milestone?: HiringMilestone;
  onSave: (milestone: HiringMilestone) => void;
  onDelete?: (id: number) => void;
}

export function MilestoneModal({
  isOpen,
  onClose,
  ventureId,
  mode,
  initialDate,
  milestone,
  onSave,
  onDelete,
}: MilestoneModalProps) {
  const [label, setLabel] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && milestone) {
        setLabel(getDisplayLabel(milestone));
        setTargetDate(milestone.target_date);
        setNotes(milestone.notes || '');
      } else {
        setLabel('');
        setTargetDate(initialDate || new Date().toISOString().slice(0, 10));
        setNotes('');
      }
    }
  }, [isOpen, mode, milestone, initialDate]);

  const handleSave = async () => {
    if (!targetDate.trim()) return;
    setSaving(true);
    try {
      const payload = {
        label: label.trim() || null,
        target_date: targetDate,
        notes: notes.trim() || null,
      };
      if (mode === 'edit' && milestone) {
        const res = await fetch(`/api/hiring-milestones/${milestone.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const updated = await res.json();
          onSave(updated);
          onClose();
        }
      } else {
        const res = await fetch('/api/hiring-milestones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            venture_id: ventureId,
            ...payload,
          }),
        });
        if (res.ok) {
          const created = await res.json();
          onSave(created);
          onClose();
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (mode !== 'edit' || !milestone || !onDelete) return;
    if (!confirm('Delete this milestone?')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/hiring-milestones/${milestone.id}`, { method: 'DELETE' });
      if (res.ok) {
        onDelete(milestone.id);
        onClose();
      }
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/25 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed left-1/2 top-1/2 z-50 w-96 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-zinc-100 px-5 py-4">
          <h3 className="text-base font-semibold text-zinc-900">
            {mode === 'edit' ? 'Edit milestone' : 'Add milestone'}
          </h3>
          <p className="mt-0.5 text-sm text-zinc-500">
            {mode === 'edit' ? 'Update the label and date or remove it.' : 'Create a milestone with any label you want.'}
          </p>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Hire CEO, Launch, Fundraise close..."
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">Date</label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional details..."
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-zinc-100 px-5 py-4">
          <div>
            {mode === 'edit' && onDelete && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete milestone'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !targetDate}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
