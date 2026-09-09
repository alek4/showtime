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
| `letterboxd_slug` | text | lowercased hyphenated title + year, e.g. `the-godfather-1972` |
| `watched` | boolean | shared flag |
| `watched_at` | timestamptz nullable | |
| `added_by` | uuid FK → auth.users | |
| `added_at` | timestamptz | |
| `streaming_data` | jsonb nullable | cached response from Streaming Availability API |
| `streaming_cached_at` | timestamptz nullable | |

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

- `titles`: authenticated users can read and write all rows (`auth.role() = 'authenticated'`).
- `user_title_meta`: users can read and write only their own rows (`auth.uid() = user_id`).

---

## Pages

### `/` — Watchlist (home)
Shared list of all added titles. Default sort: added date descending.

Filters:
- Watched / Unwatched / All
- Genre (multi-select)
- Platform (e.g. Netflix IT, Prime IT)
- Added by

Each title card shows: poster, title, year, streaming platform badges, watched status indicator.

### `/titles/[id]` — Title detail
- Full TMDB metadata: poster, overview, runtime, genres, cast
- Streaming availability for Italy (platform badges)
- Letterboxd external link → `https://letterboxd.com/film/[letterboxd_slug]`
- Shared: watched toggle, watched date
- If `runtime_minutes` is null: inline "Add runtime" input, saves to `titles.runtime_minutes`
- Per-user: "want to watch" toggle, 1–5 star rating (optional), short note (optional)

### `/discover` — Random picker
Filter panel:
- Source: "My watchlist (unwatched)" | "Streaming platform pool" | "All TMDB"
- Platform (when source is "Streaming platform pool" — required; selects one platform available in Italy)
- Genre
- Min / max runtime

"Pick for me" button → random title matching filters.

Result card: poster, title, streaming info, CTA to add to watchlist or mark intent.

When source is "My watchlist (unwatched)", the picker filters locally from Supabase.
When source is "Streaming platform pool", the picker queries the Streaming Availability API for titles available on the selected platform in Italy, then picks randomly from matching results.
When source is "All TMDB", the picker queries TMDB's discover endpoint with the selected filters and picks a random result page + position.

### `/search` — Search & add
- Debounced TMDB search input
- Results: poster, title, year, "Already in list" badge if applicable
- One-click add to shared watchlist

### `/stats` — Statistics
All stats are computed queries over the `titles` table:

- **Total movies watched** — count of `watched = true`
- **Total watch time** — sum of `runtime_minutes` where `watched = true`; displayed as Xh Ym; prefixed with `~` if any watched title has null runtime
- **Backlog** — count of `watched = false`
- **Genre breakdown** — count of watched titles per genre (bar or donut chart)
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
- Cache TTL: 24 hours — stale data shown while refresh runs in background on page load
- Platforms displayed: whatever the API returns for Italy (Netflix, Prime Video, Disney+, Apple TV+, MUBI, Paramount+, NOW TV, etc.)

### Letterboxd
- No API. Link constructed client-side: `https://letterboxd.com/film/[letterboxd_slug]`
- Slug stored in DB at add-time: lowercase title, spaces replaced with hyphens, year appended (e.g. `the-godfather-1972`)
- Edge case: slug may 404 on Letterboxd for ~5% of titles (special characters, remakes). Acceptable — no error handling beyond `target="_blank" rel="noopener"`

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
| Streaming cache stale | Show stale data; refresh in background |
| TMDB title metadata missing | Degrade to stored DB values (title, year, poster) |
| Letterboxd slug 404 | Link opens Letterboxd; 404 is on Letterboxd's side |
| Runtime missing from TMDB | Show "Add runtime" input on detail page |
| Concurrent rating edits | Supabase upsert, last write wins |

---

## Testing

Framework: **Vitest**

- **Unit:** random picker filter logic, watch time calculation (including `~` prefix logic)
- **Integration:** adding a title to the watchlist, marking a title as watched and verifying runtime accumulation in the stats query
- No E2E tests (two known users, stable private app — overhead not justified)

---

## Out of Scope

- Push notifications
- Mobile app
- TV show episode tracking (titles only, no season/episode granularity)
- Social features (sharing outside the two users)
- Import from existing Letterboxd or IMDb lists (potential future addition)
