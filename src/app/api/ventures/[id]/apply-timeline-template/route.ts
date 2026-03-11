import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

const PHASES = ['explore', 'shape', 'build', 'spin_out'] as const;
// Explore 2mo, Concept 2mo, Build 2mo, Spin out 2mo (support removed - now a venture status)
const PHASE_DAYS = [60, 60, 60, 60];

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

  const REQUIRED_PHASES = ['explore', 'shape', 'build', 'spin_out'] as const;

  // Check if phases already exist and are complete
  const { data: existingPhases } = await supabase
    .from('venture_phases')
    .select('id, phase')
    .eq('venture_id', ventureId);
  const phasesList = existingPhases || [];
  const hasAllPhases = REQUIRED_PHASES.every((p) =>
    phasesList.some((ep: { phase: string }) => ep.phase === p)
  );

  if (hasAllPhases && phasesList.length >= 4) {
    const { data: fullPhases } = await supabase
      .from('venture_phases')
      .select('*')
      .eq('venture_id', ventureId)
      .order('sort_order', { ascending: true });
    return NextResponse.json({ phases: fullPhases || [], message: 'Phases already complete' });
  }

  // Delete incomplete or partial phases before re-inserting
  if (phasesList.length > 0) {
    await supabase.from('venture_phases').delete().eq('venture_id', ventureId);
  }

  const today = new Date();
  let offset = 0;
  const rows: { venture_id: number; phase: string; start_date: string; end_date: string; sort_order: number }[] = [];

  for (let i = 0; i < PHASES.length; i++) {
    const days = PHASE_DAYS[i] ?? 30;
    const start = new Date(today);
    start.setDate(start.getDate() + offset);
    const end = new Date(start);
    end.setDate(end.getDate() + days);
    offset += days;
    rows.push({
      venture_id: ventureId,
      phase: PHASES[i],
      start_date: start.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
      sort_order: i,
    });
  }

  const { error } = await supabase.from('venture_phases').insert(rows);
  if (error) {
    console.error(error);
    const hint =
      'If phases like "shape" are rejected, ensure migrations 012 and 013 are applied (npm run db:supabase).';
    return NextResponse.json(
      { error: error.message, hint },
      { status: 500 }
    );
  }

  const { data: phases } = await supabase
    .from('venture_phases')
    .select('*')
    .eq('venture_id', ventureId)
    .order('sort_order', { ascending: true });

  return NextResponse.json({ phases: phases || [] });
}
