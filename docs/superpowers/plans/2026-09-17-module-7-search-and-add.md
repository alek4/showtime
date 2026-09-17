# Module 7: Search & Add — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build the `/search` page — a debounced TMDB search input, a results list showing poster/title/year/"Already in list" badge, and a one-tap "Add" button that writes the title to the shared watchlist.

**Architecture:** The page is a server component that loads existing TMDB IDs from the DB and passes them to a `SearchClient` client component. `SearchClient` manages query state and debounced fetches to `/api/tmdb`; clicking "Add" calls a server action that writes the title. The "In list" state is updated optimistically client-side so the UI responds immediately, then `router.refresh()` re-syncs the server component.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS, Supabase, Vitest

**Spec:** `docs/superpowers/specs/2026-09-16-showtime-design.md`
**Conventions:** `CLAUDE.md`

## Global Constraints

- TypeScript everywhere — no `any`, use `unknown` and narrow
- No `"use client"` unless the component needs `useState`, `useEffect`, or browser event handlers
- All TMDB API calls server-side — never expose `TMDB_API_KEY` to the client
- Soft-delete only — never `DELETE` from `titles`; this page only adds titles
- TDD: write failing test → implement → green → commit. One commit per task.
- No co-author lines in commits
- Mobile-first — minimum 44px touch targets on interactive elements
- Design tokens in use: `bg-void`, `bg-surface`, `bg-raised`, `border-rim`, `text-primary`, `text-secondary`, `text-ghost`, `text-amber`, `font-display`, `font-body`
- No E2E tests per spec — Tasks 2–5 are verified manually by running the dev server

---

## File Structure

**New files:**

| File | Responsibility |
|------|----------------|
| `app/(app)/search/page.tsx` | Server component — loads `existingTmdbIds`, renders `SearchClient` |
| `app/(app)/search/search-client.tsx` | `"use client"` — query state, debounced fetch, results list, add handler |
| `app/(app)/search/search-result-card.tsx` | Presentational — poster thumbnail, title, year, "In list" badge or "Add" button |
| `app/(app)/search/actions.ts` | `'use server'` — `addTitleAction`: maps TMDB movie → `NewTitle`, calls `addTitle` |

**Modified files:**

| File | Change |
|------|--------|
| `lib/tmdb.ts` | Add `TMDB_GENRE_MAP` constant and `genreIdsToNames()` helper |
| `lib/tmdb.test.ts` | Add tests for `genreIdsToNames` |
| `next.config.ts` | Add `image.tmdb.org` to `images.remotePatterns` (required for `next/image`) |

**Existing files consumed (not modified):**
- `lib/data/titles.ts` — `getTitles()`, `addTitle()`, `buildLetterboxdUrl()`
- `lib/types.ts` — `NewTitle`
- `lib/tmdb.ts` — `TMDBMovie`, `TMDBSearchResult`, `tmdbPosterUrl()`
- `lib/supabase/server.ts` — `createClient()`

---

## Task 1: `genreIdsToNames` helper

**Files:**
- Modify: `lib/tmdb.ts`
- Modify: `lib/tmdb.test.ts`

**Interfaces:**
- Produces:
  - `TMDB_GENRE_MAP: Record<number, string>` — exported constant, consumed by `actions.ts` (Task 2)
  - `genreIdsToNames(ids: number[]): string[]` — consumed by `actions.ts` (Task 2)

TMDB search results return `genre_ids: number[]`, not genre names. `genreIdsToNames` maps them to human-readable strings using a hardcoded map. TMDB genre IDs for movies are stable and documented.

- [x] **Step 1: Write the failing test**

Append to `lib/tmdb.test.ts` (after the existing `tmdbPosterUrl` describe block):

```typescript
import { buildTmdbUrl, tmdbPosterUrl, genreIdsToNames } from './tmdb'

describe('genreIdsToNames', () => {
  it('maps known genre IDs to their names', () => {
    expect(genreIdsToNames([18, 80])).toEqual(['Drama', 'Crime'])
  })

  it('filters out unknown genre IDs', () => {
    expect(genreIdsToNames([18, 99999])).toEqual(['Drama'])
  })

  it('returns empty array for empty input', () => {
    expect(genreIdsToNames([])).toEqual([])
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/tmdb.test.ts`
Expected: FAIL — `genreIdsToNames is not a function`

