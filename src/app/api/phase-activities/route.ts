import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const venturePhaseId = searchParams.get('venturePhaseId');

  let query = getSupabase()
    .from('phase_activities')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('start_date', { ascending: true });

  if (venturePhaseId) {
    query = query.eq('venture_phase_id', parseInt(venturePhaseId, 10));
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
    const { venture_phase_id, name, start_date, end_date, sort_order = 0 } = body;

    if (!venture_phase_id || !name || !start_date || !end_date) {
      return NextResponse.json(
        { error: 'venture_phase_id, name, start_date, end_date required' },
        { status: 400 }
      );
    }

    const { data, error } = await getSupabase()
      .from('phase_activities')
      .insert({
        venture_phase_id,
        name,
        start_date,
        end_date,
        sort_order: sort_order ?? 0,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to create phase activity' }, { status: 500 });
  }
}
