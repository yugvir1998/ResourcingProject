'use client';

import { useCallback, useEffect, useState } from 'react';
import { KanbanBoard } from '@/components/KanbanBoard';
import { AddVentureForm } from '@/components/AddVentureForm';
import { TimelineView } from '@/components/TimelineView';
import { BattlefieldSummary } from '@/components/BattlefieldSummary';
import { ExplorationStagingSection } from '@/components/ExplorationStagingSection';
import { SupportVenturesSection } from '@/components/SupportVenturesSection';
import { TimelineSyncProvider } from '@/contexts/TimelineSyncContext';

export default function CommandCenterPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [backlogExpanded, setBacklogExpanded] = useState(false);
  const [backlogCount, setBacklogCount] = useState(0);

  const onAdded = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const onDeleted = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    fetch('/api/ventures')
      .then((r) => r.json())
      .then((data: { status: string }[]) => {
        setBacklogCount((data || []).filter((v) => v.status === 'backlog').length);
      })
      .catch(() => {});
  }, [refreshKey]);

  return (
    <div className="space-y-10">
      <BattlefieldSummary />
      {/* Section 1: Backlog (collapsible) - hidden from page */}
      {false && (
      <section>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => setBacklogExpanded((e) => !e)}
            className="flex items-center gap-2 text-left"
          >
            <h2 className="mb-0.5 flex items-center gap-2 text-xl font-semibold tracking-tight text-zinc-900">
              <span className="h-2 w-2 rounded-full bg-slate-400" />
              Backlog {backlogCount > 0 && `(${backlogCount})`}
            </h2>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`shrink-0 text-zinc-500 transition-transform ${backlogExpanded ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <AddVentureForm onAdded={onAdded} />
        </div>
        {backlogExpanded && (
          <div className="mt-4">
            <KanbanBoard refreshTrigger={refreshKey} onVentureAddedToTimeline={onAdded} onVentureDeleted={onDeleted} />
          </div>
        )}
      </section>
      )}

      {/* Section 2: Exploration Staging */}
      <ExplorationStagingSection refreshTrigger={refreshKey} onRefresh={onAdded} />

      <TimelineSyncProvider refreshTrigger={refreshKey}>
        {/* Section 3: Active Ventures (Timeline) */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold tracking-tight text-zinc-900">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            Active Ventures
          </h2>
          <TimelineView defaultCollapsed showSectionHeader={false} refreshTrigger={refreshKey} onVentureDeleted={onDeleted} />
        </section>

        {/* Section 4: Support Ventures */}
        <SupportVenturesSection refreshTrigger={refreshKey} onRefresh={onAdded} />
      </TimelineSyncProvider>
    </div>
  );
}