- [x] **Step 3: Write minimal implementation**

Append to `lib/tmdb.ts` (after the existing helpers section):

```typescript
// Stable TMDB movie genre ID → name mapping (does not change between API versions)
export const TMDB_GENRE_MAP: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Science Fiction',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
}

export function genreIdsToNames(genreIds: number[]): string[] {
  return genreIds
    .map(id => TMDB_GENRE_MAP[id])
    .filter((name): name is string => name !== undefined)
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/tmdb.test.ts`
Expected: PASS — all tests green (including existing `buildTmdbUrl` and `tmdbPosterUrl` tests)

- [x] **Step 5: Commit**

```bash
git add lib/tmdb.ts lib/tmdb.test.ts
git commit -m "feat: add genreIdsToNames helper and TMDB_GENRE_MAP"
```

---

## Task 2: Image config + `addTitleAction` server action

**Files:**
- Modify: `next.config.ts` — allow `image.tmdb.org` for `next/image`
- Create: `app/(app)/search/actions.ts`

**Interfaces:**
- Consumes:
  - `TMDBMovie` from `@/lib/tmdb`
  - `tmdbPosterUrl(posterPath: string | null): string | null` from `@/lib/tmdb`
  - `genreIdsToNames(ids: number[]): string[]` from `@/lib/tmdb` (Task 1)
  - `buildLetterboxdUrl(title: string, year: number): string` from `@/lib/data/titles`
  - `addTitle(input: NewTitle): Promise<Title>` from `@/lib/data/titles`
  - `NewTitle` from `@/lib/types`
- Produces: `addTitleAction(movie: TMDBMovie): Promise<void>` — called by `SearchClient` (Task 4)

**Why no unit test:** Server actions use the `'use server'` directive and depend on Next.js request context. The codebase follows the precedent of `app/login/actions.ts` which is also untested at the unit level. The data layer functions it calls are already tested.

- [x] **Step 1: Update `next.config.ts`**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'image.tmdb.org' },
    ],
  },
}

export default nextConfig
```

- [x] **Step 2: Create `app/(app)/search/actions.ts`**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { addTitle, buildLetterboxdUrl } from '@/lib/data/titles'
import { genreIdsToNames, tmdbPosterUrl } from '@/lib/tmdb'
import type { NewTitle } from '@/lib/types'
import type { TMDBMovie } from '@/lib/tmdb'

export async function addTitleAction(movie: TMDBMovie): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const year = movie.release_date
    ? parseInt(movie.release_date.slice(0, 4), 10)
    : new Date().getFullYear()

  const newTitle: NewTitle = {
    tmdb_id: movie.id,
    title: movie.title,
    year,
    poster_url: tmdbPosterUrl(movie.poster_path),
    runtime_minutes: null,  // not available in search results; user can add via detail page
    genres: genreIdsToNames(movie.genre_ids),
    overview: movie.overview,
    letterboxd_search_url: buildLetterboxdUrl(movie.title, year),
    added_by: user.id,
  }

  try {
    await addTitle(newTitle)
  } catch (err) {
    // Unique constraint violation (Postgres code 23505) — another user already added this
    // title between search and click. Treat as success: the title is in the list.
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === '23505'
    ) {
      return
    }
    throw err
  }
}
```

- [x] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: zero errors

- [x] **Step 4: Commit**

```bash
git add next.config.ts app/(app)/search/actions.ts
git commit -m "feat: add addTitleAction server action and TMDB image domain config"
```

---

## Task 3: `SearchResultCard` component

**Files:**
- Create: `app/(app)/search/search-result-card.tsx`

**Interfaces:**
- Consumes:
  - `TMDBMovie` from `@/lib/tmdb`
  - `tmdbPosterUrl(posterPath: string | null): string | null` from `@/lib/tmdb`
- Produces:
  - `SearchResultCard({ movie, isInList, isAdding, onAdd }: SearchResultCardProps)` — rendered by `SearchClient` (Task 4)

This component has no own state and no `"use client"` directive. It is rendered inside `SearchClient` (a client component), so it executes client-side automatically. The `onAdd` prop is a plain function — valid within the client component tree.

- [x] **Step 1: Create `app/(app)/search/search-result-card.tsx`**

