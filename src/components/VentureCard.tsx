'use client';

import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Venture } from '@/types';
import { DeleteVentureConfirmModal } from '@/components/DeleteVentureConfirmModal';

interface VentureCardProps {
  venture: Venture;
  primaryContact?: { id: number; name: string } | null;
  employees?: { id: number; name: string }[];
  onUpdate?: (id: number, updates: Partial<Venture>) => void | Promise<boolean>;
  onDelete?: (id: number) => void | Promise<boolean>;
  onGreenlight?: (id: number) => void | Promise<void>;
  onHideFromVentureTracker?: (id: number) => void | Promise<void>;
  onMoveToExplorationStaging?: (id: number) => void | Promise<void>;
  onMoveToSupport?: (id: number) => void | Promise<void>;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0]?.slice(0, 2).toUpperCase() || '?';
}

const CARD_ACCENT = {
  backlog: 'border-l-slate-400',
  active: 'border-l-amber-400',
};

export function VentureCard({ venture, primaryContact, employees = [], onUpdate, onDelete, onGreenlight, onHideFromVentureTracker, onMoveToExplorationStaging, onMoveToSupport }: VentureCardProps) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(venture.name);
  const [editNotes, setEditNotes] = useState(venture.notes || '');
  const [editNextSteps, setEditNextSteps] = useState(venture.next_steps || '');
  const [editPrimaryContactId, setEditPrimaryContactId] = useState<number | null>(venture.primary_contact_id ?? null);
  const [editNotionLink, setEditNotionLink] = useState(venture.notion_link || '');
  const [editDesignPartner, setEditDesignPartner] = useState(venture.design_partner || '');
  const [editTentativeStart, setEditTentativeStart] = useState(venture.tentative_start_date || '');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `card-${venture.id}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleSave = async () => {
    if (!onUpdate) return;
    const success = await onUpdate(venture.id, {
      name: editName.trim(),
      notes: editNotes.trim() || null,
      next_steps: editNextSteps.trim() || null,
      primary_contact_id: editPrimaryContactId,
      notion_link: editNotionLink.trim() || null,
      design_partner: editDesignPartner.trim() || null,
      tentative_start_date: editTentativeStart || null,
    });
    if (success !== false) setEditing(false);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    await onDelete?.(venture.id);
  };

  const handleGreenlight = (e: React.MouseEvent) => {
    e.stopPropagation();
    onGreenlight?.(venture.id);
  };

  const handleHideFromVentureTracker = (e: React.MouseEvent) => {
    e.stopPropagation();
    onHideFromVentureTracker?.(venture.id);
  };

  const handleMoveToExplorationStaging = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMoveToExplorationStaging?.(venture.id);
  };

  const handleMoveToSupport = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMoveToSupport?.(venture.id);
  };

  const canGreenlight =
    venture.status === 'backlog' &&
    (venture.design_partner_status === 'signed_awaiting_start' || venture.design_partner_status === 'awaiting_start') &&
    onGreenlight;

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={`group cursor-grab rounded-xl border border-zinc-200 border-l-4 bg-white shadow-sm ring-1 ring-zinc-900/5 transition-all active:cursor-grabbing hover:shadow-md ${
          venture.status === 'active' ? CARD_ACCENT.active : CARD_ACCENT.backlog
        } ${isDragging ? 'opacity-90 shadow-lg ring-2 ring-amber-400/50' : ''}`}
      >
        <div {...attributes} {...listeners} className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="font-medium text-zinc-900">{venture.name}</div>
                {primaryContact && (
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px] font-semibold text-amber-800"
                    title={primaryContact.name}
                  >
                    {getInitials(primaryContact.name)}
                  </span>
                )}
                {venture.notion_link && (
                  <a
                    href={venture.notion_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-zinc-400 hover:text-zinc-600"
                    title="Open Notion reading materials"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                )}
              </div>
              {venture.status === 'active' &&
                venture.exploration_phase === 'awaiting_build' &&
                onHideFromVentureTracker && (
                  <button
                    type="button"
                    onClick={handleHideFromVentureTracker}
                    className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                  >
                    Hide from this view
                  </button>
                )}
              {venture.notes && (
                <div className="mt-2 text-xs text-zinc-600 line-clamp-2">{venture.notes}</div>
              )}
              {venture.next_steps && (
                <div className="mt-1 text-xs text-zinc-500">
                  <span className="font-medium">Next:</span> {venture.next_steps}
                </div>
              )}
              {canGreenlight && (
                <button
                  type="button"
                  onClick={handleGreenlight}
                  className="mt-2 w-full rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                >
                  Greenlight this project
                </button>
              )}
              {venture.status === 'backlog' && onMoveToExplorationStaging && (
                <button
                  type="button"
                  onClick={handleMoveToExplorationStaging}
                  className="mt-2 w-full rounded-lg border border-teal-400 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-50"
                >
                  Move to Exploration Staging
                </button>
              )}
              {venture.status === 'active' && onMoveToSupport && (
                <button
                  type="button"
                  onClick={handleMoveToSupport}
                  className="mt-2 w-full rounded-lg border border-cyan-400 px-3 py-1.5 text-xs font-medium text-cyan-700 hover:bg-cyan-50"
                >
                  Move to Support
                </button>
              )}
            </div>
            <div className="flex shrink-0 gap-0.5 opacity-70 transition sm:opacity-0 sm:group-hover:opacity-100">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditName(venture.name);
                  setEditNotes(venture.notes || '');
                  setEditNextSteps(venture.next_steps || '');
                  setEditPrimaryContactId(venture.primary_contact_id ?? null);
                  setEditNotionLink(venture.notion_link || '');
                  setEditDesignPartner(venture.design_partner || '');
                  setEditTentativeStart(venture.tentative_start_date || '');
                  setEditing(true);
                }}
                className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                title="Edit"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                </svg>
              </button>
              {onDelete && (
                <button
                  type="button"
                  onClick={handleDeleteClick}
                  className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                  title="Delete"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {editing && onUpdate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" onClick={() => setEditing(false)}>
          <div
            className="w-full max-w-md rounded-xl border border-zinc-200 border-l-4 border-l-amber-400/60 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-lg font-semibold text-zinc-900">Edit venture</h3>
            <div className="space-y-4">
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
                  placeholder="One line for next steps..."
                />
              </div>
              {employees.length > 0 && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Gitwit POC (optional)</label>
                  <select
                    value={editPrimaryContactId ?? ''}
                    onChange={(e) => setEditPrimaryContactId(e.target.value ? parseInt(e.target.value, 10) : null)}
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
                  value={editNotionLink}
                  onChange={(e) => setEditNotionLink(e.target.value)}
                  placeholder="https://notion.so/..."
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
                <p className="mt-0.5 text-xs text-zinc-500">Link to reading materials and docs</p>
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
