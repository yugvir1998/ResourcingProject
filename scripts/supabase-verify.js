#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Sanity-check Supabase schema after migrations (columns the app expects).
 * Run: npm run db:verify
 */
const path = require('path');
const { Client } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const REQUIRED = [
  { table: 'allocations', columns: ['phase_id', 'venture_id', 'employee_id', 'fte_percentage', 'week_start'] },
  { table: 'venture_phases', columns: ['hidden_from_capacity', 'venture_id', 'start_date', 'end_date'] },
  { table: 'ventures', columns: ['timeline_visible', 'hidden_from_venture_tracker', 'deleted_at', 'status'] },
  { table: 'employees', columns: ['people_tag', 'scenario_tag'] },
];

async function main() {
  const dbUrl = (process.env.SUPABASE_DB_URL || '').trim();
  if (!dbUrl) {
    console.error('Missing SUPABASE_DB_URL in .env.local');
    process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    const { rows: mig } = await client.query(
      'SELECT name, applied_at FROM schema_migrations ORDER BY name'
    );
    console.log(`schema_migrations: ${mig.length} applied\n`);

    const allMissing = [];
    for (const { table, columns } of REQUIRED) {
      const { rows } = await client.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1`,
        [table]
      );
      const have = new Set(rows.map((r) => r.column_name));
      const missing = columns.filter((c) => !have.has(c));
      if (missing.length) {
        console.error(`✗ ${table}: missing columns ${missing.join(', ')}`);
        allMissing.push(...missing.map((c) => `${table}.${c}`));
      } else {
        console.log(`✓ ${table}: ok (${columns.join(', ')})`);
      }
    }

    const { rows: onc } = await client.query(
      `SELECT v.id, v.name, v.status, v.timeline_visible, v.hidden_from_venture_tracker,
              (SELECT COUNT(*)::int FROM allocations a WHERE a.venture_id = v.id) AS alloc_count
       FROM ventures v
       WHERE v.deleted_at IS NULL AND v.name ILIKE '%oncology%'
       LIMIT 5`
    );
    console.log('\nVentures matching "oncology" (sample):');
    if (onc.length === 0) console.log('  (none)');
    else console.table(onc);

    if (allMissing.length) {
      console.error('\nFix: run npm run db:supabase (or apply missing migrations in SQL editor).');
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