```typescript
import Image from 'next/image'
import { tmdbPosterUrl } from '@/lib/tmdb'
import type { TMDBMovie } from '@/lib/tmdb'

type SearchResultCardProps = {
  movie: TMDBMovie
  isInList: boolean
  isAdding: boolean
  onAdd: () => void
}

export function SearchResultCard({ movie, isInList, isAdding, onAdd }: SearchResultCardProps) {
  const year = movie.release_date
    ? parseInt(movie.release_date.slice(0, 4), 10)
    : null
  const posterUrl = tmdbPosterUrl(movie.poster_path)

  return (
    <li className="flex items-center gap-3 py-3 border-b border-rim last:border-b-0">
      <div className="w-10 shrink-0">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={movie.title}
            width={40}
            height={60}
            className="rounded object-cover"
          />
        ) : (
          <div className="w-10 h-[60px] bg-raised rounded" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-body font-medium text-primary truncate">{movie.title}</p>
        {year !== null && (
          <p className="font-body text-sm text-secondary">{year}</p>
        )}
      </div>

      <div className="shrink-0">
        {isInList ? (
          <span className="font-body text-xs text-ghost border border-ghost/30 rounded px-2 py-1">
            In list
          </span>
        ) : (
          <button
            onClick={onAdd}
            disabled={isAdding}
            className="font-body text-sm text-amber border border-amber/50 rounded px-3 min-h-[44px] disabled:opacity-40 transition-opacity"
          >
            {isAdding ? '…' : 'Add'}
          </button>
        )}
      </div>
    </li>
  )
}
```

- [x] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: zero errors

- [x] **Step 3: Commit**

```bash
git add "app/(app)/search/search-result-card.tsx"
git commit -m "feat: add SearchResultCard component"
```

---

## Task 4: `SearchClient` component

**Files:**
- Create: `app/(app)/search/search-client.tsx`

**Interfaces:**
- Consumes:
  - `SearchResultCard` from `./search-result-card` (Task 3)
  - `addTitleAction(movie: TMDBMovie): Promise<void>` from `./actions` (Task 2)
  - `TMDBMovie`, `TMDBSearchResult` from `@/lib/tmdb`
- Produces: `SearchClient({ existingTmdbIds }: { existingTmdbIds: number[] })` — rendered by `SearchPage` (Task 5)

Debounce delay is 400ms — fast enough to feel responsive, slow enough to avoid hammering the API on every keystroke.

`inList` is initialized from the `existingTmdbIds` prop (server-provided) and updated optimistically on each add. `router.refresh()` re-renders the server component to sync any stale server-side state after an add.

- [x] **Step 1: Create `app/(app)/search/search-client.tsx`**

```typescript
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { SearchResultCard } from './search-result-card'
import { addTitleAction } from './actions'
import type { TMDBMovie, TMDBSearchResult } from '@/lib/tmdb'

type Props = { existingTmdbIds: number[] }

export function SearchClient({ existingTmdbIds }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TMDBMovie[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState<number | null>(null)
  const [inList, setInList] = useState(() => new Set(existingTmdbIds))
  const router = useRouter()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!query.trim()) {
      setResults([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/tmdb?action=search&query=${encodeURIComponent(query.trim())}`
        )
        const data = (await res.json()) as TMDBSearchResult
        setResults(data.results ?? [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 400)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  async function handleAdd(movie: TMDBMovie) {
    setAdding(movie.id)
    try {
      await addTitleAction(movie)
      setInList(prev => new Set([...prev, movie.id]))
      router.refresh()
    } catch {
      // Server action failed — button reverts to "Add"; user can retry
    } finally {
      setAdding(null)
    }
  }

  return (
    <div>
      <input
        type="search"
        placeholder="Search movies…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        className="w-full bg-raised border border-rim rounded-lg px-4 py-3 font-body text-primary placeholder:text-ghost focus:outline-none focus:border-amber"
      />

      {loading && (
        <p className="font-body text-sm text-ghost mt-4 opacity-40">Searching…</p>
      )}

      {!loading && query.trim() && results.length === 0 && (
        <p className="font-body text-sm text-ghost mt-4">No results for "{query}".</p>
      )}

      <ul className="mt-2">
        {results.map(movie => (
          <SearchResultCard
            key={movie.id}
            movie={movie}
            isInList={inList.has(movie.id)}
            isAdding={adding === movie.id}
            onAdd={() => handleAdd(movie)}
          />
        ))}
      </ul>
    </div>
  )
}
```

- [x] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: zero errors

- [x] **Step 3: Commit**

```bash
git add "app/(app)/search/search-client.tsx"
git commit -m "feat: add SearchClient with debounced TMDB search and optimistic add"
```

---

## Task 5: Search page + smoke test

**Files:**
- Create: `app/(app)/search/page.tsx`

**Interfaces:**
- Consumes:
  - `getTitles(): Promise<Title[]>` from `@/lib/data/titles`
  - `SearchClient` from `./search-client` (Task 4)

- [x] **Step 1: Create `app/(app)/search/page.tsx`**

```typescript
import { getTitles } from '@/lib/data/titles'
import { SearchClient } from './search-client'

