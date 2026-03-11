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

    // Sort: active, planned, exploration_staging, backlog, support
    const sorted = (data || []).sort((a, b) => {
      const order = { active: 0, planned: 1, exploration_staging: 2, backlog: 3, support: 4 };
      const aOrd = order[a.status as keyof typeof order] ?? 4;
      const bOrd = order[b.status as keyof typeof order] ?? 4;
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
    const { name, status = 'backlog', backlog_priority = 0, design_partner_status, design_partner, exploration_phase, one_metric_that_matters, notes, next_steps, primary_contact_id, notion_link, timeline_visible, tentative_start_date } = body;

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
      primary_contact_id: primary_contact_id ?? null,
      notion_link: notion_link?.trim() || null,
      tentative_start_date: tentative_start_date || null,
      design_partner: design_partner?.trim() || null,
    };
    if (timeline_visible != null) insertPayload.timeline_visible = !!timeline_visible;

    let result = await getSupabase()
      .from('ventures')
      .insert(insertPayload as Record<string, unknown>)
      .select()
      .single();

    // If notion_link column doesn't exist (migration not run), retry without it
    if (result.error && (result.error.message?.includes('notion_link') || result.error.message?.includes('does not exist'))) {
      delete insertPayload.notion_link;
      result = await getSupabase()
        .from('ventures')
        .insert(insertPayload as Record<string, unknown>)
        .select()
        .single();
    }

    const { data, error } = result;
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : 'Failed to create venture';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
