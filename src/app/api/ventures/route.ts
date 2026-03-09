import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await getSupabase()
      .from('ventures')
      .select('*')
      .order('backlog_priority', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;

    // Sort: active first, then backlog, then support
    const sorted = (data || []).sort((a, b) => {
      const order = { active: 0, backlog: 1, support: 2 };
      const aOrd = order[a.status as keyof typeof order] ?? 2;
      const bOrd = order[b.status as keyof typeof order] ?? 2;
      return aOrd - bOrd || a.backlog_priority - b.backlog_priority || a.name.localeCompare(b.name);
    });

    return NextResponse.json(sorted);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch ventures' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, status = 'backlog', backlog_priority = 0, design_partner_status, exploration_phase, one_metric_that_matters, notes, next_steps, timeline_visible } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const insertPayload: Record<string, unknown> = {
      name,
      status,
      backlog_priority: backlog_priority ?? 0,
      design_partner_status: design_partner_status ?? (status === 'backlog' ? 'coordinating' : null),
      exploration_phase: exploration_phase || null,
      one_metric_that_matters: one_metric_that_matters || null,
      notes: notes || null,
      next_steps: next_steps || null,
    };
    if (timeline_visible != null) insertPayload.timeline_visible = !!timeline_visible;

    const { data, error } = await getSupabase()
      .from('ventures')
      .insert(insertPayload as Record<string, unknown>)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to create venture' }, { status: 500 });
  }
}
