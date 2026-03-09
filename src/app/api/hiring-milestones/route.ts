import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ventureId = searchParams.get('ventureId');

  let query = getSupabase()
    .from('hiring_milestones')
    .select('*')
    .order('target_date', { ascending: true });

  if (ventureId) {
    query = query.eq('venture_id', parseInt(ventureId, 10));
  } else {
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
    const { venture_id, role_type, target_date, notes, label } = body;

    if (!venture_id || !target_date) {
      return NextResponse.json({ error: 'venture_id and target_date required' }, { status: 400 });
    }

    const { data, error } = await getSupabase()
      .from('hiring_milestones')
      .insert({
        venture_id,
        role_type: role_type || 'other',
        label: label && String(label).trim() ? String(label).trim() : null,
        target_date,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to create milestone' }, { status: 500 });
  }
}
