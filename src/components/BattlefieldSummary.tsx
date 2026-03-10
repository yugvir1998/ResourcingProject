'use client';

import { useState, useEffect } from 'react';
import type { Venture, VenturePhase, Employee } from '@/types';

function getCurrentPhaseForVenture(venturePhases: VenturePhase[]): string | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sorted = [...venturePhases].sort(
    (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
  );
  for (const p of sorted) {
    const start = new Date(p.start_date);
    const end = new Date(p.end_date);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    if (today >= start && today <= end) {
      return p.phase === 'pause' ? 'pause' : p.phase;
    }
  }
  return null;
}

export function BattlefieldSummary() {
  const [ventures, setVentures] = useState<Venture[]>([]);
  const [venturePhases, setVenturePhases] = useState<VenturePhase[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/ventures').then((r) => r.json()),
      fetch('/api/venture-phases').then((r) => r.json()),
      fetch('/api/employees').then((r) => r.json()),
    ]).then(([v, p, e]) => {
      setVentures(v);
      setVenturePhases(p || []);
      setEmployees(e);
      setLoading(false);
    });
  }, []);

  const backlogCount = ventures.filter((x) => x.status === 'backlog').length;
  const activeCount = ventures.filter((x) => x.status === 'active').length;
  const supportCount = ventures.filter((v) => {
    const phases = venturePhases.filter((p) => p.venture_id === v.id);
    return getCurrentPhaseForVenture(phases) === 'support';
  }).length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-7 w-64 animate-pulse rounded bg-zinc-200" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-zinc-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm ring-1 ring-zinc-900/5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-zinc-300 bg-zinc-50">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-600">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <div>
            <div className="text-xl font-bold tabular-nums text-zinc-900">{backlogCount}</div>
            <div className="text-xs font-medium text-zinc-500">Backlog</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50/50 p-4 shadow-sm ring-1 ring-amber-200/30">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-amber-400 bg-amber-50">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-700">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div>
            <div className="text-xl font-bold tabular-nums text-amber-900">{activeCount}</div>
            <div className="text-xs font-medium text-amber-700">Active exploration</div>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm ring-1 ring-zinc-900/5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-zinc-300 bg-zinc-50">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-600">
              <path d="M12 2v4" />
              <path d="m4.93 4.93 2.83 2.83" />
              <path d="M2 12h4" />
              <path d="m4.93 19.07 2.83-2.83" />
              <path d="M12 18v4" />
              <path d="m19.07 19.07-2.83-2.83" />
              <path d="M18 12h4" />
              <path d="m19.07 4.93-2.83 2.83" />
            </svg>
          </div>
          <div>
            <div className="text-xl font-bold tabular-nums text-zinc-900">{supportCount}</div>
            <div className="text-xs font-medium text-zinc-500">Support</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm ring-1 ring-zinc-900/5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-emerald-400 bg-emerald-50">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-700">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <div className="text-xl font-bold tabular-nums text-zinc-900">{employees.length}</div>
            <div className="text-xs font-medium text-zinc-500">Team size</div>
          </div>
        </div>
      </div>
    </div>
  );
}
