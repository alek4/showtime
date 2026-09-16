# Showtime

Private shared movie watchlist for two users. Next.js 15 + Tailwind + Supabase + Vercel.

Full spec: `docs/superpowers/specs/2026-09-16-showtime-design.md`
Implementation plan: `docs/superpowers/plans/2026-09-16-showtime-implementation.md`

## Build Status

| Module | Status | Notes |
|---|---|---|
| 1 — Scaffold | ✅ Done | Tailwind 4 (not 3); `cross-env` for Windows test scripts; `@theme` in CSS instead of `tailwind.config.ts` |
| 2 — DB Schema + RLS | ✅ Done | Hosted Supabase (Docker skipped); migrations applied via `supabase db push`; `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| 3 — Auth | ✅ Done | `/login` page, middleware, `(app)` route group; `feat/module-3-auth` branch |
| 4 — TMDB API Route | ⬜ Not started | |
| 5 — Streaming API Route | ⬜ Not started | |
| 6 — Data Layer | ⬜ Not started | |
| 7 — Search & Add | ⬜ Not started | |
| 8 — Watchlist Home | ⬜ Not started | |
| 9 — Title Detail | ⬜ Not started | |
| 10 — Random Picker | ⬜ Not started | |
| 11 — Stats | ⬜ Not started | |
| 12 — Settings + Nav | ⬜ Not started | |

### Key deviations from plan
- **Tailwind 4** was installed by create-next-app (not Tailwind 3). Config lives in `app/globals.css` `@theme` block, no `tailwind.config.ts`.
- **`cross-env`** added as dev dep — required for Windows-compatible env var syntax in npm scripts.
- **`lib/supabase/server.ts` `createClient()` is `async`** — Next.js 15 requires `await cookies()`. All Server Components must `await createClient()`.
- **Test files** live in `lib/__tests__/` for now (co-location with source files starts in Module 4+).
- **Hosted Supabase** — local Supabase (`supabase start`) skipped due to Docker Desktop issues. Using a cloud Supabase project for all development and production. Migrations applied via SQL Editor in the Supabase dashboard; `supabase test db` (pgTAP) is not used.
- **`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`** — Supabase renamed the anon key. All client code references this name instead of `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

## Architecture

- **Frontend:** Next.js 15 App Router. React Server Components by default; client components only where interactivity is required (search input, filters, random picker, star rating).
- **Backend:** Next.js API routes under `/app/api/`. All third-party API calls go here — never from the client.
- **Database + Auth:** Supabase (Postgres + Auth). Two tables: `titles` (shared) and `user_title_meta` (per-user).
- **Deployment:** Vercel. Secrets in Vercel environment variables only.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Styling | Tailwind CSS |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth (email + password) |
| Testing | Vitest |
| Charts | Recharts |
| Deployment | Vercel |

---

## Key Commands

```bash
npm run dev        # start dev server
npm run build      # production build
npm run test       # run Vitest
npm run test:watch # watch mode
npm run lint       # ESLint
```

---

## Non-Negotiables

**Auth & Access**

- IMPORTANT: There is NO public signup route. Accounts are created in the Supabase dashboard only. Do not add a `/register` page or any user creation flow.
- YOU MUST use an `allowed_users` table for RLS. Never use `auth.role() = 'authenticated'` alone — it allows any authenticated user in the project. Every policy on `titles` must check `auth.uid() IN (SELECT id FROM allowed_users)`.

**API Keys**

- YOU MUST keep all third-party API keys (TMDB, Streaming Availability) server-side. Never reference `process.env.TMDB_KEY` or similar in any file under `app/` that runs client-side. All external calls go through `/app/api/` routes.

**Data Integrity**

- YOU MUST soft-delete titles. Set `removed_at = NOW()` — never run `DELETE` on the `titles` table. All queries filter `removed_at IS NULL`.
- Never hard-delete `user_title_meta` rows except via cascade when a title is hard-deleted (which should never happen in normal use).

**Streaming Cache**

- IMPORTANT: Streaming cache refresh is synchronous on detail page load. If `streaming_cached_at` is older than 24 hours, call the Streaming Availability API and await the result before rendering. Do not fire-and-forget — Vercel serverless functions are killed mid-flight.

**Random Picker**

- Platform filtering in the random picker uses TMDB's `with_watch_providers` + `watch_region=IT`. Do not call the Streaming Availability API for the picker — it's only for badge display on title detail pages.

---

## Coding Conventions

- **TypeScript everywhere.** No `any` — use `unknown` and narrow it.
- **Server Components first.** Only add `"use client"` when a component needs `useState`, `useEffect`, or browser event handlers.
- **Co-location.** Keep components, their types, and their direct helpers in the same file or folder. No barrel files.
- **No comments on obvious code.** Comment only when the *why* is non-obvious (workaround, hidden constraint, subtle invariant).
- **Tailwind only.** No CSS modules, no inline `style={}`, no external CSS files.
- **Supabase client.** Use the server-side Supabase client in Server Components and API routes. Use the browser client only in client components that need real-time or auth state.
- **Environment variables.** Prefix browser-safe vars with `NEXT_PUBLIC_`. Never prefix secret keys — they must stay server-only.

---

## Testing Approach

Framework: **Vitest**

**YOU MUST follow TDD:**
1. Write a failing test first.
2. Write the minimum implementation to make it pass.
3. Commit immediately after green — one commit per passing test or test suite.
4. Refactor if needed, keep tests green.

**What to test:**
- Unit: random picker filter logic, watch time calculation (`~` prefix when runtime is null), genre unnest for stats, Letterboxd search URL construction.
- Integration: adding a title, marking as watched and verifying stats query output, soft-deleting and verifying it disappears from all queries.
- No E2E tests.

**Test file location:** co-locate with source — `foo.ts` → `foo.test.ts` in the same directory.

---

## Data Model Quick Reference

**`titles`** (shared)
- `id`, `tmdb_id` (unique), `title`, `year`, `poster_url`, `runtime_minutes` (nullable), `genres` (text[]), `overview`
- `letterboxd_search_url` — `https://letterboxd.com/search/films/Title+Year`
- `watched` (boolean), `watched_at` (timestamptz nullable)
- `added_by` (uuid), `added_at`
- `streaming_data` (jsonb), `streaming_cached_at`
- `removed_at` (timestamptz nullable) — soft-delete flag

**`user_title_meta`** (per-user, PK: user_id + title_id)
- `want_to_watch` (boolean), `rating` (1–5 nullable), `note` (text nullable), `rated_at`

**`allowed_users`** (two rows, hardcoded at setup)
- `id` (uuid, matches `auth.users.id`)

---

## Git

- Each module is implemented on a feature branch: `feat/module-N-<name>` (e.g. `feat/module-3-auth`).
- Commit after each green test.
- Short imperative subject line (`add watch time calculation`, `fix genre unnest query`).
- Do not add co-author lines to commits.
