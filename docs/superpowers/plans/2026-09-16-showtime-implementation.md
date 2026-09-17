# Showtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a private shared movie watchlist web app for two users with TMDB search, Italy streaming availability, a random picker, and a stats page.

**Architecture:** Next.js 15 App Router, server components by default, client components only for interactive UI. All third-party API calls go through Next.js API routes. Supabase handles auth and Postgres; RLS enforces access via an `allowed_users` table.

**Tech Stack:** Next.js 15, Tailwind CSS, Supabase (Auth + Postgres), Vitest, Recharts, Vercel

**Spec:** `docs/superpowers/specs/2026-09-16-showtime-design.md`
**Design:** `DESIGN.md`
**Conventions:** `CLAUDE.md`

## Global Constraints

- TypeScript everywhere — no `any`, use `unknown` and narrow
- No `"use client"` unless the component needs `useState`, `useEffect`, or browser event handlers
- All API keys server-side only — never in client components or `NEXT_PUBLIC_` vars
- YOU MUST soft-delete titles (`removed_at = NOW()`) — never `DELETE` from `titles`
- RLS must check `allowed_users` membership, not `auth.role()`
- TDD: write failing test → implement → green → commit. One commit per green test.
- No co-author lines in commits
- Mobile-first throughout — minimum 44px touch targets, bottom nav on mobile
- Fonts: Bebas Neue (display), Outfit (body), DM Serif Display italic (accent)
- Colors: warm blacks (`#0A0906`), amber accent (`#F5A623`), red for watched state only

---

## Module Sequence

### Module 1: Project Scaffold

**Delivers:** A running Next.js 15 app with Tailwind, Supabase client, and Vitest configured. No features yet.

**Files created:**
- `package.json` — dependencies: next 15, tailwindcss, @supabase/supabase-js, @supabase/ssr, vitest, @vitejs/plugin-react, @testing-library/react
- `tailwind.config.ts` — design tokens from DESIGN.md (colors, fonts, spacing scale)
- `app/layout.tsx` — root layout with font imports (Bebas Neue, Outfit, DM Serif Display via next/font/google)
- `app/globals.css` — CSS custom properties for the color palette
- `lib/supabase/server.ts` — server-side Supabase client (uses `@supabase/ssr`)
- `lib/supabase/client.ts` — browser-side Supabase client
- `vitest.config.ts` — Vitest setup with jsdom environment
- `.env.local.example` — documents required env vars

**Dependencies:** none

**Test:** `npm run dev` starts without errors. `npm run test` runs with zero tests and exits cleanly.

---

### Module 2: Database Schema + RLS

**Delivers:** All three tables created in Supabase with correct columns, foreign keys, and RLS policies. Run via Supabase migrations.

**Files created:**
- `supabase/migrations/001_schema.sql` — creates `allowed_users`, `titles`, `user_title_meta`
- `supabase/migrations/002_rls.sql` — enables RLS and adds policies on all tables
- `supabase/seed.sql` — inserts the two `allowed_users` rows (replace UUIDs at setup)

**Key schema decisions (from spec):**
- `titles.removed_at` — soft-delete column, nullable timestamptz
- `titles.genres` — `text[]`, not a join table
- `titles.streaming_cached_at` — cache expiry sentinel
- `titles.letterboxd_search_url` — stored at add-time, constructed from title+year
- `user_title_meta` PK: `(user_id, title_id)`
- RLS on `titles`: `auth.uid() IN (SELECT id FROM allowed_users)`
- RLS on `user_title_meta`: `auth.uid() = user_id`

**Dependencies:** Module 1

**Test:** Run `supabase db push` locally. Confirm tables and policies exist in Supabase dashboard. Attempt a query as an anonymous user — it must be rejected.

---

### Module 3: Auth

**Delivers:** Login page at `/login`. Protected route middleware. Redirect to `/login` if unauthenticated; redirect away from `/login` if already authenticated.

**Files created:**
- `app/login/page.tsx` — email + password form, Supabase `signInWithPassword`
- `app/login/actions.ts` — server action for sign-in
- `middleware.ts` — Supabase session refresh + route protection
- `app/(app)/layout.tsx` — authenticated layout shell (bottom nav placeholder)

**Dependencies:** Modules 1–2

**Test:** Navigate to `/` unauthenticated → redirected to `/login`. Sign in → redirected to `/`. Sign out → back to `/login`.

---

### Module 4: TMDB API Route

**Delivers:** A server-side API route that proxies TMDB requests. Used by search, title metadata fetch, and the random picker.

**Files created:**
- `app/api/tmdb/route.ts` — GET handler; accepts `action` query param: `search`, `detail`, `discover`
- `lib/tmdb.ts` — typed TMDB response types (`TMDBMovie`, `TMDBSearchResult`, `TMDBDiscoverResult`)

