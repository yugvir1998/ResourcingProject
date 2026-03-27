import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { MAX_PEOPLE_TAG_LENGTH, normalizePeopleTag } from '@/lib/people-tags';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const allowed = ['name', 'title', 'spectrum', 'allocations', 'scenario_tag', 'people_tag'];
  const updates: Record<string, unknown> = {};

  for (const key of allowed) {
    if (key in body) {
      updates[key] = body[key];
    }
  }

  if ('people_tag' in updates) {
    const raw = updates.people_tag;
    const rawTrim = raw == null ? '' : String(raw).trim();
    if (rawTrim.length > MAX_PEOPLE_TAG_LENGTH) {
      return NextResponse.json(
        { error: `people_tag must be at most ${MAX_PEOPLE_TAG_LENGTH} characters` },
        { status: 400 }
      );
    }
    updates.people_tag = normalizePeopleTag(raw);
  }

  if (Object.keys(updates).length === 0) {
    const { data } = await getSupabase().from('employees').select('*').eq('id', parseInt(id, 10)).single();
    return NextResponse.json(data);
  }

  const supabase = getSupabase();
  const numericId = parseInt(id, 10);

  let payload = { ...updates };
  let { data, error } = await supabase.from('employees').update(payload).eq('id', numericId).select().single();

  if (error?.message?.includes('people_tag')) {
    const { people_tag: _pt, ...withoutTag } = payload;
    if (Object.keys(withoutTag).length === 0) {
      return NextResponse.json(
        {
          error:
            'Database is missing the people_tag column. In Supabase: SQL Editor → run supabase/migrations/021_people_tag.sql',
        },
        { status: 500 }
      );
    }
    payload = withoutTag;
    const retry = await supabase.from('employees').update(payload).eq('id', numericId).select().single();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    console.error(error);
    return NextResponse.json(
      { error: error.message || 'Failed to update. Check Supabase connection and that migrations are applied.' },
      { status: 500 }
    );
  }
  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error } = await getSupabase().from('employees').delete().eq('id', parseInt(id, 10));
  if (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
