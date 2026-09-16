# Showtime — Design Spec
**Date:** 2026-09-16
**Status:** Approved

---

## Overview

A private shared web app for two equal partners to manage a movie watchlist, track what they've watched, discover where to stream titles in Italy, and randomly pick what to watch next.

---

## Users & Access

- Two users, equal partners, full access to all shared data.
- No public signup. Both accounts created directly in the Supabase dashboard.
- The app exposes only a `/login` route — no `/register`.
- Auth: Supabase email + password.

---

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 15 (App Router) + Tailwind CSS |
| Backend | Next.js API routes (server-side API calls) |
| Database + Auth | Supabase |
| Deployment | Vercel |
| Testing | Vitest |

---

## Data Model

### `titles` — shared library

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `tmdb_id` | integer | unique |
| `title` | text | |
| `year` | integer | |
| `poster_url` | text | |
| `runtime_minutes` | integer nullable | from TMDB; editable manually if missing |
| `genres` | text[] | |
| `overview` | text | |
| `letterboxd_search_url` | text | search redirect, e.g. `https://letterboxd.com/search/films/The+Godfather+1972` |
| `watched` | boolean | shared flag |
| `watched_at` | timestamptz nullable | |
| `added_by` | uuid FK → auth.users | |
| `added_at` | timestamptz | |
| `streaming_data` | jsonb nullable | cached response from Streaming Availability API |
| `streaming_cached_at` | timestamptz nullable | |
| `removed_at` | timestamptz nullable | soft-delete; null means active |

### `user_title_meta` — per-user data on each title

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid FK → auth.users | |
| `title_id` | uuid FK → titles | |
| `want_to_watch` | boolean | default false |
| `rating` | integer nullable | 1–5 stars |
| `note` | text nullable | |
| `rated_at` | timestamptz nullable | |

Primary key: `(user_id, title_id)`

---

## Row Level Security

An `allowed_users` table holds exactly two rows (one per user). All RLS policies check membership in this table rather than relying on `auth.role()` alone.

- `titles`: `auth.uid() IN (SELECT id FROM allowed_users)` for read and write. Queries filter `removed_at IS NULL` at the application layer.
- `user_title_meta`: users can read and write only their own rows (`auth.uid() = user_id`), also gated on `allowed_users` membership.

---

## Pages

### `/` — Watchlist (home)
Shared list of all active titles (`removed_at IS NULL`). Default sort: added date descending.

Filters:
- Watched / Unwatched / All
- Genre (multi-select)
- Platform (e.g. Netflix IT, Prime IT)
- Added by

Each title card shows: poster, title, year, streaming platform badges, watched status indicator. Soft-deleted titles are hidden from all views.

### `/titles/[id]` — Title detail
- Full TMDB metadata: poster, overview, runtime, genres, cast
- Streaming availability for Italy (platform badges); fetched synchronously on first visit after cache expires (>24h), user waits ~1-2s for fresh data
- Letterboxd search link → `https://letterboxd.com/search/films/[title]+[year]` (always resolves, one extra click)
- Shared: watched toggle, watched date, soft-delete ("remove from list") button
- If `runtime_minutes` is null: inline "Add runtime" input, saves to `titles.runtime_minutes`
- Per-user: "want to watch" toggle, 1–5 star rating (optional), short note (optional)

### `/discover` — Random picker
Filter panel:
- Source: "My watchlist (unwatched)" | "All TMDB"
- Platform (optional; filters TMDB results by streaming availability in Italy via `watch_region=IT&with_watch_providers=[id]`)
- Genre
- Min / max runtime

"Pick for me" button → random title matching filters.

Result card: poster, title, streaming info, CTA to add to watchlist or mark intent.

When source is "My watchlist (unwatched)", the picker filters locally from Supabase (`removed_at IS NULL`, `watched = false`), applying any genre/runtime/platform filters client-side.

When source is "All TMDB", the picker calls TMDB's discover endpoint with all active filters, reads `total_pages` from the response, picks a random page, makes a second call for that page, then picks a random item from the results. Sorted by popularity descending (default) — popular-skewed random is intentional and useful. Platform filter uses TMDB's native `with_watch_providers` + `watch_region=IT`; no Streaming Availability API call needed.

### `/search` — Search & add
- Debounced TMDB search input
- Results: poster, title, year, "Already in list" badge if applicable
- One-click add to shared watchlist

### `/stats` — Statistics
All stats are computed queries over the `titles` table:

- **Total movies watched** — count of `watched = true`
- **Total watch time** — sum of `runtime_minutes` where `watched = true`; displayed as Xh Ym; prefixed with `~` if any watched title has null runtime
- **Backlog** — count of `watched = false`
- **Genre breakdown** — count of watched titles per genre, counting a title under all its genres (unnest `genres[]`); a Drama/Crime film adds 1 to both bars
- **Monthly timeline** — count of titles watched per month (bar chart, last 12 months)

### `/settings`
- Display name update
- Logout

---

## Integrations

### TMDB
- All calls via `/api/tmdb` Next.js API route (key server-side only)
- Used for: search, title metadata, random picker "All TMDB" source
- Runtime and genre data stored at add-time; never re-fetched (stable data)

### Streaming Availability API (Movieofthenight)
- All calls via `/api/streaming/[tmdb_id]` Next.js API route (key server-side only)
- Country filter: `IT`
- Response cached in `titles.streaming_data` + `titles.streaming_cached_at`
- Cache TTL: 24 hours — on detail page load, if cache is stale the API is called synchronously before the page renders; user waits ~1-2s, always sees fresh data
- Platforms displayed: whatever the API returns for Italy (Netflix, Prime Video, Disney+, Apple TV+, MUBI, Paramount+, NOW TV, etc.)
- Not used for the random picker — TMDB watch providers handle platform filtering there

### Letterboxd
- No API. Link is a search redirect constructed at render time: `https://letterboxd.com/search/films/[title]+[year]`
- Always resolves to a Letterboxd search results page — no silent 404s
- `letterboxd_search_url` stored in DB at add-time for consistency; trivially derived from title + year

---

## Watch Time Counter

- Summed from `runtime_minutes` of all `watched = true` titles
- Displayed as `Xh Ym` (e.g. "142h 30m")
- Titles with null runtime are excluded from the sum; if any are excluded, total is shown as `~142h 30m`
- `runtime_minutes` is editable on the title detail page if TMDB did not provide it

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Streaming API returns nothing | Show "No streaming info available for Italy" |
| Streaming cache stale | Refresh synchronously on detail page load; user sees a brief loading state |
| TMDB title metadata missing | Degrade to stored DB values (title, year, poster) |
| Letterboxd link | Always a search redirect — no 404 risk |
| Runtime missing from TMDB | Show "Add runtime" input on detail page |
| Concurrent rating edits | Supabase upsert, last write wins |

---

## Testing

Framework: **Vitest**

- **Unit:** random picker filter logic, watch time calculation (including `~` prefix logic), genre unnesting for stats, Letterboxd search URL construction
- **Integration:** adding a title to the watchlist, marking a title as watched and verifying runtime accumulation in the stats query, soft-deleting a title and verifying it disappears from all views
- No E2E tests (two known users, stable private app — overhead not justified)

---

## Out of Scope

- Push notifications
- Mobile app
- TV show episode tracking (titles only, no season/episode granularity)
- Social features (sharing outside the two users)
- Import from existing Letterboxd or IMDb lists (potential future addition)