**Endpoints proxied:**
- `search`: `/search/movie?query=...`
- `detail`: `/movie/[id]?append_to_response=credits`
- `discover`: `/discover/movie?with_watch_providers=...&watch_region=IT&...`

**Dependencies:** Module 1

**Test (unit):** Mock `fetch` in Vitest; assert the route constructs the correct TMDB URL for each `action`. Assert API key is never in the response body.

---

### Module 5: Streaming Availability API Route ✅

**Delivers:** A server-side API route that fetches Italy streaming data for a given TMDB ID and caches the result in `titles.streaming_data`.

**Files created:**
- `app/api/streaming/[tmdb_id]/route.ts` — GET handler; checks cache age, calls Streaming Availability API if stale (>24h), upserts result to `titles`
- `lib/streaming.ts` — typed response types (`StreamingPlatform`, `StreamingData`); platform badge color map

**Cache logic:**
1. Read `titles.streaming_cached_at` for the given TMDB ID
2. If null or >24h old: call Streaming Availability API, update `streaming_data` + `streaming_cached_at`
3. Return `streaming_data`

**Dependencies:** Modules 1–2

**Test (unit):** Assert that a fresh cache (< 24h) skips the external API call. Assert that a stale cache triggers a fetch and upserts the DB row.

---

### Module 6: Titles Data Layer ✅

**Delivers:** Typed Supabase query functions for all title and user-meta operations. No UI yet — just the data layer.

**Files created:**
- `lib/data/titles.ts` — `addTitle`, `getTitles`, `getTitleById`, `softDeleteTitle`, `markWatched`, `unmarkWatched`, `updateRuntime`
- `lib/data/user-meta.ts` — `upsertUserMeta`, `getUserMeta`
- `lib/data/stats.ts` — `getWatchStats` (total watched, total runtime, genre breakdown, monthly timeline, backlog count)
- `lib/types.ts` — shared `Title`, `UserMeta`, `WatchStats` TypeScript types

**Key behaviours:**
- `getTitles` always filters `removed_at IS NULL`
- `getWatchStats` genre breakdown uses Postgres `unnest(genres)` to count a title under all its genres
- `getWatchStats` total runtime excludes null `runtime_minutes` and returns `{ minutes: number, hasGaps: boolean }` — the UI prefixes `~` when `hasGaps` is true

**Dependencies:** Modules 1–2

**Test (integration):** Against a local Supabase instance — add a title, mark watched, soft-delete, confirm it disappears from `getTitles`. Add two watched titles with overlapping genres, confirm genre counts are correct.

---

### Module 7: Search & Add Page

**Delivers:** `/search` — debounced TMDB search input, results list with poster + year + "Already in list" badge, one-tap add to watchlist.

**Files created:**
- `app/(app)/search/page.tsx` — server component shell
- `app/(app)/search/search-input.tsx` — client component; debounced input, calls `/api/tmdb?action=search`
- `app/(app)/search/search-result-card.tsx` — poster, title, year, badge
- `app/(app)/search/actions.ts` — server action: calls `addTitle` from data layer

**Dependencies:** Modules 3–6

**Test:** Search for "Godfather" → results appear. Click add → title appears in watchlist. Search again → "Already in list" badge shows.

---

### Module 8: Watchlist Home (Shelf Layout)

**Delivers:** `/` — horizontal scrolling shelves. "Unwatched" shelf and "Watched" shelf. Filter bar (genre, platform, added-by). Poster cards with amber "want to watch" indicator.

**Files created:**
- `app/(app)/page.tsx` — server component; fetches titles from data layer; groups into shelves
- `app/(app)/components/shelf.tsx` — horizontal scroll container with `scroll-snap-type: x mandatory`
- `app/(app)/components/poster-card.tsx` — 2:3 poster, title overlay on hover/tap, red "watched" bar, genre badges
- `app/(app)/components/filter-bar.tsx` — client component; genre multi-select, platform select, added-by toggle

**Design constraints (from DESIGN.md):**
- Shelf shows ~1.5 posters on mobile (signals scrollability)
- No CSS grid for the main layout
- Poster title overlays via bottom gradient, not caption-below

**Dependencies:** Modules 3–7

**Test:** Watchlist with 3 unwatched + 1 watched → correct shelf grouping. Apply genre filter → only matching titles shown. Soft-deleted title must not appear.

---

### Module 9: Title Detail Page

**Delivers:** `/titles/[id]` — full metadata, streaming badges, watched toggle, per-user rating + note, Letterboxd search link, manual runtime input, soft-delete button.

**Files created:**
- `app/(app)/titles/[id]/page.tsx` — server component; fetches title + streaming data (synchronous cache refresh if stale) + user meta
- `app/(app)/titles/[id]/watched-toggle.tsx` — client component; calls `markWatched` / `unmarkWatched`
- `app/(app)/titles/[id]/rating-input.tsx` — client component; 5 amber stars, calls `upsertUserMeta`
- `app/(app)/titles/[id]/note-input.tsx` — client component; textarea, auto-save on blur
- `app/(app)/titles/[id]/runtime-input.tsx` — client component; shown only when `runtime_minutes` is null
- `app/(app)/titles/[id]/actions.ts` — server actions for all mutations on this page

