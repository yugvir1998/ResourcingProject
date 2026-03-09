'use client';

import { useCallback, useState } from 'react';
import { KanbanBoard } from './KanbanBoard';
import { AddVentureForm } from './AddVentureForm';

export function ExplorationPageClient() {
  const [refreshKey, setRefreshKey] = useState(0);

  const onAdded = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Venture Tracker</h1>
          <p className="mt-0.5 text-sm text-zinc-500">Backlog and active ventures · Drag to reorder</p>
        </div>
        <AddVentureForm onAdded={onAdded} />
      </div>
      <KanbanBoard refreshTrigger={refreshKey} />
    </div>
  );
}
