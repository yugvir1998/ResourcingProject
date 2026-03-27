import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { MAX_PEOPLE_TAG_LENGTH, normalizePeopleTag } from '@/lib/people-tags';

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
    const { name, title = '', allocations = {}, scenario_tag = 'potential_hire', people_tag: rawPeopleTag } = body;

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const tag = scenario_tag === 'nitwit' ? 'nitwit' : 'potential_hire';
    const rawTrim = rawPeopleTag == null ? '' : String(rawPeopleTag).trim();
    if (rawTrim.length > MAX_PEOPLE_TAG_LENGTH) {
      return NextResponse.json(
        { error: `people_tag must be at most ${MAX_PEOPLE_TAG_LENGTH} characters` },
        { status: 400 }
      );
    }
    const peopleTag = normalizePeopleTag(rawPeopleTag);
    const supabase = getSupabase();

    const baseCore = { name, title: title || '', allocations, spectrum: 'other' };
    const insertPayload: Record<string, unknown> = { ...baseCore, scenario_tag: tag };
    if (peopleTag !== null) insertPayload.people_tag = peopleTag;

    let { data, error } = await supabase.from('employees').insert(insertPayload).select().single();

    if (error?.message?.includes('people_tag')) {
      const { people_tag: _p, ...withoutPeopleTag } = insertPayload;
      const r = await supabase.from('employees').insert(withoutPeopleTag).select().single();
      data = r.data;
      error = r.error;
    }
    if (error?.message?.includes('scenario_tag') || error?.message?.includes('does not exist')) {
      const r = await supabase.from('employees').insert(baseCore).select().single();
      data = r.data;
      error = r.error;
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
