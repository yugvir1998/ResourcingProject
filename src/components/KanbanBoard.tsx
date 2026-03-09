'use client';

import { useState, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import type { Venture, VenturePhase } from '@/types';

interface Employee {
  id: number;
  name: string;
}
import { useToast } from '@/components/Toast';
import { KanbanColumn } from './KanbanColumn';
import { VentureCard } from './VentureCard';

const BACKLOG_STANDARD_COLUMNS: { id: string; label: string; status: 'backlog'; designPartnerStatus: string }[] = [
  { id: 'backlog-coordinating', label: 'Coordinating', status: 'backlog', designPartnerStatus: 'coordinating' },
  { id: 'backlog-early-conversations', label: 'Early Conversations', status: 'backlog', designPartnerStatus: 'early_conversations' },
  { id: 'backlog-pitched-negotiating', label: 'Pitched / In Negotiations', status: 'backlog', designPartnerStatus: 'pitched_negotiating' },
  { id: 'backlog-signed-awaiting-start', label: 'Signed / Awaiting Start', status: 'backlog', designPartnerStatus: 'signed_awaiting_start' },
];

const BACKLOG_NO_PARTNER_COLUMNS: { id: string; label: string; status: 'backlog'; designPartnerStatus: string }[] = [
  { id: 'backlog-pre-vetting', label: 'Pre-Vetting', status: 'backlog', designPartnerStatus: 'pre_vetting' },
  { id: 'backlog-awaiting-start', label: 'Awaiting Start', status: 'backlog', designPartnerStatus: 'awaiting_start' },
];

const BACKLOG_COLUMNS = [...BACKLOG_STANDARD_COLUMNS, ...BACKLOG_NO_PARTNER_COLUMNS];

const PHASE_ORDER = ['explore', 'validate', 'define', 'build', 'spin_out', 'pause'] as const;
const ACTIVE_PHASE_COLUMNS: { id: string; label: string; phase: (typeof PHASE_ORDER)[number] | null }[] = [
  { id: 'phase-explore', label: 'Explore', phase: 'explore' },
  { id: 'phase-validate', label: 'Validate', phase: 'validate' },
  { id: 'phase-define', label: 'Define', phase: 'define' },
  { id: 'phase-build', label: 'Build', phase: 'build' },
  { id: 'phase-spin-out', label: 'Spin out', phase: 'spin_out' },
  { id: 'phase-paused', label: 'Paused', phase: 'pause' },
  { id: 'phase-unplanned', label: '—', phase: null },
];

interface KanbanBoardProps {
  refreshTrigger?: number;
}

function getCurrentPhaseForVenture(venturePhases: VenturePhase[]): (typeof PHASE_ORDER)[number] | null {
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
      return (p.phase === 'pause' ? 'pause' : p.phase) as (typeof PHASE_ORDER)[number];
    }
  }
  return null;
}

