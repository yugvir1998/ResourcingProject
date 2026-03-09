import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

const SKIP_NAMES = new Set(['Funnel', 'Timeline (months)', 'Total', 'Hours per month', 'Engineer', 'Notes']);
const COL_MAP: Record<number, string> = {
  1: 'access',
  2: 'explore',
  3: 'validate',
  4: 'build',
  5: 'spin_out',
  6: 'support',
  8: 'fundraising',
  9: 'finance_accounting',
  10: 'legal',
  11: 'marketing_growth',
  12: 'operations',
  13: 'hiring',
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { filePath } = body as { filePath?: string };

    const csvPath = filePath || path.join(process.cwd(), 'data', 'employee_allocations.csv');
    if (!fs.existsSync(csvPath)) {
      return NextResponse.json({ error: 'CSV file not found' }, { status: 404 });
    }

    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split(/\r?\n/).filter((l) => l.trim());

    const employees: Array<{ name: string; title: string; allocations: Record<string, number> }> = [];

    for (let i = 2; i < lines.length; i++) {
      const line = lines[i];
      const cols = parseCSVLine(line);
      const name = (cols[0] || '').trim();
      if (!name || SKIP_NAMES.has(name)) continue;
      if (name.toLowerCase() === 'months') continue;
      if (/^\d+$/.test(name) || name.includes(',')) continue;

      const allocations: Record<string, number> = {};
      for (const [colIdx, key] of Object.entries(COL_MAP)) {
        const val = cols[parseInt(colIdx, 10)];
        const num = parseFloat(String(val || '0').replace(/,/g, ''));
        if (!isNaN(num)) {
          allocations[key] = Math.round(num * 100);
        }
      }

      employees.push({ name, title: '', allocations });
    }

    const supabase = getSupabase();
    const existing = await supabase.from('employees').select('id, name');
    const existingMap = new Map((existing.data || []).map((e) => [e.name.toLowerCase(), e]));

    const results: { created: string[]; updated: string[] } = { created: [], updated: [] };

    for (const emp of employees) {
      const existingEmp = existingMap.get(emp.name.toLowerCase());
      if (existingEmp) {
        await supabase
          .from('employees')
          .update({ allocations: emp.allocations })
          .eq('id', existingEmp.id);
        results.updated.push(emp.name);
      } else {
        const { data } = await supabase
          .from('employees')
          .insert({ name: emp.name, title: emp.title || '', allocations: emp.allocations, scenario_tag: 'potential_hire' })
          .select('id')
          .single();
        if (data) results.created.push(emp.name);
      }
    }

    return NextResponse.json({ ok: true, ...results });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if ((c === ',' && !inQuotes) || c === '\t') {
      result.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  result.push(current);
  return result;
}
