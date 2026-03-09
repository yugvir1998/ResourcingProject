#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Run Supabase migrations using your database connection string.
 *
 * 1. Get your connection string from Supabase Dashboard:
 *    Settings → Database → Connection string → URI
 *
 * 2. Add to .env.local:
 *    SUPABASE_DB_URL=postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
 *
 *    Or use the direct connection:
 *    SUPABASE_DB_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[project-ref].supabase.co:5432/postgres
 *
 * 3. Run: node scripts/supabase-migrate.js
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Load .env.local first
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations');

async function main() {
  const dbUrl = (process.env.SUPABASE_DB_URL || '').trim();
  if (!dbUrl) {
    console.error('Missing SUPABASE_DB_URL in .env.local');
    console.error('');
    console.error('Get it from Supabase: Settings → Database → Connection string (URI)');
    console.error('Add to .env.local: SUPABASE_DB_URL=postgresql://...');
    process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl });

  try {
    await client.connect();
    console.log('Connected to Supabase');

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())
    `);

    const { rows } = await client.query('SELECT name FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.name));

    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('No migration files found');
      return;
    }

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`Skipping ${file} (already applied)`);
        continue;
      }
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      console.log(`Running ${file}...`);
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      console.log(`  Done`);
    }

    console.log('');
    console.log('All migrations applied successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
