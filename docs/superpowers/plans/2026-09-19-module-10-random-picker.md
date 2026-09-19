# Module 10 — Random Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/discover` — a random movie picker with two sources ("My watchlist" and "All TMDB"), filters for platform/genre/runtime, and a result card with an add-to-watchlist CTA.

**Architecture:** Server component (`page.tsx`) fetches all active titles and passes them to a single client component (`picker-client.tsx`) that owns all interactive state. Filter logic lives in `lib/picker.ts` as pure functions. Two pick paths: (1) client-side filter over the passed titles for "My watchlist", (2) two-step TMDB discover API calls via the existing `/api/tmdb` route for "All TMDB".

**Tech Stack:** Next.js 15 App Router, Tailwind CSS, Vitest, existing `/api/tmdb` proxy route, `lib/tmdb.ts` types

**Spec:** `docs/superpowers/specs/2026-09-16-showtime-design.md`
**Conventions:** `CLAUDE.md`

## Global Constraints

- TypeScript everywhere — no `any`, use `unknown` and narrow
- No `"use client"` unless the component needs `useState`, `useEffect`, or browser event handlers
- All API keys server-side only — never in client components or `NEXT_PUBLIC_` vars (TMDB calls go through `/api/tmdb`, never direct from client)
- Soft-delete: `getTitles()` already filters `removed_at IS NULL` — no extra filter needed
- TDD: write failing test → implement → green → commit. One commit per green test (or test suite for a file).
- No co-author lines in commits
- Tailwind only — no inline `style={}`, no CSS modules
- Minimum 44px touch targets on all interactive elements
- Colors: `bg-void`, `bg-surface`, `bg-raised`, `border-rim`, `text-primary`, `text-secondary`, `text-ghost`, `bg-amber`/`text-amber`, `bg-crimson`/`text-crimson`. No `bg-red-*`, no `border-border`.
- `rating` column is now `numeric(2,1)` (0.5–5.0) — not `integer 1–5` (see CLAUDE.md)
- `user_title_meta.rating` stored as display value (no ×2 multiplication)
- `deduplicatePlatforms()` is in `lib/streaming.ts` — use it wherever platform lists are shown
- Do NOT call the Streaming Availability API in this module — platform filtering uses TMDB `with_watch_providers` + `watch_region=IT` for "All TMDB" source, and `streaming_data` already in the DB for "My watchlist" source

---

## File Structure

```
lib/picker.ts               — PickerFilters type, filterWatchlistTitles, pickRandom, TMDB_PROVIDER_MAP
lib/picker.test.ts          — unit tests for all filter combinations and random pick
app/(app)/discover/
  page.tsx                  — server component: auth guard, getTitles(), pass props to client
  picker-client.tsx         — client component: all state, filter panel, both pick paths, result card
```

No new API routes. The existing `/api/tmdb?action=discover` handles TMDB calls.

---

## Interfaces between tasks

**Task 1 produces → Task 2 consumes:**
```typescript
// lib/picker.ts
export type PickerFilters = {
  source: 'watchlist' | 'tmdb'
  platform: string | null   // Streaming Availability service.id, e.g. 'netflix'
  genre: string | null      // genre name, e.g. 'Drama'
  minRuntime: number | null
  maxRuntime: number | null
}

export const TMDB_PROVIDER_MAP: Record<string, number>
// Maps service.id → TMDB watch provider ID for watch_region=IT
// { netflix: 8, prime: 119, disney: 337, apple: 350, mubi: 11, paramount: 531, now: 39 }
// These IDs are best-effort. Verify against TMDB /watch/providers/movie?watch_region=IT if results seem wrong.

export function filterWatchlistTitles(
  titles: Title[],   // already unwatched (caller pre-filters); function applies genre/platform/runtime
  filters: Pick<PickerFilters, 'genre' | 'platform' | 'minRuntime' | 'maxRuntime'>
): Title[]

export function pickRandom<T>(items: T[]): T | null
```

---

## Task 1: Picker filter logic + tests

