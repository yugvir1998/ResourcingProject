import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ventureId = searchParams.get('ventureId');
  const employeeId = searchParams.get('employeeId');
  const phaseId = searchParams.get('phaseId');

  let query = getSupabase()
    .from('allocations')
    .select('*')
    .order('week_start', { ascending: true });

  if (ventureId) {
    query = query.eq('venture_id', parseInt(ventureId, 10));
  }
  if (employeeId) {
    query = query.eq('employee_id', parseInt(employeeId, 10));
  }
  if (phaseId) {
    query = query.eq('phase_id', parseInt(phaseId, 10));
  }
  if (!ventureId && !employeeId) {
    query = query.order('venture_id', { ascending: true });
  }

  const { data, error } = await query;

  if (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
  return NextResponse.json(data || []);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { employee_id, venture_id, phase_id, fte_percentage, week_start, notes } = body;

    if (!employee_id || !venture_id || fte_percentage == null || !week_start) {
      return NextResponse.json(
        { error: 'employee_id, venture_id, fte_percentage, week_start required' },
        { status: 400 }
      );
    }

    // Pre-exploration (exploration_staging) ventures: enforce 5% per project
    let effectiveFte = Math.min(100, Math.max(0, Number(fte_percentage))) || 0;
    const { data: ventureRow } = await getSupabase()
      .from('ventures')
      .select('status')
      .eq('id', venture_id)
      .is('deleted_at', null)
      .maybeSingle();
    if (!ventureRow) {
      return NextResponse.json({ error: 'Venture not found' }, { status: 404 });
    }
    if (ventureRow.status === 'exploration_staging') {
      effectiveFte = 5;
    }

    const insertPayload: Record<string, unknown> = {
      employee_id,
      venture_id,
      fte_percentage: effectiveFte,
      week_start,
      notes: notes || null,
    };
    if (phase_id != null) insertPayload.phase_id = phase_id;

    const { data, error } = await getSupabase()
      .from('allocations')
      .insert(insertPayload as Record<string, unknown>)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (e) {
    const err = e as { message?: string };
    console.error(e);
    const msg = err?.message || 'Failed to create allocation';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Bulk-delete all allocations for a venture (e.g. "Remove from timeline" clears planning rows). */
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const ventureId = searchParams.get('ventureId');
  if (!ventureId) {
    return NextResponse.json({ error: 'ventureId query parameter required' }, { status: 400 });
  }
  const vid = parseInt(ventureId, 10);
  if (Number.isNaN(vid)) {
    return NextResponse.json({ error: 'Invalid ventureId' }, { status: 400 });
  }
  const { error } = await getSupabase().from('allocations').delete().eq('venture_id', vid);
  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message || 'Failed to delete allocations' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
