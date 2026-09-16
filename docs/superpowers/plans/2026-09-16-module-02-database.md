# Module 2: Database Schema + RLS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create all three Supabase tables (`allowed_users`, `titles`, `user_title_meta`) with correct columns, constraints, and Row Level Security policies — the data foundation every subsequent module builds on.

**Architecture:** Two Supabase migrations in `supabase/migrations/`. RLS policies use an `allowed_users` membership check on `titles` (not `auth.role()`). Schema verified with Supabase's built-in pgTAP test runner (`supabase test db`).

**Tech Stack:** Supabase CLI, PostgreSQL, Supabase dashboard SQL Editor (hosted project — local Docker skipped)

**Spec:** `docs/superpowers/specs/2026-09-16-showtime-design.md`
**Conventions:** `CLAUDE.md`

## Global Constraints

- YOU MUST use `allowed_users` table for RLS — never `auth.role() = 'authenticated'` alone
- Soft-delete column `removed_at` on `titles` — never hard-delete rows
- `user_title_meta` PK is `(user_id, title_id)` — composite, no surrogate key
- `rating` constrained to 1–5 via CHECK constraint
- No co-author lines in git commits

---

## Prerequisites

Before Task 1, confirm Supabase CLI is installed:

```bash
supabase --version
```

If not installed:
```bash
npm install -g supabase
```

---

## File Map

```
supabase/
├── migrations/
│   ├── 20260916000001_schema.sql   # tables: allowed_users, titles, user_title_meta
│   └── 20260916000002_rls.sql      # RLS enable + all policies
└── seed.sql                        # commented template — fill in real UUIDs at setup
```

> pgTAP tests dropped — requires local Supabase instance (Docker unavailable on this machine).

---

## Task 1: Initialize Supabase and link to hosted project

**Files:**
- Create: `supabase/config.toml` (via `supabase init`)

**Interfaces:**
- Produces: `supabase/config.toml` linked to the hosted Supabase project; `.env.local` populated

> **Deviation from original plan:** Local Supabase (`supabase start`) is skipped — Docker Desktop issues on Windows prevented the DB container from starting. Using the hosted Supabase cloud project instead. Migrations are applied via the SQL Editor in the dashboard. pgTAP tests (`supabase test db`) are not run.

- [x] **Step 1: Initialize Supabase in project root**

```bash
supabase init
```

Expected: creates `supabase/config.toml` and `supabase/.gitignore`.

- [x] **Step 2: Create `.env.local` with hosted project credentials**

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key from dashboard → Settings → API>
```

- [x] **Step 3: Commit Supabase init files**

```bash
git add supabase/config.toml supabase/.gitignore
git commit -m "init: add Supabase project config"
```

---

## Task 2: Schema migration

**Files:**
- Create: `supabase/migrations/20260916000001_schema.sql`

**Interfaces:**
- Produces: tables `allowed_users`, `titles`, `user_title_meta` in the `public` schema

- [x] **Step 1: Write the schema migration**

Create `supabase/migrations/20260916000001_schema.sql`:
```sql
-- Lookup table: only these two UUIDs can access the app
CREATE TABLE public.allowed_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Shared movie/show library
CREATE TABLE public.titles (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tmdb_id               INTEGER     UNIQUE NOT NULL,
  title                 TEXT        NOT NULL,
  year                  INTEGER     NOT NULL,
  poster_url            TEXT,
  runtime_minutes       INTEGER,
  genres                TEXT[]      NOT NULL DEFAULT '{}',
  overview              TEXT,
  letterboxd_search_url TEXT        NOT NULL,
  watched               BOOLEAN     NOT NULL DEFAULT FALSE,
  watched_at            TIMESTAMPTZ,
  added_by              UUID        NOT NULL REFERENCES auth.users(id),
  added_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  streaming_data        JSONB,
  streaming_cached_at   TIMESTAMPTZ,
  removed_at            TIMESTAMPTZ
);