**Files:**
- Create: `lib/picker.ts`
- Create: `lib/picker.test.ts`

**Interfaces:**
- Consumes: `Title` from `@/lib/types`, `getItPlatforms` from `@/lib/streaming`
- Produces: `PickerFilters`, `TMDB_PROVIDER_MAP`, `filterWatchlistTitles`, `pickRandom` (see exact signatures above)

---

- [x] **Step 1: Write the failing tests**

Create `lib/picker.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { filterWatchlistTitles, pickRandom } from './picker'
import type { Title } from '@/lib/types'

function makeTitle(overrides: Partial<Title> = {}): Title {
  return {
    id: 'id-1',
    tmdb_id: 1,
    title: 'Test Movie',
    year: 2020,
    poster_url: null,
    runtime_minutes: 120,
    genres: ['Drama'],
    overview: '',
    letterboxd_search_url: '',
    watched: false,
    watched_at: null,
    added_by: 'user-1',
    added_at: '2024-01-01T00:00:00Z',
    streaming_data: null,
    streaming_cached_at: null,
    removed_at: null,
    ...overrides,
  }
}

const noFilters = { genre: null, platform: null, minRuntime: null, maxRuntime: null }

describe('filterWatchlistTitles', () => {
  it('returns all titles when no filters applied', () => {
    const titles = [makeTitle({ id: '1' }), makeTitle({ id: '2' })]
    expect(filterWatchlistTitles(titles, noFilters)).toHaveLength(2)
  })

  it('filters by genre — keeps only titles that include the genre', () => {
    const titles = [
      makeTitle({ id: '1', genres: ['Drama', 'Crime'] }),
      makeTitle({ id: '2', genres: ['Comedy'] }),
    ]
    const result = filterWatchlistTitles(titles, { ...noFilters, genre: 'Drama' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('filters by minRuntime — excludes titles below the threshold', () => {
    const titles = [
      makeTitle({ id: '1', runtime_minutes: 90 }),
      makeTitle({ id: '2', runtime_minutes: 150 }),
    ]
    const result = filterWatchlistTitles(titles, { ...noFilters, minRuntime: 100 })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('2')
  })

  it('filters by minRuntime — excludes titles with null runtime', () => {
    const titles = [makeTitle({ runtime_minutes: null })]
    expect(filterWatchlistTitles(titles, { ...noFilters, minRuntime: 60 })).toHaveLength(0)
  })

  it('filters by maxRuntime — keeps titles at or below threshold', () => {
    const titles = [
      makeTitle({ id: '1', runtime_minutes: 90 }),
      makeTitle({ id: '2', runtime_minutes: 150 }),
    ]
    const result = filterWatchlistTitles(titles, { ...noFilters, maxRuntime: 120 })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('filters by maxRuntime — titles with null runtime are included', () => {
    const titles = [
      makeTitle({ id: '1', runtime_minutes: 90 }),
      makeTitle({ id: '2', runtime_minutes: null }),
    ]
    const result = filterWatchlistTitles(titles, { ...noFilters, maxRuntime: 120 })
    expect(result).toHaveLength(2)
  })

  it('filters by platform — keeps only titles available on the given service', () => {
    const netflixData = {
      streamingOptions: {
        it: [{
          service: { id: 'netflix', name: 'Netflix', homePage: '', themeColorCode: '', imageSet: {} },
          type: 'subscription' as const,
          link: '',
        }],
      },
    }
    const titles = [
      makeTitle({ id: '1', streaming_data: netflixData }),
      makeTitle({ id: '2', streaming_data: null }),
    ]
    const result = filterWatchlistTitles(titles, { ...noFilters, platform: 'netflix' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('applies multiple filters together', () => {
    const titles = [
      makeTitle({ id: '1', genres: ['Drama'], runtime_minutes: 90 }),
      makeTitle({ id: '2', genres: ['Drama'], runtime_minutes: 200 }),
      makeTitle({ id: '3', genres: ['Comedy'], runtime_minutes: 90 }),
    ]
    const result = filterWatchlistTitles(titles, { ...noFilters, genre: 'Drama', maxRuntime: 120 })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })
})

describe('pickRandom', () => {
  it('returns null for an empty array', () => {
    expect(pickRandom([])).toBeNull()
  })

  it('returns the only element of a single-element array', () => {
    expect(pickRandom([42])).toBe(42)
  })

  it('always returns an element contained in the input array', () => {
    const items = [1, 2, 3, 4, 5]
    for (let i = 0; i < 30; i++) {
      expect(items).toContain(pickRandom(items))
    }
  })
})
```

