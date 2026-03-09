# Resourcing Dashboard

A battlefield command center for venture and resource allocation. Makes opportunity costs visible for strategic decision-making.

## Features

- **Battlefield summary** – High-level view of ventures by status and team capacity
- **Exploration Kanban** – Backlog (rank-ordered, design partner status) + active exploration (discovery, message-market fit, prototyping). Drag-and-drop to move between columns.
- **Timeline** – Phases (exploration → concept → build → spin out) and hiring milestones per venture
- **Team roster** – Add and manage 20–25 employees with name, title, and spectrum (venture leader, engineer, studio function)

## Getting started

### 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com)
2. Run the migration (either way):
   - **Option A – Script:** Add `SUPABASE_DB_URL` to `.env.local` (from Settings → Database → Connection string URI), then run `npm run db:supabase`
   - **Option B – Manual:** In SQL Editor, paste `supabase/migrations/001_initial.sql` and click Run
3. In **Settings → API**, copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **service_role** key (under "Project API keys") → `SUPABASE_SERVICE_ROLE_KEY`

### 2. Environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your Supabase URL and service role key.

### 3. Run the app

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Add data

- **Team** – Add employees (name, title, spectrum)
- **Exploration** – Add ventures, then drag between backlog/active columns
- **Timeline** – For active ventures, add phases and hiring milestones

Data added in the dashboard is stored in Supabase. You can also add or edit data directly in the Supabase **Table Editor**; it will show up on the dashboard when you refresh.

## Database (Supabase / PostgreSQL)

- **Schema** – Defined in `supabase/migrations/001_initial.sql`
- **Tables** – employees, ventures, venture_phases, hiring_milestones, allocations, support_assignments
- **New migrations** – Add SQL files to `supabase/migrations/` and run them in the Supabase SQL Editor

## Project structure

- `src/app/` – Next.js App Router pages and API routes
- `src/components/` – React components (Kanban, Timeline, Team roster, Battlefield)
- `src/lib/supabase.ts` – Supabase client
- `supabase/migrations/` – PostgreSQL schema for Supabase
