'use client';

import { useCallback, useState } from 'react';
import { KanbanBoard } from '@/components/KanbanBoard';
import { AddVentureForm } from '@/components/AddVentureForm';
import { TimelineView } from '@/components/TimelineView';
import { BattlefieldSummary } from '@/components/BattlefieldSummary';
import { PeopleAllocationView } from '@/components/PeopleAllocationView';
import { TimelineSyncProvider } from '@/contexts/TimelineSyncContext';

export default function CommandCenterPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  const onAdded = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const onDeleted = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="space-y-10">
      <BattlefieldSummary />
      {/* Section 1: Backlog */}
      <section>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="mb-0.5 flex items-center gap-2 text-xl font-semibold tracking-tight text-zinc-900">
              <span className="h-2 w-2 rounded-full bg-slate-400" />
              Backlog
            </h2>
          </div>
          <AddVentureForm onAdded={onAdded} />
        </div>
        <KanbanBoard refreshTrigger={refreshKey} onVentureAddedToTimeline={onAdded} onVentureDeleted={onDeleted} />
      </section>

      <TimelineSyncProvider refreshTrigger={refreshKey}>
        {/* Section 2: Active Ventures (Timeline) + People view via toggle */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold tracking-tight text-zinc-900">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            Active Ventures
          </h2>
          <TimelineView defaultCollapsed showSectionHeader={false} refreshTrigger={refreshKey} onVentureDeleted={onDeleted} />
        </section>

        {/* Section 3: People Allocation */}
        <section>
          <PeopleAllocationView refreshTrigger={refreshKey} />
        </section>
      </TimelineSyncProvider>
    </div>
  );
}