- [x] **Step 2: Run tests — confirm they fail**

```bash
npx cross-env NODE_OPTIONS=--experimental-vm-modules npx vitest run lib/picker.test.ts
```

Expected: FAIL — "Cannot find module './picker'"

- [x] **Step 3: Implement `lib/picker.ts`**

```typescript
import { getItPlatforms } from '@/lib/streaming'
import type { Title } from '@/lib/types'

export type PickerFilters = {
  source: 'watchlist' | 'tmdb'
  platform: string | null   // Streaming Availability service.id ('netflix', 'prime', etc.)
  genre: string | null      // genre name, e.g. 'Drama'
  minRuntime: number | null
  maxRuntime: number | null
}

// Maps Streaming Availability service.id → TMDB watch provider ID for watch_region=IT.
// Verify against TMDB /watch/providers/movie?watch_region=IT if results seem wrong.
export const TMDB_PROVIDER_MAP: Record<string, number> = {
  netflix:   8,
  prime:     119,
  disney:    337,
  apple:     350,
  mubi:      11,
  paramount: 531,
  now:       39,
}

// Filters a list of pre-selected unwatched titles by the user's picker filters.
// Does not re-check title.watched — callers must pass only unwatched titles.
export function filterWatchlistTitles(
  titles: Title[],
  filters: Pick<PickerFilters, 'genre' | 'platform' | 'minRuntime' | 'maxRuntime'>
): Title[] {
  return titles.filter(title => {
    if (filters.genre && !title.genres.includes(filters.genre)) return false
    if (
      filters.minRuntime !== null &&
      (title.runtime_minutes === null || title.runtime_minutes < filters.minRuntime)
    ) return false
    if (
      filters.maxRuntime !== null &&
      title.runtime_minutes !== null &&
      title.runtime_minutes > filters.maxRuntime
    ) return false
    if (filters.platform !== null) {
      const platforms = getItPlatforms(title.streaming_data)
      if (!platforms.some(p => p.service.id === filters.platform)) return false
    }
    return true
  })
}

export function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) return null
  return items[Math.floor(Math.random() * items.length)]
}
```

- [x] **Step 4: Run tests — confirm they pass**

```bash
npx cross-env NODE_OPTIONS=--experimental-vm-modules npx vitest run lib/picker.test.ts
```

Expected: all tests PASS

- [x] **Step 5: Commit**

```bash
git add lib/picker.ts lib/picker.test.ts
git commit -m "feat: add picker filter logic, pickRandom, and TMDB provider map"
```

---

## Task 2: Discover page + full PickerClient

**Files:**
- Create: `app/(app)/discover/page.tsx`
- Create: `app/(app)/discover/picker-client.tsx`

**Interfaces:**
- Consumes from Task 1: `filterWatchlistTitles`, `pickRandom`, `TMDB_PROVIDER_MAP`, `PickerFilters`
- Consumes from existing code:
  - `createClient` from `@/lib/supabase/server`
  - `getTitles` from `@/lib/data/titles`
  - `addTitleAction` from `../search/actions` (server action — imports across feature dirs are fine)
  - `TMDB_GENRE_MAP`, `tmdbPosterUrl`, `TMDBMovie`, `TMDBDiscoverResult` from `@/lib/tmdb`
  - `PLATFORM_COLORS`, `deduplicatePlatforms`, `getItPlatforms` from `@/lib/streaming`
  - `Title` from `@/lib/types`

