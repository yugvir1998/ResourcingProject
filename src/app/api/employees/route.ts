import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await getSupabase()
      .from('employees')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, title = '', allocations = {}, scenario_tag = 'potential_hire' } = body;

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const tag = scenario_tag === 'nitwit' ? 'nitwit' : 'potential_hire';
    const supabase = getSupabase();

    const basePayload = { name, title: title || '', allocations, spectrum: 'other' };
    let { data, error } = await supabase
      .from('employees')
      .insert({ ...basePayload, scenario_tag: tag })
      .select()
      .single();

    if (error && (error.message?.includes('scenario_tag') || error.message?.includes('does not exist'))) {
      const retry = await supabase.from('employees').insert(basePayload).select().single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error(error);
      return NextResponse.json(
        { error: error.message || 'Failed to create employee' },
        { status: 500 }
      );
    }
    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : 'Failed to create employee';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