**Streaming cache refresh:** In the server component, if `streaming_cached_at` is null or >24h, call `/api/streaming/[tmdb_id]` synchronously before rendering. User sees a brief loading state (Suspense boundary).

**Dependencies:** Modules 3–8

**Test:** Open detail page for title with stale streaming cache → fresh badges shown. Toggle watched → watched bar appears on poster card. Rate + add note → persists on reload.

---

### Module 10: Random Picker

**Delivers:** `/discover` — filter panel (source, platform, genre, runtime range), "Pick for me" button, result reveal with poster flip animation.

**Files created:**
- `app/(app)/discover/page.tsx` — client component (fully interactive)
- `app/(app)/discover/filter-panel.tsx` — source selector, platform dropdown (populates from TMDB provider list for IT), genre + runtime inputs
- `app/(app)/discover/picker-result.tsx` — poster flip reveal, "Add to watchlist" CTA
- `app/(app)/discover/actions.ts` — server action: picks randomly from watchlist or calls `/api/tmdb?action=discover` with `watch_region=IT&with_watch_providers=[id]`

**Random pick logic (from spec):**
- Source "My watchlist": filter Supabase titles client-side, pick random index
- Source "All TMDB": call discover → read `total_pages` → pick random page (max 500) → second call for that page → pick random item from results
- Platform filter uses TMDB `with_watch_providers` + `watch_region=IT`

**Dependencies:** Modules 3–9

**Test (unit):** Random pick from a 10-title watchlist — assert result is always in the list and `removed_at IS NULL`. Discover filter with `with_watch_providers` — assert the correct query param is sent to TMDB.

---

### Module 11: Stats Page

**Delivers:** `/stats` — total watched, total watch time (with `~` prefix if gaps), backlog count, genre breakdown chart, monthly timeline chart.

**Files created:**
- `app/(app)/stats/page.tsx` — server component; calls `getWatchStats`
- `app/(app)/stats/genre-chart.tsx` — client component; Recharts bar or donut chart
- `app/(app)/stats/timeline-chart.tsx` — client component; Recharts bar chart, last 12 months
- `app/(app)/stats/stat-card.tsx` — large Bebas Neue number + label

**Watch time display:** `Xh Ym` formatted from minutes. Prefix `~` when `hasGaps` is true (any watched title has null runtime).

**Dependencies:** Modules 3–9

**Test (unit):** `getWatchStats` with 3 watched titles (one null runtime) → `hasGaps: true`, correct minute sum for the two with runtime. Genre with Drama+Crime title → both bars increment. Monthly timeline groups by `watched_at` month correctly.

---

### Module 12: Settings + Global Layout

**Delivers:** `/settings` (display name + logout), bottom nav bar, global empty states, mobile layout polish.

**Files created:**
- `app/(app)/settings/page.tsx` — display name update (Supabase user metadata), sign-out button
- `app/(app)/components/bottom-nav.tsx` — four items: Watchlist, Discover, Stats, Search. Fixed, thumb-zone.
- `app/(app)/components/empty-shelf.tsx` — DM Serif Display italic empty state message
- Updates `app/(app)/layout.tsx` — adds `<BottomNav />`, sets `pb-16` to avoid nav overlap

**Dependencies:** Modules 3–11

**Test:** Sign out from settings → redirected to `/login`. Empty watchlist → empty state message shown (not a CTA). Bottom nav highlights active route.

---

## Dependency Graph

```
1 Scaffold
└── 2 Schema + RLS
    └── 3 Auth
        └── 4 TMDB Route ──┐
        └── 5 Streaming ───┤
        └── 6 Data Layer ──┼── 7 Search
                           ├── 8 Watchlist Home
                           ├── 9 Title Detail
                           ├── 10 Random Picker
                           ├── 11 Stats
                           └── 12 Settings + Nav
```

Modules 4–6 can be built in parallel after Module 3. Modules 7–12 each depend on 4–6 but are otherwise independent of each other.

---

## Verification

End-to-end smoke test after all modules:
1. Open app unauthenticated → redirected to `/login`
2. Sign in → see empty watchlist
3. Search for "The Godfather" → add it
4. Open detail → streaming badges load, Letterboxd link opens search page
5. Mark as watched → red bar on poster card
6. Rate 4 stars, add note → persists on reload
7. Go to `/discover`, pick from watchlist → result shown
8. Go to `/discover`, pick from "All TMDB" with Netflix IT filter → result shown
9. Go to `/stats` → watch time shows, genre breakdown has Drama + Crime bars
10. Go to `/settings` → sign out → redirected to `/login`
