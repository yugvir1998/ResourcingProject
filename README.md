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
2. Run migrations (recommended: use the script so all migrations apply in order):
   - Add `SUPABASE_DB_URL` to `.env.local` (from Settings → Database → Connection string URI)
   - Run `npm run db:supabase` – applies all migrations in `supabase/migrations/`
   - **Important:** Run `npm run db:supabase` after cloning or when new migration files are added
   - *Alternative:* Run each SQL file manually in Supabase SQL Editor (in filename order)
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

## Deploy to Render

1. **Push your code** to GitHub (e.g. `yugvir1998/ResourcingProject`).

2. **Create a Render account** at [render.com](https://render.com) and connect your GitHub.

3. **New Web Service** → Connect your repo. Render will detect `render.yaml` (Blueprint).

4. **Add environment variables** in Render Dashboard → your service → Environment:
   - `NEXT_PUBLIC_SUPABASE_URL` – from Supabase Settings → API → Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` – from Supabase Settings → API → service_role key
   - `SUPABASE_DB_URL` – from Supabase Settings → Database → Connection string (URI)
   - `OPENAI_API_KEY` – for Impact Analysis (optional; omit if not using)
   - Google sign-in: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`; optional `ALLOWED_EMAIL_DOMAINS` (e.g. `gitwit.com`). Register redirect URI `https://<your-service>.onrender.com/api/auth/callback/google` in Google Cloud. The app uses Render’s `RENDER_EXTERNAL_URL` for OAuth so you do not need `AUTH_URL` unless you use a **custom domain** (then set `AUTH_URL` to that `https://` origin).

5. **Deploy** – Render will build and deploy. Your app will be live at `https://<your-service>.onrender.com`.

6. **Run migrations** (first time only): In Render Dashboard → Shell, run:
   ```bash
   npm run db:supabase
   ```
   Or run migrations locally against your Supabase DB before deploying.

## Database (Supabase / PostgreSQL)

- **Schema** – Defined in `supabase/migrations/` (run `npm run db:supabase` to apply)
- **Tables** – employees, ventures, venture_phases, hiring_milestones, allocations, support_assignments
- **New migrations** – Add SQL files to `supabase/migrations/`, then run `npm run db:supabase`
- **Note:** The `migrations/` folder (SQLite) is legacy; this project uses `supabase/migrations/` (PostgreSQL) for Supabase

## Project structure

- `src/app/` – Next.js App Router pages and API routes
- `src/components/` – React components (Kanban, Timeline, Team roster, Battlefield)
- `src/lib/supabase.ts` – Supabase client
- `supabase/migrations/` – PostgreSQL schema for Supabase
