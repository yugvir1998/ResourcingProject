import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const allocationId = parseInt(id, 10);
  const body = await request.json();

  const allowed = ['employee_id', 'venture_id', 'phase_id', 'fte_percentage', 'week_start', 'notes', 'context'];
  const updates: Record<string, unknown> = {};

  for (const key of allowed) {
    if (key in body) {
      updates[key] = body[key];
    }
  }
  if ('fte_percentage' in updates) {
    (updates as Record<string, number>).fte_percentage = Math.min(
      100,
      Math.max(0, Number((updates as Record<string, number>).fte_percentage) || 0)
    );
  }
  if ('context' in updates) {
    const nextContext = String(updates.context ?? '');
    if (nextContext !== 'pre_exploration' && nextContext !== 'planned') {
      return NextResponse.json({ error: 'Invalid context' }, { status: 400 });
    }
  }

  if (Object.keys(updates).length === 0) {
    const { data } = await getSupabase().from('allocations').select('*').eq('id', allocationId).single();
    return NextResponse.json(data);
  }

  if ('fte_percentage' in updates || 'context' in updates) {
    const { data: existing, error: existingError } = await getSupabase()
      .from('allocations')
      .select('context')
      .eq('id', allocationId)
      .single();
    if (existingError || !existing) {
      return NextResponse.json({ error: 'Allocation not found' }, { status: 404 });
    }
    const effectiveContext = (updates.context as string | undefined) ?? existing.context;
    if (effectiveContext === 'pre_exploration') {
      updates.fte_percentage = 5;
    }
  }

  const { data, error } = await getSupabase()
    .from('allocations')
    .update(updates)
    .eq('id', allocationId)
    .select()
    .single();

  if (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error } = await getSupabase().from('allocations').delete().eq('id', parseInt(id, 10));
  if (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
