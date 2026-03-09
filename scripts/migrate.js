#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Migration runner: runs SQL files from migrations/ in order.
 * Tracks applied migrations in schema_migrations table.
 * Usage: node scripts/migrate.js
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'data', 'resourcing.db');
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();
}

function main() {
  ensureDir(path.dirname(DB_PATH));
  const db = new Database(DB_PATH);

  // Create schema_migrations if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    db.prepare('SELECT name FROM schema_migrations').all().map(r => r.name)
  );

  const files = getMigrationFiles();
  let runCount = 0;

  for (const file of files) {
    if (applied.has(file)) continue;

    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    console.log(`Running migration: ${file}`);
    db.exec(sql);
    runCount++;
  }

  db.close();
  console.log(runCount > 0 ? `Applied ${runCount} migration(s).` : 'No new migrations to run.');
}

main();
