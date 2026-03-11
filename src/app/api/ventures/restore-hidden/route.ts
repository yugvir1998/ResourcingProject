import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

/**
 * Restore hidden ventures.
 * GET /api/ventures/restore-hidden?name=mechro  - restore venture matching name
 * GET /api/ventures/restore-hidden              - restore all hidden ventures
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const nameParam = searchParams.get('name')?.trim();

  const supabase = getSupabase();

  let query = supabase
    .from('ventures')
    .select('id, name, timeline_visible, hidden_from_venture_tracker')
    .or('timeline_visible.is.null,timeline_visible.eq.false,hidden_from_venture_tracker.eq.true');

  if (nameParam) {
    query = query.ilike('name', `%${nameParam}%`);
  }

  const { data: ventures, error: fetchError } = await query;

  if (fetchError) {
    console.error(fetchError);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!ventures || ventures.length === 0) {
    return NextResponse.json({
      message: nameParam ? `No hidden ventures found matching "${nameParam}"` : 'No hidden ventures found',
      restored: 0,
    });
  }

  const ids = ventures.map((v) => v.id);
  const { error: updateError } = await supabase
    .from('ventures')
    .update({ timeline_visible: true, hidden_from_venture_tracker: false })
    .in('id', ids);

  if (updateError) {
    console.error(updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    message: `Restored ${ventures.length} venture(s)`,
    restored: ventures.length,
    ventures: ventures.map((v) => ({ id: v.id, name: v.name })),
  });
}
