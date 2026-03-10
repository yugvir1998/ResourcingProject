import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getSupabase } from '@/lib/supabase';

const PHASE_LABELS: Record<string, string> = {
  explore: 'Explore',
  shape: 'Concept',
  build: 'Build',
  spin_out: 'Spin out',
  support: 'Support',
};

async function buildPortfolioContext(): Promise<string> {
  const supabase = getSupabase();

  const [vRes, pRes, aRes, mRes, paRes, eRes] = await Promise.all([
    supabase.from('ventures').select('*').order('backlog_priority').order('name'),
    supabase.from('venture_phases').select('*').order('venture_id').order('sort_order').order('start_date'),
    supabase.from('allocations').select('*').order('venture_id').order('week_start'),
    supabase.from('hiring_milestones').select('*').order('venture_id').order('target_date'),
    supabase.from('phase_activities').select('*').order('venture_phase_id').order('sort_order'),
    supabase.from('employees').select('*').order('name'),
  ]);

  const ventures = vRes.data || [];
  const phases = pRes.data || [];
  const allocations = aRes.data || [];
  const milestones = mRes.data || [];
  const employees = eRes.data || [];

  type PhaseItem = { id: number; venture_id: number; phase: string; start_date: string; end_date: string };
  type EmployeeItem = { id: number; name: string };
  const phaseMap = new Map<number, PhaseItem>(phases.map((p: PhaseItem) => [p.id, p]));
  const employeeMap = new Map<number, EmployeeItem>(employees.map((e: EmployeeItem) => [e.id, e]));

  const timelineVentures = ventures.filter((v: { timeline_visible?: boolean }) => v.timeline_visible !== false);

  const ventureSummary = timelineVentures
    .map((v: { id: number; name: string }) => {
      const venturePhases = phases
        .filter((p: { venture_id: number }) => p.venture_id === v.id)
        .sort((a: { start_date: string }, b: { start_date: string }) => a.start_date.localeCompare(b.start_date));
      const phaseStr = venturePhases
        .map(
          (p: { phase: string; start_date: string; end_date: string }) =>
            `  - ${PHASE_LABELS[p.phase] || p.phase}: ${p.start_date} to ${p.end_date}`
        )
        .join('\n');
      const ventureAllocs = allocations.filter((a: { venture_id: number }) => a.venture_id === v.id);
      const allocStr = ventureAllocs
        .map((a: { employee_id: number; phase_id?: number; fte_percentage: number }) => {
          const emp = employeeMap.get(a.employee_id);
          const phase = a.phase_id ? phaseMap.get(a.phase_id) : null;
          return `  - ${emp?.name || 'Unknown'}: ${a.fte_percentage}% on ${phase ? PHASE_LABELS[phase.phase] || phase.phase : 'venture'}`;
        })
        .join('\n');
      const ventureMilestones = milestones.filter((m: { venture_id: number }) => m.venture_id === v.id);
      const milestoneStr = ventureMilestones
        .map((m: { target_date: string; role_type: string; label?: string }) => `  - ${m.label || m.role_type}: ${m.target_date}`)
        .join('\n');
      return `**${v.name}**
Phases:
${phaseStr || '  (none)'}
Allocations:
${allocStr || '  (none)'}
Milestones:
${milestoneStr || '  (none)'}`;
    })
    .join('\n\n');

  const employeeTotals = employees.map((e: { id: number; name: string }) => {
    const empAllocs = allocations.filter((a: { employee_id: number }) => a.employee_id === e.id);
    const total = empAllocs.reduce((sum: number, a: { fte_percentage: number }) => sum + a.fte_percentage, 0);
    return `- ${e.name}: ${total}% total across ${empAllocs.length} allocation(s)`;
  });

  return `## Ventures (timeline-visible)
${ventureSummary || '(none)'}

## Employee allocation totals
${employeeTotals.join('\n') || '(none)'}`;
}

const SYSTEM_BASE = `You are an expert resource allocation and project management advisor. You have access to the current portfolio data below. Answer questions, analyze impacts, identify delays and risks, and help with scenario planning. Use the data to inform your answers. Reference venture names, phase names, and people by name when relevant. Respond in clear, actionable markdown.`;

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured. Add it to .env.local.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const messages = body.messages as Array<{ role: 'user' | 'assistant'; content: string }> | undefined;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages array required with at least one message' }, { status: 400 });
    }

    const context = await buildPortfolioContext();
    const systemContent = `${SYSTEM_BASE}

---
Current portfolio data (refreshed on each message):

${context}
---`;

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemContent },
        ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ],
      max_tokens: 1500,
    });

    const content = completion.choices[0]?.message?.content ?? 'No response generated.';
    return NextResponse.json({ content });
  } catch (e) {
    console.error('impact-chat error:', e);
    const err = e as { message?: string };
    return NextResponse.json(
      { error: err.message || 'Failed to get response' },
      { status: 500 }
    );
  }
}
