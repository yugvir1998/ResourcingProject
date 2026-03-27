import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

type AllocationRow = {
  id: number;
  employee_id: number;
  venture_id: number;
  phase_id: number | null;
  fte_percentage: number;
  week_start: string;
};

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fix = searchParams.get('fix') === 'true';
    const supabase = getSupabase();

    const { data: allocations, error: allocError } = await supabase
      .from('allocations')
      .select('id, employee_id, venture_id, phase_id, fte_percentage, week_start')
      .order('id', { ascending: true });

    if (allocError) throw allocError;
    const allocs = (allocations || []) as AllocationRow[];

    const { data: phases } = await supabase.from('venture_phases').select('id');
    const validPhaseIds = new Set((phases || []).map((p: { id: number }) => p.id));

    const { data: ventures } = await supabase.from('ventures').select('id').is('deleted_at', null);
    const validVentureIds = new Set((ventures || []).map((v: { id: number }) => v.id));

    const { data: employees } = await supabase.from('employees').select('id');
    const validEmployeeIds = new Set((employees || []).map((e: { id: number }) => e.id));

    const orphanedPhase: number[] = [];
    const orphanedVenture: number[] = [];
    const orphanedEmployee: number[] = [];

    for (const a of allocs) {
      if (a.phase_id != null && !validPhaseIds.has(a.phase_id)) {
        orphanedPhase.push(a.id);
      }
      if (!validVentureIds.has(a.venture_id)) {
        orphanedVenture.push(a.id);
      }
      if (!validEmployeeIds.has(a.employee_id)) {
        orphanedEmployee.push(a.id);
      }
    }

    const key = (a: AllocationRow) =>
      `${a.employee_id}:${a.venture_id}:${a.week_start}:${a.phase_id ?? -1}`;
    const byKey = new Map<string, AllocationRow[]>();
    for (const a of allocs) {
      if (orphanedPhase.includes(a.id) || orphanedVenture.includes(a.id) || orphanedEmployee.includes(a.id)) {
        continue;
      }
      const k = key(a);
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k)!.push(a);
    }

    const duplicateGroups: {
      ids: number[];
      employee_id: number;
      venture_id: number;
      week_start: string;
      phase_id: number | null;
      totalFte: number;
    }[] = [];

    for (const [, group] of byKey) {
      if (group.length > 1) {
        const totalFte = group.reduce((sum, g) => sum + g.fte_percentage, 0);
        duplicateGroups.push({
          ids: group.map((g) => g.id),
          employee_id: group[0].employee_id,
          venture_id: group[0].venture_id,
          week_start: group[0].week_start,
          phase_id: group[0].phase_id,
          totalFte,
        });
      }
    }

    if (fix) {
      const orphanedIds = [...new Set([...orphanedPhase, ...orphanedVenture, ...orphanedEmployee])];
      for (const id of orphanedIds) {
        await supabase.from('allocations').delete().eq('id', id);
      }

      for (const group of duplicateGroups) {
        const [keep, ...remove] = group.ids;
        const mergedFte = Math.min(100, group.totalFte);
        await supabase
          .from('allocations')
          .update({ fte_percentage: mergedFte })
          .eq('id', keep);
        for (const r of remove) {
          await supabase.from('allocations').delete().eq('id', r);
        }
      }
    }

    return NextResponse.json({
      orphanedPhase: { allocationIds: orphanedPhase },
      orphanedVenture: { allocationIds: orphanedVenture },
      orphanedEmployee: { allocationIds: orphanedEmployee },
      duplicates: { groups: duplicateGroups },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Audit failed' }, { status: 500 });
  }
}
