'use client';

import { useState } from 'react';
import { useUndo } from '@/contexts/UndoContext';

export function CommandUndoToolbar() {
  const { canUndo, depth, peekLabel, undoLast } = useUndo();
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex items-center justify-end border-b border-zinc-200/80 pb-2">
      <button
        type="button"
        disabled={!canUndo || busy}
        title={peekLabel ? `Undo: ${peekLabel}` : 'Nothing to undo'}
        onClick={async () => {
          setBusy(true);
          try {
            await undoLast();
          } finally {
            setBusy(false);
          }
        }}
        className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M3 7v6h6" />
          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
        </svg>
        Undo
        {depth > 0 && (
          <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-zinc-600">
            {depth}
          </span>
        )}
      </button>
    </div>
  );
}
