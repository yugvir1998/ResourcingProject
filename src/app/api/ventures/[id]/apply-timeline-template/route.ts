import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

const PHASES = ['explore', 'validate', 'define', 'build', 'spin_out'] as const;
// Explore 2mo, Validate 1mo, Define 1mo, Build 2mo, Spin out 1mo
const PHASE_DAYS = [60, 30, 30, 60, 30];

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ventureId = parseInt(id, 10);
  if (isNaN(ventureId)) {
    return NextResponse.json({ error: 'Invalid venture ID' }, { status: 400 });
  }

  const supabase = getSupabase();

  // Check if phases already exist
  const { data: existing } = await supabase
    .from('venture_phases')
    .select('id')
    .eq('venture_id', ventureId);
  if (existing && existing.length > 0) {
    return NextResponse.json({ message: 'Phases already exist', phases: existing });
  }

  const today = new Date();
  let offset = 0;

  for (let i = 0; i < PHASES.length; i++) {
    const days = PHASE_DAYS[i] ?? 30;
    const start = new Date(today);
    start.setDate(start.getDate() + offset);
    const end = new Date(start);
    end.setDate(end.getDate() + days);
    offset += days;

    const { error } = await supabase.from('venture_phases').insert({
      venture_id: ventureId,
      phase: PHASES[i],
      start_date: start.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
      sort_order: i,
    });
    if (error) {
      console.error(error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const { data: phases } = await supabase
    .from('venture_phases')
    .select('*')
    .eq('venture_id', ventureId)
    .order('sort_order', { ascending: true });

  return NextResponse.json({ phases: phases || [] });
}