export function KanbanBoard({ refreshTrigger }: KanbanBoardProps) {
  const [ventures, setVentures] = useState<Venture[]>([]);
  const [venturePhases, setVenturePhases] = useState<VenturePhase[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const fetchVentures = async () => {
    const res = await fetch('/api/ventures');
    const data = await res.json();
    setVentures(data);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [vRes, pRes, eRes] = await Promise.all([
        fetch('/api/ventures'),
        fetch('/api/venture-phases'),
        fetch('/api/employees'),
      ]);
      const [vData, pData, eData] = await Promise.all([vRes.json(), pRes.json(), eRes.json()]);
      if (!cancelled) {
        setVentures(vData);
        setVenturePhases(pData || []);
        setEmployees(eData || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!loading && refreshTrigger != null && refreshTrigger > 0) {
      (async () => {
        const [vRes, pRes, eRes] = await Promise.all([
          fetch('/api/ventures'),
          fetch('/api/venture-phases'),
          fetch('/api/employees'),
        ]);
        const [vData, pData, eData] = await Promise.all([vRes.json(), pRes.json(), eRes.json()]);
        setVentures(vData);
        setVenturePhases(pData || []);
        setEmployees(eData || []);
      })();
    }
  }, [loading, refreshTrigger]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const backlogVentures = ventures.filter((v) => v.status === 'backlog');
  const activeVentures = ventures.filter(
    (v) => v.status === 'active' && !v.hidden_from_venture_tracker
  );
  const timelineVentures = ventures.filter(
    (v) => v.timeline_visible === true && !v.hidden_from_venture_tracker
  );

  const getBacklogByColumn = (designPartnerStatus: string | null) => {
    return backlogVentures
      .filter((v) => (v.design_partner_status || 'coordinating') === (designPartnerStatus || 'coordinating'))
      .sort((a, b) => a.backlog_priority - b.backlog_priority);
  };

  const handleGreenlight = async (id: number) => {
    const ok = await updateVenture(id, {
      timeline_visible: true,
      status: 'active',
      exploration_phase: 'discovery',
    });
    if (ok) {
      // Apply timeline template (phases) if none exist
      try {
        const phasesRes = await fetch(`/api/venture-phases?ventureId=${id}`);
        const phases = await phasesRes.json();
        if (Array.isArray(phases) && phases.length === 0) {
          await fetch(`/api/ventures/${id}/apply-timeline-template`, { method: 'POST' });
        }
      } catch {
        // Non-fatal; phases can be added manually
      }
      toast.show('Project added to Active Ventures');
    }
  };

  const handleHideFromVentureTracker = async (id: number) => {
    const ok = await updateVenture(id, { hidden_from_venture_tracker: true });
    if (ok) {
      toast.show('Project hidden from Venture Tracker (still on Active Ventures)');
    }
  };

  const ventureCurrentPhase = new Map<number, (typeof PHASE_ORDER)[number] | null>();
  for (const v of timelineVentures) {
    const vPhases = venturePhases.filter((p) => p.venture_id === v.id);
    ventureCurrentPhase.set(v.id, getCurrentPhaseForVenture(vPhases));
  }

  const getActiveByPhase = (phase: (typeof PHASE_ORDER)[number] | null) => {
    return timelineVentures.filter((v) => ventureCurrentPhase.get(v.id) === phase);
  };

  const getPrimaryContact = (venture: Venture) => {
    const id = venture.primary_contact_id;
    if (!id) return null;
    const emp = employees.find((e) => e.id === id);
    return emp ? { id: emp.id, name: emp.name } : null;
  };

  const updateVenture = async (id: number, updates: Partial<Venture>): Promise<boolean> => {
    const prev = ventures.find((v) => v.id === id);
    if (prev) setVentures((p) => p.map((v) => (v.id === id ? { ...v, ...updates } : v)));
    const res = await fetch(`/api/ventures/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (res.ok) {
      setVentures((p) => p.map((v) => (v.id === id ? data : v)));
      return true;
    }
    if (prev) setVentures((p) => p.map((v) => (v.id === id ? prev : v)));
    toast.show(data.error || 'Failed to save changes');
    return false;
  };

  const deleteVenture = async (id: number): Promise<boolean> => {
    const removed = ventures.find((v) => v.id === id);
    if (removed) setVentures((p) => p.filter((v) => v.id !== id));
    const res = await fetch(`/api/ventures/${id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return true;
    if (removed) setVentures((p) => [...p, removed].sort((a, b) => a.backlog_priority - b.backlog_priority));
    toast.show(data.error || 'Failed to delete venture');
    return false;
  };

  const reorderBacklog = async (ids: number[]) => {
    await fetch('/api/ventures/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ventureIds: ids }),
    });
    await fetchVentures();
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const ventureId = typeof active.id === 'string' && active.id.startsWith('card-')
      ? parseInt(active.id.replace('card-', ''), 10)
      : (active.id as number);
    const venture = ventures.find((v) => v.id === ventureId);
    if (!venture) return;

    const overId = String(over.id);

    // Dropped on a column (empty area)
    const targetBacklogCol = BACKLOG_COLUMNS.find((c) => c.id === overId);
    const targetActiveCol = ACTIVE_PHASE_COLUMNS.find((c) => c.id === overId);

    if (targetBacklogCol) {
      updateVenture(ventureId, { status: 'backlog', design_partner_status: targetBacklogCol.designPartnerStatus as Venture['design_partner_status'] });
      return;
    }
    if (targetActiveCol) {
      // Phase columns are read-only: do not move ventures between phases via drag
      return;
    }

    // Dropped on a card - get target venture to determine column
    const overVentureId = overId.startsWith('card-') ? parseInt(overId.replace('card-', ''), 10) : null;
    const overVenture = overVentureId ? ventures.find((v) => v.id === overVentureId) : null;

    if (venture.status === 'backlog' && overVenture?.status === 'backlog') {
      const targetStatus = overVenture.design_partner_status || 'coordinating';
      const items = getBacklogByColumn(targetStatus);
      const oldIndex = items.findIndex((v) => v.id === ventureId);
      const overIndex = items.findIndex((v) => v.id === overVentureId);
      if (oldIndex >= 0 && overIndex >= 0) {
        if (targetStatus !== (venture.design_partner_status || 'coordinating')) {
          updateVenture(ventureId, { design_partner_status: targetStatus as Venture['design_partner_status'] });
        } else if (oldIndex !== overIndex) {
          const reordered = arrayMove(items, oldIndex, overIndex);
          reorderBacklog(reordered.map((v) => v.id));
        }
      } else if (targetStatus !== (venture.design_partner_status || 'coordinating')) {
        updateVenture(ventureId, { design_partner_status: targetStatus as Venture['design_partner_status'] });
      }
      return;
    }

    if (venture.status === 'active' && overVenture?.status === 'active') {
      // Phase columns are read-only: do not move ventures between phases via drag
      return;
    }

    // Cross-status: backlog card dropped on active card or vice versa
    if (venture.status === 'backlog' && overVenture?.status === 'active') {
      updateVenture(ventureId, { status: 'active', exploration_phase: (overVenture.exploration_phase || 'discovery') as Venture['exploration_phase'] });
    } else if (venture.status === 'active' && overVenture?.status === 'backlog') {
      updateVenture(ventureId, { status: 'backlog', design_partner_status: (overVenture.design_partner_status || 'coordinating') as Venture['design_partner_status'] });
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <section>
          <div className="mb-4 h-6 w-32 animate-pulse rounded bg-zinc-200" />
          <div className="flex gap-4 overflow-x-auto pb-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="min-w-[260px] animate-pulse rounded-xl border-2 border-zinc-200 bg-zinc-50/50 p-4">
                <div className="mb-3 h-4 w-24 rounded bg-zinc-200" />
                <div className="space-y-2">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="h-16 rounded-lg bg-zinc-100" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
        <section>
          <div className="mb-4 h-6 w-40 animate-pulse rounded bg-zinc-200" />
          <div className="flex gap-4 overflow-x-auto pb-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="min-w-[260px] animate-pulse rounded-xl border-2 border-zinc-200 bg-zinc-50/50 p-4">
                <div className="mb-3 h-4 w-28 rounded bg-zinc-200" />
                <div className="space-y-2">
                  {[1, 2].map((j) => (
                    <div key={j} className="h-16 rounded-lg bg-zinc-100" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-zinc-800">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            Backlog
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">With design partner</h3>
              <div className="flex gap-4 overflow-x-auto pb-4">
                {BACKLOG_STANDARD_COLUMNS.map((col) => (
                  <KanbanColumn
                    key={col.id}
                    id={col.id}
                    title={col.label}
                    ventures={getBacklogByColumn(col.designPartnerStatus)}
                    variant="backlog"
                    renderCard={(v) => (
                      <VentureCard
                        key={v.id}
                        venture={v}
                        primaryContact={getPrimaryContact(v)}
                        employees={employees}
                        onUpdate={updateVenture}
                        onDelete={deleteVenture}
                        onGreenlight={handleGreenlight}
                      />
                    )}
                  />
                ))}
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">No design partner</h3>
              <div className="flex gap-4 overflow-x-auto pb-4">
                {BACKLOG_NO_PARTNER_COLUMNS.map((col) => (
                  <KanbanColumn
                    key={col.id}
                    id={col.id}
                    title={col.label}
                    ventures={getBacklogByColumn(col.designPartnerStatus)}
                    variant="backlog"
                    renderCard={(v) => (
                      <VentureCard
                        key={v.id}
                        venture={v}
                        primaryContact={getPrimaryContact(v)}
                        employees={employees}
                        onUpdate={updateVenture}
                        onDelete={deleteVenture}
                        onGreenlight={handleGreenlight}
                      />
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-zinc-800">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Active ventures by phase
          </h2>
          <p className="mb-4 text-sm text-zinc-500">
            Ventures are grouped by their current phase on the timeline. Phases cannot be changed by dragging here.
          </p>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {ACTIVE_PHASE_COLUMNS.map((col) => (
              <KanbanColumn
                key={col.id}
                id={col.id}
                title={col.label}
                ventures={getActiveByPhase(col.phase)}
                variant="active"
                renderCard={(v) => (
                  <VentureCard
                    key={v.id}
                    venture={v}
                    primaryContact={getPrimaryContact(v)}
                    employees={employees}
                    onUpdate={updateVenture}
                    onDelete={deleteVenture}
                    onGreenlight={handleGreenlight}
                    onHideFromVentureTracker={handleHideFromVentureTracker}
                  />
                )}
              />
            ))}
          </div>
        </section>
      </DndContext>
    </div>
  );
}