export default async function SearchPage() {
  const titles = await getTitles()
  const existingTmdbIds = titles.map(t => t.tmdb_id)

  return (
    <main className="bg-void min-h-screen px-4 pt-6 pb-4 max-w-lg mx-auto">
      <h1 className="font-display text-4xl tracking-wide text-primary mb-6">Search</h1>
      <SearchClient existingTmdbIds={existingTmdbIds} />
    </main>
  )
}
```

- [x] **Step 2: Run the full test suite to confirm nothing broke**

Run: `npx vitest run`
Expected: all tests pass (70 total — 69 from Module 6 + 3 new `genreIdsToNames` tests)

- [x] **Step 3: Run the dev server and smoke test**

Run: `npm run dev`

Navigate to `http://localhost:3000/search` (sign in first if redirected to `/login`).

Checklist:
- [x] Page renders with "Search" heading and an input field
- [x] Type "Godfather" → after ~400ms, a list of results appears with posters, titles, years
- [x] Results with a `null` poster show a placeholder box (no broken image)
- [x] "Add" button has at least 44px height
- [x] Click "Add" on The Godfather → button shows "…" then changes to "In list" badge
- [x] Type "Godfather" again → The Godfather shows "In list" badge immediately
- [x] Type a nonsense query → "No results for…" message appears

- [x] **Step 4: Commit**

```bash
git add "app/(app)/search/page.tsx"
git commit -m "feat: add /search page with TMDB search and add to watchlist"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Task |
|---|---|
| Debounced TMDB search input | Task 4 — 400ms `setTimeout` in `useEffect` |
| Results show poster, title, year | Task 3 — `SearchResultCard` |
| "Already in list" badge | Task 3 — `isInList` prop; Task 4 — `inList` Set updated optimistically |
| One-click add to watchlist | Task 4 — `handleAdd` → `addTitleAction` → `addTitle` |
| Genres stored at add-time | Task 2 — `genreIdsToNames(movie.genre_ids)` in server action |
| `letterboxd_search_url` stored at add-time | Task 2 — `buildLetterboxdUrl(title, year)` in server action |
| `runtime_minutes` null for search-added titles (editable on detail page) | Task 2 — `runtime_minutes: null` in `NewTitle` |
| All TMDB calls server-side | Task 4 — client fetches `/api/tmdb` route, never `process.env.TMDB_API_KEY` directly |
| Soft-delete — no DELETE | This page only calls `addTitle`, never deletes |
| `added_by` populated | Task 2 — `user.id` from `supabase.auth.getUser()` |

### Placeholder scan

No TBDs, TODOs, or vague steps. All component and action code is written out in full.

### Type consistency

- `TMDBMovie` defined in `lib/tmdb.ts` → received in `addTitleAction(movie: TMDBMovie)` (Task 2) → typed in `SearchClient` state (Task 4) → passed to `SearchResultCard` (Task 3). ✅
- `TMDBSearchResult` defined in `lib/tmdb.ts` → used in `SearchClient` fetch cast (Task 4). ✅
- `NewTitle` defined in `lib/types.ts` → constructed in `addTitleAction` (Task 2). ✅
- `genreIdsToNames` defined in Task 1 → imported in `actions.ts` (Task 2). ✅
- `SearchResultCard` props: `{ movie: TMDBMovie, isInList: boolean, isAdding: boolean, onAdd: () => void }` — defined in Task 3, consumed in Task 4. ✅
- `SearchClient` prop: `{ existingTmdbIds: number[] }` — defined in Task 4, consumed in Task 5. ✅