No new tests — filter logic is fully covered by Task 1. Manual smoke test after implementation.

---

- [x] **Step 1: Create the server component `app/(app)/discover/page.tsx`**

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTitles } from '@/lib/data/titles'
import { PickerClient } from './picker-client'

export default async function DiscoverPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const allTitles = await getTitles()
  const unwatchedTitles = allTitles.filter(t => !t.watched)
  // Maps tmdb_id → title.id for all active titles (watched or not)
  // Used to show "View details" link when a TMDB discover result is already in our list
  const tmdbIdToTitleId: Record<number, string> = Object.fromEntries(
    allTitles.map(t => [t.tmdb_id, t.id])
  )

  return (
    <main className="bg-void min-h-screen pb-24">
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <h1 className="font-display text-4xl tracking-wide text-primary mb-6">Discover</h1>
        <PickerClient unwatchedTitles={unwatchedTitles} tmdbIdToTitleId={tmdbIdToTitleId} />
      </div>
    </main>
  )
}
```

- [x] **Step 2: Create `app/(app)/discover/picker-client.tsx`**

Implement the complete client component. Read carefully — there are two distinct pick paths and the result card handles both.

```typescript
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { filterWatchlistTitles, pickRandom, TMDB_PROVIDER_MAP } from '@/lib/picker'
import type { PickerFilters } from '@/lib/picker'
import { TMDB_GENRE_MAP, tmdbPosterUrl } from '@/lib/tmdb'
import type { TMDBMovie, TMDBDiscoverResult } from '@/lib/tmdb'
import { PLATFORM_COLORS, deduplicatePlatforms, getItPlatforms } from '@/lib/streaming'
import { addTitleAction } from '../search/actions'
import type { Title } from '@/lib/types'

type WatchlistResult = { kind: 'watchlist'; title: Title }
type TmdbResult = { kind: 'tmdb'; movie: TMDBMovie; existingTitleId: string | null }
type PickResult = WatchlistResult | TmdbResult

type Props = {
  unwatchedTitles: Title[]
  tmdbIdToTitleId: Record<number, string>
}

const ALL_GENRES = Object.values(TMDB_GENRE_MAP).sort()
const ALL_PLATFORMS = Object.entries(PLATFORM_COLORS).map(([id, { label }]) => ({ id, label }))

