import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { data, error } = await getSupabase()
    .from('ventures')
    .select('*')
    .eq('id', parseInt(id, 10))
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const allowed = ['name', 'status', 'backlog_priority', 'timeline_priority', 'design_partner_status', 'design_partner', 'exploration_phase', 'one_metric_that_matters', 'notes', 'next_steps', 'primary_contact_id', 'notion_link', 'timeline_visible', 'hidden_from_venture_tracker', 'tentative_start_date', 'is_greenlit', 'is_paused', 'is_active'];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  for (const key of allowed) {
    if (key in body) {
      updates[key] = body[key] ?? null;
    }
  }

  if (Object.keys(updates).length <= 1) {
    const { data } = await getSupabase().from('ventures').select('*').eq('id', parseInt(id, 10)).single();
    return NextResponse.json(data);
  }

  let { data, error } = await getSupabase()
    .from('ventures')
    .update(updates)
    .eq('id', parseInt(id, 10))
    .select()
    .single();

  if (error && (error.message?.includes('notes') || error.message?.includes('next_steps') || error.message?.includes('does not exist'))) {
    const safeUpdates: Record<string, unknown> = { updated_at: updates.updated_at };
    const safeKeys = ['name', 'status', 'backlog_priority', 'design_partner_status', 'design_partner', 'exploration_phase', 'one_metric_that_matters', 'primary_contact_id', 'notion_link', 'is_greenlit', 'is_paused', 'is_active'];
    if (!error.message?.includes('timeline_visible')) safeKeys.push('timeline_visible');
    if (!error.message?.includes('hidden_from_venture_tracker')) safeKeys.push('hidden_from_venture_tracker');
    for (const k of safeKeys) {
      if (k in updates) safeUpdates[k] = updates[k];
    }
    const retry = await getSupabase()
      .from('ventures')
      .update(safeUpdates)
      .eq('id', parseInt(id, 10))
      .select()
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message || 'Failed to update' }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error } = await getSupabase().from('ventures').delete().eq('id', parseInt(id, 10));
  if (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
