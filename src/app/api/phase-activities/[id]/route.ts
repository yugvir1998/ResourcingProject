import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const allowed = ['name', 'start_date', 'end_date', 'sort_order'];
  const updates: Record<string, unknown> = {};

  for (const key of allowed) {
    if (key in body) {
      updates[key] = body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    const { data } = await getSupabase().from('phase_activities').select('*').eq('id', parseInt(id, 10)).single();
    return NextResponse.json(data);
  }

  const { data, error } = await getSupabase()
    .from('phase_activities')
    .update(updates)
    .eq('id', parseInt(id, 10))
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
  const { error } = await getSupabase().from('phase_activities').delete().eq('id', parseInt(id, 10));
  if (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
