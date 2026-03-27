import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ventureIds } = body as { ventureIds: number[] };

    if (!Array.isArray(ventureIds)) {
      return NextResponse.json({ error: 'ventureIds array required' }, { status: 400 });
    }

    for (let i = 0; i < ventureIds.length; i++) {
      const { error } = await getSupabase()
        .from('ventures')
        .update({ backlog_priority: i })
        .eq('id', ventureIds[i])
        .is('deleted_at', null);
      if (error) throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to reorder' }, { status: 500 });
  }
}