export function PickerClient({ unwatchedTitles, tmdbIdToTitleId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [source, setSource] = useState<'watchlist' | 'tmdb'>('watchlist')
  const [platform, setPlatform] = useState<string | null>(null)
  const [genre, setGenre] = useState<string | null>(null)
  const [minRuntime, setMinRuntime] = useState('')
  const [maxRuntime, setMaxRuntime] = useState('')
  const [result, setResult] = useState<PickResult | null>(null)
  const [noMatch, setNoMatch] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)

  const filters: PickerFilters = {
    source,
    platform,
    genre,
    minRuntime: minRuntime ? parseInt(minRuntime, 10) : null,
    maxRuntime: maxRuntime ? parseInt(maxRuntime, 10) : null,
  }

  function resetResult() {
    setResult(null)
    setNoMatch(false)
    setError(null)
  }

  function handlePick() {
    resetResult()

    if (source === 'watchlist') {
      const filtered = filterWatchlistTitles(unwatchedTitles, filters)
      const picked = pickRandom(filtered)
      if (!picked) {
        setNoMatch(true)
      } else {
        setResult({ kind: 'watchlist', title: picked })
      }
      return
    }

    // "All TMDB" — two-step discover: first call reads total_pages, second fetches a random page
    startTransition(async () => {
      try {
        const params = new URLSearchParams({ action: 'discover', sort_by: 'popularity.desc' })
        if (filters.genre) {
          const genreEntry = Object.entries(TMDB_GENRE_MAP).find(([, name]) => name === filters.genre)
          if (genreEntry) params.set('with_genres', genreEntry[0])
        }
        if (filters.platform) {
          const providerId = TMDB_PROVIDER_MAP[filters.platform]
          if (providerId !== undefined) params.set('with_watch_providers', String(providerId))
        }
        if (filters.minRuntime) params.set('with_runtime.gte', String(filters.minRuntime))
        if (filters.maxRuntime) params.set('with_runtime.lte', String(filters.maxRuntime))
        params.set('page', '1')

        const res1 = await fetch(`/api/tmdb?${params}`)
        if (!res1.ok) throw new Error('TMDB request failed')
        const data1 = (await res1.json()) as TMDBDiscoverResult
        const totalPages = Math.min(data1.total_pages, 500)  // TMDB caps at page 500

        if (totalPages === 0 || data1.results.length === 0) {
          setNoMatch(true)
          return
        }

        const randomPage = Math.floor(Math.random() * totalPages) + 1
        let candidates = data1.results
        if (randomPage > 1) {
          params.set('page', String(randomPage))
          const res2 = await fetch(`/api/tmdb?${params}`)
          if (res2.ok) {
            const data2 = (await res2.json()) as TMDBDiscoverResult
            if (data2.results.length > 0) candidates = data2.results
          }
        }

        const movie = pickRandom(candidates)
        if (!movie) {
          setNoMatch(true)
          return
        }
        setResult({
          kind: 'tmdb',
          movie,
          existingTitleId: tmdbIdToTitleId[movie.id] ?? null,
        })
      } catch {
        setError('Something went wrong. Try again.')
      }
    })
  }

  async function handleAdd(movie: TMDBMovie) {
    setIsAdding(true)
    try {
      await addTitleAction(movie)
      // router.refresh() causes page.tsx to re-fetch getTitles(), updating tmdbIdToTitleId
      // so the button changes from "Add" to "View details" without a full page reload
      router.refresh()
    } finally {
      setIsAdding(false)
    }
  }

  const selectClass =
    'w-full bg-surface border border-rim rounded px-3 py-2 font-body text-sm text-primary min-h-[44px] focus:outline-none focus:border-amber/50'

  return (
    <div className="flex flex-col gap-6">
      {/* Source toggle */}
      <div className="flex gap-2">
        {(['watchlist', 'tmdb'] as const).map(s => (
          <button
            key={s}
            onClick={() => { setSource(s); resetResult() }}
            className={`font-body text-sm rounded-full px-4 py-2 min-h-[44px] border transition-colors ${
              source === s ? 'text-amber border-amber' : 'text-ghost border-rim hover:text-secondary hover:border-secondary/50'
            }`}
          >
            {s === 'watchlist' ? 'My watchlist' : 'All TMDB'}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div>
          <label className="font-body text-xs text-secondary mb-1 block">Platform</label>
          <select value={platform ?? ''} onChange={e => setPlatform(e.target.value || null)} className={selectClass}>
            <option value="">Any platform</option>
            {ALL_PLATFORMS.map(p => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="font-body text-xs text-secondary mb-1 block">Genre</label>
          <select value={genre ?? ''} onChange={e => setGenre(e.target.value || null)} className={selectClass}>
            <option value="">Any genre</option>
            {ALL_GENRES.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="font-body text-xs text-secondary mb-1 block">Min runtime (min)</label>
            <input
              type="number"
              value={minRuntime}
              onChange={e => setMinRuntime(e.target.value)}
              placeholder="e.g. 90"
              min={1}
              className="w-full bg-surface border border-rim rounded px-3 py-2 font-body text-sm text-primary min-h-[44px] placeholder:text-ghost focus:outline-none focus:border-amber/50"
            />
          </div>
          <div className="flex-1">
            <label className="font-body text-xs text-secondary mb-1 block">Max runtime (min)</label>
            <input
              type="number"
              value={maxRuntime}
              onChange={e => setMaxRuntime(e.target.value)}
              placeholder="e.g. 150"
              min={1}
              className="w-full bg-surface border border-rim rounded px-3 py-2 font-body text-sm text-primary min-h-[44px] placeholder:text-ghost focus:outline-none focus:border-amber/50"
            />
          </div>
        </div>
      </div>

      {/* Pick button */}
      <button
        onClick={handlePick}
        disabled={isPending}
        className="w-full font-display text-2xl tracking-wide bg-amber text-void rounded py-4 min-h-[56px] disabled:opacity-50 transition-opacity"
      >
        {isPending ? 'Picking…' : 'Pick for me'}
      </button>

      {/* Feedback */}
      {noMatch && (
        <p className="font-body text-sm text-secondary text-center">
          No titles match your filters.{source === 'watchlist' ? ' Try broadening your criteria.' : ''}
        </p>
      )}
      {error && (
        <p className="font-body text-sm text-crimson text-center">{error}</p>
      )}

      {/* Result */}
      {result && (
        <div className="border-t border-rim pt-6">
          <PickerResultCard result={result} onAdd={handleAdd} isAdding={isAdding} />
        </div>
      )}
    </div>
  )
}

// ── Result card ──────────────────────────────────────────────────────────────

function PickerResultCard({
  result,
  onAdd,
  isAdding,
}: {
  result: PickResult
  onAdd: (movie: TMDBMovie) => void
  isAdding: boolean
}) {
  const posterUrl =
    result.kind === 'watchlist'
      ? result.title.poster_url
      : tmdbPosterUrl(result.movie.poster_path)

  const titleText =
    result.kind === 'watchlist' ? result.title.title : result.movie.title

  const year =
    result.kind === 'watchlist'
      ? result.title.year
      : result.movie.release_date
      ? parseInt(result.movie.release_date.slice(0, 4), 10)
      : null

  // Streaming platform badges — only available for watchlist titles (streaming_data in DB)
  const platforms =
    result.kind === 'watchlist'
      ? deduplicatePlatforms(getItPlatforms(result.title.streaming_data)).slice(0, 3)
      : []

  // Link to detail page if the title is already in our watchlist
  const detailHref =
    result.kind === 'watchlist'
      ? `/titles/${result.title.id}`
      : result.existingTitleId
      ? `/titles/${result.existingTitleId}`
      : null

  return (
    <div className="flex gap-4 items-start">
      {/* Poster */}
      <div className="relative shrink-0 w-28 aspect-[2/3] rounded overflow-hidden bg-surface">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={titleText}
            fill
            className="object-cover"
            sizes="112px"
          />
        ) : (
          <div className="absolute inset-0 bg-raised" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col gap-2 pt-1">
        <div>
          <p className="font-display text-2xl tracking-wide text-primary leading-tight">{titleText}</p>
          {year !== null && (
            <p className="font-body text-sm text-secondary">{year}</p>
          )}
        </div>

        {platforms.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {platforms.map(p => {
              const colors = PLATFORM_COLORS[p.service.id]
              if (!colors) return null
              return (
                <span
                  key={p.service.id}
                  className={`font-body text-xs px-2 py-0.5 rounded text-primary ${colors.tailwindBg}`}
                >
                  {colors.label}
                </span>
              )
            })}
          </div>
        )}

        {detailHref ? (
          <Link href={detailHref} className="font-body text-sm text-amber hover:underline self-start">
            View details →
          </Link>
        ) : (
          <button
            onClick={() => result.kind === 'tmdb' && onAdd(result.movie)}
            disabled={isAdding}
            className="inline-flex items-center gap-2 font-body text-sm text-amber border border-amber/50 rounded px-3 py-2 min-h-[44px] self-start disabled:opacity-40 transition-opacity"
          >
            {isAdding ? 'Adding…' : '+ Add to watchlist'}
          </button>
        )}
      </div>
    </div>
  )
}
```

- [x] **Step 3: Run the full test suite — confirm nothing broke**

```bash
npm test
```

Expected: all existing tests PASS (95+). No new tests in this task — filter logic is covered by Task 1.

- [x] **Step 4: Smoke test in the browser**

Start the dev server (`npm run dev`) and visit `http://localhost:3000/discover`.

Check all of the following:

**My watchlist mode:**
- [x] Filter panel renders with source toggle, platform/genre dropdowns, runtime inputs
- [x] "Pick for me" picks a random unwatched title from the DB
- [x] Result card shows poster, title, year, platform badges (if any), "View details →" link
- [x] Clicking "View details →" navigates to the title detail page
- [x] With genre filter set to a genre not in any unwatched title → "No titles match" message
- [x] Switching source clears the result card

**All TMDB mode:**
- [x] "Pick for me" with no filters → result card shows a random TMDB movie
- [x] "Pick for me" with Netflix platform filter → results are Netflix IT titles
- [x] "Pick for me" with Drama genre → results are Drama films
- [x] Result card shows poster, title, year; no streaming badges (expected — TMDB source doesn't have cached streaming data)
- [x] If the picked TMDB movie is already in our watchlist → "View details →" link shown
- [x] If the picked TMDB movie is NOT in our watchlist → "+ Add to watchlist" button shown
- [x] Clicking "Add to watchlist" adds the movie and button changes to "View details →"

- [x] **Step 5: Commit**

```bash
git add app/(app)/discover/page.tsx app/(app)/discover/picker-client.tsx
git commit -m "feat: add /discover page with random picker — watchlist and TMDB modes"
```

---

## Self-Review

**1. Spec coverage:**

| Spec requirement | Covered by |
|---|---|
| `/discover` page | Task 2: `page.tsx` |
| Source: "My watchlist (unwatched)" | Task 2: `picker-client.tsx` watchlist branch |
| Source: "All TMDB" | Task 2: `picker-client.tsx` TMDB branch |
| Platform filter (Italy) via `watch_region=IT&with_watch_providers=[id]` | Task 2: TMDB mode params; Task 1: `TMDB_PROVIDER_MAP` |
| Genre filter | Task 1: `filterWatchlistTitles`; Task 2: TMDB `with_genres` param |
| Min / max runtime filter | Task 1: `filterWatchlistTitles`; Task 2: TMDB `with_runtime.*` params |
| "Pick for me" button | Task 2: `handlePick` |
| Result card: poster, title, streaming info | Task 2: `PickerResultCard` |
| CTA: add to watchlist or view details | Task 2: conditional `Link` vs button |
| Watchlist: filter locally from Supabase | Task 2: `filterWatchlistTitles(unwatchedTitles, ...)` |
| TMDB: discover → `total_pages` → random page → random item | Task 2: two-step fetch in TMDB branch |
| Platform filter uses TMDB `with_watch_providers` + `watch_region=IT` | Task 2 (route already enforces `watch_region=IT`) |
| Do NOT call Streaming Availability API | ✅ — never imported or called in this module |
| Unit test: random pick from watchlist | Task 1: `pickRandom` tests |
| Unit test: discover filter with `with_watch_providers` | Already covered by existing `lib/tmdb.test.ts:33` |

**2. Placeholder scan:** No TODOs, no "implement later", no placeholder test bodies.

**3. Type consistency:**
- `PickerFilters.source` defined in Task 1, consumed in Task 2 ✅
- `filterWatchlistTitles` signature defined in Task 1 interfaces, imported in Task 2 ✅
- `TMDB_PROVIDER_MAP` keyed by service.id strings matching `PLATFORM_COLORS` keys ✅
- `PickResult` union type is local to `picker-client.tsx`, not consumed by other tasks ✅
- `TMDBDiscoverResult` already exported from `lib/tmdb.ts` ✅

**Known limitation:** The TMDB provider IDs in `TMDB_PROVIDER_MAP` are best-effort values for Italy. If results seem wrong (e.g., Netflix filter returns non-Netflix movies), verify IDs by checking TMDB's watch providers list for IT region. The `buildTmdbUrl` discover handler always overrides `watch_region=IT`, so the platform filter targeting is region-correct regardless.