-- Per-user ratings, notes, and want-to-watch flag
CREATE TABLE public.user_title_meta (
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title_id      UUID        NOT NULL REFERENCES public.titles(id) ON DELETE CASCADE,
  want_to_watch BOOLEAN     NOT NULL DEFAULT FALSE,
  rating        INTEGER     CHECK (rating BETWEEN 1 AND 5),
  note          TEXT,
  rated_at      TIMESTAMPTZ,
  PRIMARY KEY (user_id, title_id)
);
```

- [x] **Step 4: Apply migration via Supabase dashboard**

Open Supabase dashboard → SQL Editor → New query. Paste the contents of `supabase/migrations/20260916000001_schema.sql` and run it.

Expected: query runs without errors. Check Table Editor — `allowed_users`, `titles`, `user_title_meta` should all appear.

- [x] **Step 5: Commit**

```bash
git add supabase/migrations/20260916000001_schema.sql
git commit -m "feat: add database schema migration"
```

---

## Task 3: RLS policies

**Files:**
- Create: `supabase/migrations/20260916000002_rls.sql`

**Interfaces:**
- Produces: RLS enabled on all three tables; anon role cannot access any table; authenticated users not in `allowed_users` cannot access `titles`

- [x] **Step 1: Write the RLS migration**

Create `supabase/migrations/20260916000002_rls.sql`:
```sql
-- Enable RLS on all tables
ALTER TABLE public.allowed_users    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.titles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_title_meta  ENABLE ROW LEVEL SECURITY;

-- allowed_users: users can only see their own membership row
CREATE POLICY "allowed_users_select" ON public.allowed_users
  FOR SELECT USING (auth.uid() = id);

-- titles: full CRUD for users listed in allowed_users
CREATE POLICY "titles_select" ON public.titles
  FOR SELECT USING (auth.uid() IN (SELECT id FROM public.allowed_users));

CREATE POLICY "titles_insert" ON public.titles
  FOR INSERT WITH CHECK (auth.uid() IN (SELECT id FROM public.allowed_users));

CREATE POLICY "titles_update" ON public.titles
  FOR UPDATE USING (auth.uid() IN (SELECT id FROM public.allowed_users));

-- user_title_meta: users can only access their own rows
CREATE POLICY "user_title_meta_select" ON public.user_title_meta
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_title_meta_insert" ON public.user_title_meta
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_title_meta_update" ON public.user_title_meta
  FOR UPDATE USING (auth.uid() = user_id);
```

- [x] **Step 4: Apply migration via Supabase dashboard**

Open SQL Editor → New query. Paste the contents of `supabase/migrations/20260916000002_rls.sql` and run it.

Expected: no errors. Check Authentication → Policies — 7 policies should appear across the 3 tables.

- [x] **Step 5: Commit**

```bash
git add supabase/migrations/20260916000002_rls.sql
git commit -m "feat: add RLS policies for titles and user_title_meta"
```

---

## Task 4: Seed file

**Files:**
- Create: `supabase/seed.sql`

**Interfaces:**
- Produces: documented template for inserting the two `allowed_users` rows

- [x] **Step 1: Create seed.sql**

```sql
-- Run this once after creating both user accounts in the Supabase Auth dashboard.
-- Replace the UUIDs with the real user IDs from: Dashboard → Authentication → Users
--
-- INSERT INTO public.allowed_users (id) VALUES
--   ('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'),  -- user 1
--   ('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');  -- user 2
```

- [x] **Step 2: Commit**

```bash
git add supabase/seed.sql
git commit -m "docs: add seed.sql template for allowed_users setup"
```

---

## Task 5: Final verification

- [x] **Step 1: Verify in Supabase dashboard**

Open Table Editor — confirm `allowed_users`, `titles`, `user_title_meta` all appear with correct columns. Open Authentication → Policies — confirm 7 policies exist across the 3 tables.

- [x] **Step 2: Run npm test to confirm no regressions**

```bash
npm run test
```

Expected: 16 Vitest tests still passing.

---

## Self-Review

**Spec coverage:**
- ✅ `allowed_users` table (RLS gate)
- ✅ `titles` with all columns including `removed_at` soft-delete
- ✅ `user_title_meta` with composite PK and rating CHECK (1–5)
- ✅ `letterboxd_search_url` on `titles`
- ✅ RLS enabled on all three tables
- ✅ `titles` RLS checks `allowed_users` membership, not `auth.role()`
- ✅ `user_title_meta` RLS scoped to `auth.uid() = user_id`
- ✅ Seed template for `allowed_users`

**No placeholders:** All SQL is complete and runnable.

**Type consistency:** Column names here will be used verbatim in `lib/types.ts` (Module 6) — `tmdb_id`, `letterboxd_search_url`, `streaming_cached_at`, `removed_at`.
