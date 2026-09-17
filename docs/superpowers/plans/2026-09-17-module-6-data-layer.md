# Module 6: Titles Data Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build typed Supabase query functions for all title and user-meta operations, plus pure helper functions for watch stats computation — no UI, just the data layer consumed by Modules 7–12.

**Architecture:** Each file has one responsibility: `types.ts` owns shared types, `data/titles.ts` owns title CRUD, `data/user-meta.ts` owns per-user metadata, `data/stats.ts` owns stats computation. Pure helpers (`computeRuntimeTotal`, `computeGenreBreakdown`, `computeMonthlyTimeline`, `buildLetterboxdUrl`) are extracted and unit-tested without any mocking. Supabase-dependent functions call `createClient()` internally; tests mock `createClient` the same way the existing streaming route tests do.

**Tech Stack:** Next.js 15, TypeScript, Supabase (`@supabase/ssr`), Vitest

**Spec:** `docs/superpowers/specs/2026-09-16-showtime-design.md`
**Conventions:** `CLAUDE.md`

## Global Constraints

- TypeScript everywhere — no `any`, use `unknown` and narrow
- Soft-delete only — `softDeleteTitle` MUST call `.update({ removed_at: ... })`, never `.delete()`
- Every query on `titles` that returns a list or single active title MUST filter `.is('removed_at', null)`
- No `"use client"` in any data layer file — these are server-only
- TDD: write failing test → implement → green → commit. One commit per task.
- No co-author lines in commits
- Test file location: co-locate — `lib/data/titles.ts` → `lib/data/titles.test.ts`
- **Testing note:** Local Supabase is unavailable (Docker Desktop issue — see CLAUDE.md). All Supabase-dependent tests mock `createClient` via `vi.mock('@/lib/supabase/server', ...)`. The pure helper functions (Tasks 2–5) need no mocking.

---

## File Structure

**New files:**

| File | Responsibility |
|------|----------------|
| `lib/types.ts` | Shared types: `Title`, `NewTitle`, `UserMeta`, `UserMetaUpdate`, `RuntimeTotal`, `WatchStats` |
| `lib/data/titles.ts` | `buildLetterboxdUrl` + all title query/mutation functions |
| `lib/data/titles.test.ts` | Unit tests for everything in `titles.ts` |
| `lib/data/stats.ts` | Pure helpers + `getWatchStats` |
| `lib/data/stats.test.ts` | Unit tests for everything in `stats.ts` |
| `lib/data/user-meta.ts` | `upsertUserMeta`, `getUserMeta` |
| `lib/data/user-meta.test.ts` | Unit tests for everything in `user-meta.ts` |

**Existing files used (not modified):**
- `lib/supabase/server.ts` — `createClient()` called internally by every Supabase-dependent function
- `lib/streaming.ts` — `StreamingApiResponse` type referenced in `Title`

---

## Task 1: Shared TypeScript types

**Files:**
- Create: `lib/types.ts`

**Interfaces:**
- Produces: `Title`, `NewTitle`, `UserMeta`, `UserMetaUpdate`, `RuntimeTotal`, `WatchStats` — imported by all Tasks 2–10.

- [x] **Step 1: Write `lib/types.ts`**

```typescript
import type { StreamingApiResponse } from '@/lib/streaming'

export type Title = {
  id: string
  tmdb_id: number
  title: string
  year: number
  poster_url: string | null
  runtime_minutes: number | null
  genres: string[]
  overview: string
  letterboxd_search_url: string
  watched: boolean
  watched_at: string | null         // ISO 8601 timestamptz
  added_by: string                  // uuid matching auth.users.id
  added_at: string                  // ISO 8601 timestamptz
  streaming_data: StreamingApiResponse | null
  streaming_cached_at: string | null // ISO 8601 timestamptz
  removed_at: string | null          // null = active; set = soft-deleted
}

// Input shape for addTitle — DB-generated fields omitted
export type NewTitle = {
  tmdb_id: number
  title: string
  year: number
  poster_url: string | null
  runtime_minutes: number | null
  genres: string[]
  overview: string
  letterboxd_search_url: string
  added_by: string
}

export type UserMeta = {
  user_id: string
  title_id: string
  want_to_watch: boolean
  rating: number | null   // 1–5 stars; null = not rated
  note: string | null
  rated_at: string | null // ISO 8601; set when rating changes
}

// Fields callers can update via upsertUserMeta
export type UserMetaUpdate = {
  want_to_watch?: boolean
  rating?: number | null
  note?: string | null
}

export type RuntimeTotal = {
  minutes: number
  hasGaps: boolean  // true when any watched title had null runtime_minutes
}

export type WatchStats = {
  totalWatched: number
  backlog: number
  totalRuntime: RuntimeTotal
  genreBreakdown: Array<{ genre: string; count: number }>  // sorted count desc
  monthlyTimeline: Array<{ month: string; count: number }> // "YYYY-MM", sorted asc
}
```

- [x] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: zero errors

- [x] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add shared Title, UserMeta, and WatchStats types"
```

---

## Task 2: `buildLetterboxdUrl`

**Files:**
- Create: `lib/data/titles.ts` (initial skeleton — functions added in Tasks 6–8 extend this file)
- Create: `lib/data/titles.test.ts`

**Interfaces:**
- Produces: `buildLetterboxdUrl(title: string, year: number): string` — used by `addTitle` in Task 7

- [x] **Step 1: Write the failing test**

Create `lib/data/titles.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildLetterboxdUrl } from './titles'

describe('buildLetterboxdUrl', () => {
  it('encodes spaces as + between words', () => {
    expect(buildLetterboxdUrl('The Godfather', 1972))
      .toBe('https://letterboxd.com/search/films/The+Godfather+1972')
  })

  it('appends year separated by a +', () => {
    const url = buildLetterboxdUrl('Parasite', 2019)
    expect(url).toContain('Parasite+2019')
  })

  it('encodes special characters', () => {
    const url = buildLetterboxdUrl("Schindler's List", 1993)
    expect(url).toContain('Schindler')
    expect(url).toContain('1993')
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/data/titles.test.ts`
Expected: FAIL — `buildLetterboxdUrl` not exported

- [x] **Step 3: Write minimal implementation**

Create `lib/data/titles.ts`:

```typescript
// ─── Helpers ──────────────────────────────────────────────────────────────────

export function buildLetterboxdUrl(title: string, year: number): string {
  const query = `${title} ${year}`
  return `https://letterboxd.com/search/films/${encodeURIComponent(query).replace(/%20/g, '+')}`
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/data/titles.test.ts`
Expected: PASS — 3 tests green

- [x] **Step 5: Commit**

```bash
git add lib/data/titles.ts lib/data/titles.test.ts
git commit -m "feat: add buildLetterboxdUrl helper"
```

---

## Task 3: `computeRuntimeTotal`

**Files:**
- Create: `lib/data/stats.ts` (skeleton — `computeGenreBreakdown`, `computeMonthlyTimeline`, `getWatchStats` added in Tasks 4, 5, 10)
- Create: `lib/data/stats.test.ts`

**Interfaces:**
- Produces: `computeRuntimeTotal(titles: Array<{ runtime_minutes: number | null }>): RuntimeTotal` — used by `getWatchStats` (Task 10)

- [x] **Step 1: Write the failing test**

Create `lib/data/stats.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { computeRuntimeTotal } from './stats'

describe('computeRuntimeTotal', () => {
  it('sums runtime and returns hasGaps false when all titles have runtime', () => {
    const result = computeRuntimeTotal([
      { runtime_minutes: 120 },
      { runtime_minutes: 90 },
    ])
    expect(result).toEqual({ minutes: 210, hasGaps: false })
  })

  it('sets hasGaps true when any title has null runtime', () => {
    const result = computeRuntimeTotal([
      { runtime_minutes: 120 },
      { runtime_minutes: null },
    ])
    expect(result).toEqual({ minutes: 120, hasGaps: true })
  })

  it('returns zero minutes and hasGaps false for empty array', () => {
    expect(computeRuntimeTotal([])).toEqual({ minutes: 0, hasGaps: false })
  })

  it('returns hasGaps true and zero minutes when all runtimes are null', () => {
    const result = computeRuntimeTotal([{ runtime_minutes: null }])
    expect(result).toEqual({ minutes: 0, hasGaps: true })
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/data/stats.test.ts`
Expected: FAIL — `computeRuntimeTotal` not exported

- [x] **Step 3: Write minimal implementation**

Create `lib/data/stats.ts`:

```typescript
import type { RuntimeTotal, WatchStats } from '@/lib/types'

// ─── Pure helpers ─────────────────────────────────────────────────────────────

export function computeRuntimeTotal(
  titles: Array<{ runtime_minutes: number | null }>
): RuntimeTotal {
  let minutes = 0
  let hasGaps = false
  for (const t of titles) {
    if (t.runtime_minutes === null) {
      hasGaps = true
    } else {
      minutes += t.runtime_minutes
    }
  }
  return { minutes, hasGaps }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/data/stats.test.ts`
Expected: PASS — 4 tests green

- [x] **Step 5: Commit**

```bash
git add lib/data/stats.ts lib/data/stats.test.ts
git commit -m "feat: add computeRuntimeTotal helper"
```

---

## Task 4: `computeGenreBreakdown`

**Files:**
- Modify: `lib/data/stats.ts` — add `computeGenreBreakdown`
- Modify: `lib/data/stats.test.ts` — add genre tests

**Interfaces:**
- Produces: `computeGenreBreakdown(titles: Array<{ genres: string[] }>): Array<{ genre: string; count: number }>` — used by `getWatchStats` (Task 10)

- [x] **Step 1: Write the failing test**

Append to `lib/data/stats.test.ts`:

```typescript
import { computeRuntimeTotal, computeGenreBreakdown } from './stats'

// (add inside the file after the existing describe block)

describe('computeGenreBreakdown', () => {
  it('counts each genre across all titles — Drama/Crime film increments both bars', () => {
    const result = computeGenreBreakdown([
      { genres: ['Drama', 'Crime'] },
      { genres: ['Drama'] },
    ])
    const drama = result.find(r => r.genre === 'Drama')
    const crime = result.find(r => r.genre === 'Crime')
    expect(drama?.count).toBe(2)
    expect(crime?.count).toBe(1)
  })

  it('returns empty array for no titles', () => {
    expect(computeGenreBreakdown([])).toEqual([])
  })

  it('sorts results by count descending', () => {
    const result = computeGenreBreakdown([
      { genres: ['Comedy'] },
      { genres: ['Drama', 'Crime'] },
      { genres: ['Drama'] },
    ])
    expect(result[0].genre).toBe('Drama')
    expect(result[0].count).toBe(2)
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/data/stats.test.ts`
Expected: FAIL — `computeGenreBreakdown` not exported

- [x] **Step 3: Write minimal implementation**

Append to `lib/data/stats.ts`:

```typescript
export function computeGenreBreakdown(
  titles: Array<{ genres: string[] }>
): Array<{ genre: string; count: number }> {
  const counts: Record<string, number> = {}
  for (const t of titles) {
    for (const g of t.genres) {
      counts[g] = (counts[g] ?? 0) + 1
    }
  }
  return Object.entries(counts)
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count)
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/data/stats.test.ts`
Expected: PASS — all tests green

- [x] **Step 5: Commit**

```bash
git add lib/data/stats.ts lib/data/stats.test.ts
git commit -m "feat: add computeGenreBreakdown helper"
```

---

## Task 5: `computeMonthlyTimeline`

**Files:**
- Modify: `lib/data/stats.ts` — add `computeMonthlyTimeline`
- Modify: `lib/data/stats.test.ts` — add timeline tests

**Interfaces:**
- Produces: `computeMonthlyTimeline(titles: Array<{ watched_at: string | null }>): Array<{ month: string; count: number }>` — used by `getWatchStats` (Task 10)

- [x] **Step 1: Write the failing test**

Append to `lib/data/stats.test.ts`:

```typescript
import { computeRuntimeTotal, computeGenreBreakdown, computeMonthlyTimeline } from './stats'

describe('computeMonthlyTimeline', () => {
  it('groups titles by YYYY-MM month and sorts ascending', () => {
    const result = computeMonthlyTimeline([
      { watched_at: '2026-02-10T10:00:00Z' },
      { watched_at: '2026-01-15T10:00:00Z' },
      { watched_at: '2026-01-20T10:00:00Z' },
    ])
    expect(result).toEqual([
      { month: '2026-01', count: 2 },
      { month: '2026-02', count: 1 },
    ])
  })

  it('skips titles with null watched_at', () => {
    const result = computeMonthlyTimeline([
      { watched_at: null },
      { watched_at: '2026-03-01T00:00:00Z' },
    ])
    expect(result).toEqual([{ month: '2026-03', count: 1 }])
  })

  it('returns empty array for no titles', () => {
    expect(computeMonthlyTimeline([])).toEqual([])
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/data/stats.test.ts`
Expected: FAIL — `computeMonthlyTimeline` not exported

- [x] **Step 3: Write minimal implementation**

Append to `lib/data/stats.ts`:

```typescript
export function computeMonthlyTimeline(
  titles: Array<{ watched_at: string | null }>
): Array<{ month: string; count: number }> {
  const counts: Record<string, number> = {}
  for (const t of titles) {
    if (!t.watched_at) continue
    const month = t.watched_at.slice(0, 7)  // "YYYY-MM"
    counts[month] = (counts[month] ?? 0) + 1
  }
  return Object.entries(counts)
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month))
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/data/stats.test.ts`
Expected: PASS — all tests green

- [x] **Step 5: Commit**

```bash
git add lib/data/stats.ts lib/data/stats.test.ts
git commit -m "feat: add computeMonthlyTimeline helper"
```

---

## Task 6: `getTitles` and `getTitleById`

**Files:**
- Modify: `lib/data/titles.ts` — add the two query functions
- Modify: `lib/data/titles.test.ts` — add mocked Supabase tests

**Interfaces:**
- Consumes: `createClient()` from `@/lib/supabase/server`
- Produces:
  - `getTitles(): Promise<Title[]>` — returns all active titles, newest first
  - `getTitleById(id: string): Promise<Title | null>` — returns null if not found or soft-deleted

- [x] **Step 1: Write the failing tests**

Append to `lib/data/titles.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildLetterboxdUrl, getTitles, getTitleById } from './titles'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'

describe('getTitles', () => {
  afterEach(() => vi.clearAllMocks())

  it('filters removed_at IS NULL — never returns soft-deleted titles', async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null })
    const is = vi.fn().mockReturnValue({ order })
    const select = vi.fn().mockReturnValue({ is })
    const from = vi.fn().mockReturnValue({ select })
    vi.mocked(createClient).mockResolvedValue({ from } as never)

    await getTitles()

    expect(is).toHaveBeenCalledWith('removed_at', null)
  })

  it('returns the titles array from Supabase', async () => {
    const fakeTitles = [{ id: 'abc', title: 'The Godfather' }]
    const order = vi.fn().mockResolvedValue({ data: fakeTitles, error: null })
    const is = vi.fn().mockReturnValue({ order })
    const select = vi.fn().mockReturnValue({ is })
    const from = vi.fn().mockReturnValue({ select })
    vi.mocked(createClient).mockResolvedValue({ from } as never)

    const result = await getTitles()

    expect(result).toEqual(fakeTitles)
  })
})

describe('getTitleById', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns the title when found', async () => {
    const fakeTitle = { id: 'abc', title: 'The Godfather', removed_at: null }
    const single = vi.fn().mockResolvedValue({ data: fakeTitle, error: null })
    const is = vi.fn().mockReturnValue({ single })
    const eq = vi.fn().mockReturnValue({ is })
    const select = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ select })
    vi.mocked(createClient).mockResolvedValue({ from } as never)

    const result = await getTitleById('abc')

    expect(result).toEqual(fakeTitle)
  })

  it('returns null when Supabase returns PGRST116 (no rows)', async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'No rows found' },
    })
    const is = vi.fn().mockReturnValue({ single })
    const eq = vi.fn().mockReturnValue({ is })
    const select = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ select })
    vi.mocked(createClient).mockResolvedValue({ from } as never)

    const result = await getTitleById('non-existent')

    expect(result).toBeNull()
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/data/titles.test.ts`
Expected: FAIL — `getTitles` and `getTitleById` not exported

- [x] **Step 3: Write minimal implementation**

Append to `lib/data/titles.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import type { Title, NewTitle } from '@/lib/types'

export async function getTitles(): Promise<Title[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('titles')
    .select('*')
    .is('removed_at', null)
    .order('added_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getTitleById(id: string): Promise<Title | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('titles')
    .select('*')
    .eq('id', id)
    .is('removed_at', null)
    .single()
  if (error?.code === 'PGRST116') return null
  if (error) throw error
  return data
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/data/titles.test.ts`
Expected: PASS — all tests green

- [x] **Step 5: Commit**

```bash
git add lib/data/titles.ts lib/data/titles.test.ts
git commit -m "feat: add getTitles and getTitleById"
```

---

## Task 7: `addTitle`

**Files:**
- Modify: `lib/data/titles.ts` — add `addTitle`
- Modify: `lib/data/titles.test.ts` — add insert test

**Interfaces:**
- Consumes: `NewTitle` from `@/lib/types`, `buildLetterboxdUrl` (Task 2)
- Produces: `addTitle(input: NewTitle): Promise<Title>`

- [x] **Step 1: Write the failing test**

Append to `lib/data/titles.test.ts`:

```typescript
import { buildLetterboxdUrl, getTitles, getTitleById, addTitle } from './titles'

describe('addTitle', () => {
  afterEach(() => vi.clearAllMocks())

  it('inserts the title with watched: false and returns the saved row', async () => {
    const input = {
      tmdb_id: 238,
      title: 'The Godfather',
      year: 1972,
      poster_url: '/poster.jpg',
      runtime_minutes: 175,
      genres: ['Drama', 'Crime'],
      overview: 'The aging patriarch...',
      letterboxd_search_url: 'https://letterboxd.com/search/films/The+Godfather+1972',
      added_by: 'user-uuid-123',
    }
    const savedTitle = { ...input, id: 'new-uuid', watched: false, added_at: '2026-09-17T10:00:00Z' }

    const single = vi.fn().mockResolvedValue({ data: savedTitle, error: null })
    const selectAfterInsert = vi.fn().mockReturnValue({ single })
    const insert = vi.fn().mockReturnValue({ select: selectAfterInsert })
    const from = vi.fn().mockReturnValue({ insert })
    vi.mocked(createClient).mockResolvedValue({ from } as never)

    const result = await addTitle(input)

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ watched: false }))
    expect(result).toEqual(savedTitle)
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/data/titles.test.ts`
Expected: FAIL — `addTitle` not exported

- [x] **Step 3: Write minimal implementation**

Append to `lib/data/titles.ts`:

```typescript
export async function addTitle(input: NewTitle): Promise<Title> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('titles')
    .insert({ ...input, watched: false })
    .select()
    .single()
  if (error) throw error
  return data
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/data/titles.test.ts`
Expected: PASS — all tests green

- [x] **Step 5: Commit**

```bash
git add lib/data/titles.ts lib/data/titles.test.ts
git commit -m "feat: add addTitle"
```

---

## Task 8: Title mutations — `softDeleteTitle`, `markWatched`, `unmarkWatched`, `updateRuntime`

**Files:**
- Modify: `lib/data/titles.ts` — add four mutation functions
- Modify: `lib/data/titles.test.ts` — add mutation tests

**Interfaces:**
- Produces:
  - `softDeleteTitle(id: string): Promise<void>`
  - `markWatched(id: string, watchedAt?: string): Promise<void>`
  - `unmarkWatched(id: string): Promise<void>`
  - `updateRuntime(id: string, runtimeMinutes: number): Promise<void>`

- [x] **Step 1: Write the failing tests**

Append to `lib/data/titles.test.ts`:

```typescript
import {
  buildLetterboxdUrl, getTitles, getTitleById, addTitle,
  softDeleteTitle, markWatched, unmarkWatched, updateRuntime,
} from './titles'

function makeMutationMock() {
  const eq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn().mockReturnValue({ eq })
  const from = vi.fn().mockReturnValue({ update })
  return { from, update, eq }
}

describe('softDeleteTitle', () => {
  afterEach(() => vi.clearAllMocks())

  it('sets removed_at to a timestamp — does NOT call delete', async () => {
    const mock = makeMutationMock()
    vi.mocked(createClient).mockResolvedValue({ from: mock.from } as never)

    await softDeleteTitle('title-uuid')

    expect(mock.update).toHaveBeenCalledWith(
      expect.objectContaining({ removed_at: expect.any(String) })
    )
    // Verify the string is a valid ISO date
    const call = mock.update.mock.calls[0][0] as { removed_at: string }
    expect(() => new Date(call.removed_at)).not.toThrow()
  })
})

describe('markWatched', () => {
  afterEach(() => vi.clearAllMocks())

  it('sets watched: true and watched_at to now when no date supplied', async () => {
    const mock = makeMutationMock()
    vi.mocked(createClient).mockResolvedValue({ from: mock.from } as never)

    await markWatched('title-uuid')

    expect(mock.update).toHaveBeenCalledWith(
      expect.objectContaining({ watched: true, watched_at: expect.any(String) })
    )
  })

  it('uses the supplied watchedAt date when provided', async () => {
    const mock = makeMutationMock()
    vi.mocked(createClient).mockResolvedValue({ from: mock.from } as never)

    const date = '2026-01-15T20:00:00Z'
    await markWatched('title-uuid', date)

    expect(mock.update).toHaveBeenCalledWith(
      expect.objectContaining({ watched: true, watched_at: date })
    )
  })
})

describe('unmarkWatched', () => {
  afterEach(() => vi.clearAllMocks())

  it('sets watched: false and clears watched_at to null', async () => {
    const mock = makeMutationMock()
    vi.mocked(createClient).mockResolvedValue({ from: mock.from } as never)

    await unmarkWatched('title-uuid')

    expect(mock.update).toHaveBeenCalledWith({ watched: false, watched_at: null })
  })
})

describe('updateRuntime', () => {
  afterEach(() => vi.clearAllMocks())

  it('updates only runtime_minutes', async () => {
    const mock = makeMutationMock()
    vi.mocked(createClient).mockResolvedValue({ from: mock.from } as never)

    await updateRuntime('title-uuid', 142)

    expect(mock.update).toHaveBeenCalledWith({ runtime_minutes: 142 })
    expect(mock.eq).toHaveBeenCalledWith('id', 'title-uuid')
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/data/titles.test.ts`
Expected: FAIL — functions not exported

- [x] **Step 3: Write minimal implementation**

Append to `lib/data/titles.ts`:

```typescript
export async function softDeleteTitle(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('titles')
    .update({ removed_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function markWatched(id: string, watchedAt?: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('titles')
    .update({ watched: true, watched_at: watchedAt ?? new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function unmarkWatched(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('titles')
    .update({ watched: false, watched_at: null })
    .eq('id', id)
  if (error) throw error
}

export async function updateRuntime(id: string, runtimeMinutes: number): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('titles')
    .update({ runtime_minutes: runtimeMinutes })
    .eq('id', id)
  if (error) throw error
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/data/titles.test.ts`
Expected: PASS — all tests green

- [x] **Step 5: Commit**

```bash
git add lib/data/titles.ts lib/data/titles.test.ts
git commit -m "feat: add softDeleteTitle, markWatched, unmarkWatched, updateRuntime"
```

---

## Task 9: `upsertUserMeta` and `getUserMeta`

**Files:**
- Create: `lib/data/user-meta.ts`
- Create: `lib/data/user-meta.test.ts`

**Interfaces:**
- Consumes: `UserMeta`, `UserMetaUpdate` from `@/lib/types`
- Produces:
  - `upsertUserMeta(userId: string, titleId: string, updates: UserMetaUpdate): Promise<UserMeta>`
  - `getUserMeta(userId: string, titleId: string): Promise<UserMeta | null>`

- [x] **Step 1: Write the failing tests**

Create `lib/data/user-meta.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { upsertUserMeta, getUserMeta } from './user-meta'

describe('upsertUserMeta', () => {
  afterEach(() => vi.clearAllMocks())

  it('upserts on conflict (user_id, title_id) and returns the saved row', async () => {
    const savedMeta = {
      user_id: 'user-1',
      title_id: 'title-1',
      want_to_watch: true,
      rating: 4,
      note: null,
      rated_at: '2026-09-17T10:00:00Z',
    }
    const single = vi.fn().mockResolvedValue({ data: savedMeta, error: null })
    const selectAfterUpsert = vi.fn().mockReturnValue({ single })
    const upsert = vi.fn().mockReturnValue({ select: selectAfterUpsert })
    const from = vi.fn().mockReturnValue({ upsert })
    vi.mocked(createClient).mockResolvedValue({ from } as never)

    const result = await upsertUserMeta('user-1', 'title-1', { want_to_watch: true, rating: 4 })

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', title_id: 'title-1', want_to_watch: true, rating: 4 }),
      { onConflict: 'user_id,title_id' }
    )
    expect(result).toEqual(savedMeta)
  })

  it('sets rated_at when rating is provided', async () => {
    const single = vi.fn().mockResolvedValue({ data: {}, error: null })
    const selectAfterUpsert = vi.fn().mockReturnValue({ single })
    const upsert = vi.fn().mockReturnValue({ select: selectAfterUpsert })
    const from = vi.fn().mockReturnValue({ upsert })
    vi.mocked(createClient).mockResolvedValue({ from } as never)

    await upsertUserMeta('user-1', 'title-1', { rating: 3 })

    const payload = upsert.mock.calls[0][0] as Record<string, unknown>
    expect(typeof payload.rated_at).toBe('string')
  })

  it('does not set rated_at when only want_to_watch is updated', async () => {
    const single = vi.fn().mockResolvedValue({ data: {}, error: null })
    const selectAfterUpsert = vi.fn().mockReturnValue({ single })
    const upsert = vi.fn().mockReturnValue({ select: selectAfterUpsert })
    const from = vi.fn().mockReturnValue({ upsert })
    vi.mocked(createClient).mockResolvedValue({ from } as never)

    await upsertUserMeta('user-1', 'title-1', { want_to_watch: false })

    const payload = upsert.mock.calls[0][0] as Record<string, unknown>
    expect(payload.rated_at).toBeUndefined()
  })
})

describe('getUserMeta', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns meta when found', async () => {
    const fakeMeta = { user_id: 'user-1', title_id: 'title-1', want_to_watch: false, rating: null, note: null, rated_at: null }
    const single = vi.fn().mockResolvedValue({ data: fakeMeta, error: null })
    const eq2 = vi.fn().mockReturnValue({ single })
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 })
    const select = vi.fn().mockReturnValue({ eq: eq1 })
    const from = vi.fn().mockReturnValue({ select })
    vi.mocked(createClient).mockResolvedValue({ from } as never)

    const result = await getUserMeta('user-1', 'title-1')

    expect(result).toEqual(fakeMeta)
  })

  it('returns null when no row exists (PGRST116)', async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'No rows' } })
    const eq2 = vi.fn().mockReturnValue({ single })
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 })
    const select = vi.fn().mockReturnValue({ eq: eq1 })
    const from = vi.fn().mockReturnValue({ select })
    vi.mocked(createClient).mockResolvedValue({ from } as never)

    const result = await getUserMeta('user-1', 'title-1')

    expect(result).toBeNull()
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/data/user-meta.test.ts`
Expected: FAIL — module not found

- [x] **Step 3: Write minimal implementation**

Create `lib/data/user-meta.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import type { UserMeta, UserMetaUpdate } from '@/lib/types'

export async function upsertUserMeta(
  userId: string,
  titleId: string,
  updates: UserMetaUpdate
): Promise<UserMeta> {
  const supabase = await createClient()

  const payload: Record<string, unknown> = {
    user_id: userId,
    title_id: titleId,
    ...updates,
  }
  if (updates.rating !== undefined) {
    payload.rated_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('user_title_meta')
    .upsert(payload, { onConflict: 'user_id,title_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getUserMeta(
  userId: string,
  titleId: string
): Promise<UserMeta | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_title_meta')
    .select('*')
    .eq('user_id', userId)
    .eq('title_id', titleId)
    .single()
  if (error?.code === 'PGRST116') return null
  if (error) throw error
  return data
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/data/user-meta.test.ts`
Expected: PASS — all tests green

- [x] **Step 5: Commit**

```bash
git add lib/data/user-meta.ts lib/data/user-meta.test.ts
git commit -m "feat: add upsertUserMeta and getUserMeta"
```

---

## Task 10: `getWatchStats`

**Files:**
- Modify: `lib/data/stats.ts` — add `getWatchStats` (integrates pure helpers + Supabase)
- Modify: `lib/data/stats.test.ts` — add integration test

**Interfaces:**
- Consumes: `computeRuntimeTotal`, `computeGenreBreakdown`, `computeMonthlyTimeline` (Tasks 3–5)
- Produces: `getWatchStats(): Promise<WatchStats>`

- [x] **Step 1: Write the failing test**

Append to `lib/data/stats.test.ts`:

```typescript
import { vi, beforeEach, afterEach } from 'vitest'
import { computeRuntimeTotal, computeGenreBreakdown, computeMonthlyTimeline, getWatchStats } from './stats'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
import { createClient } from '@/lib/supabase/server'

describe('getWatchStats', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns correct totals, runtime, genre breakdown, and monthly timeline', async () => {
    const mockTitles = [
      // watched, has runtime
      { genres: ['Drama', 'Crime'], runtime_minutes: 175, watched: true, watched_at: '2026-01-15T10:00:00Z' },
      // watched, has runtime
      { genres: ['Drama'], runtime_minutes: 120, watched: true, watched_at: '2026-02-10T10:00:00Z' },
      // watched, null runtime → hasGaps
      { genres: ['Comedy'], runtime_minutes: null, watched: true, watched_at: '2026-02-20T10:00:00Z' },
      // unwatched → backlog
      { genres: ['Action'], runtime_minutes: 100, watched: false, watched_at: null },
    ]

    const is = vi.fn().mockResolvedValue({ data: mockTitles, error: null })
    const select = vi.fn().mockReturnValue({ is })
    const from = vi.fn().mockReturnValue({ select })
    vi.mocked(createClient).mockResolvedValue({ from } as never)

    const stats = await getWatchStats()

    expect(stats.totalWatched).toBe(3)
    expect(stats.backlog).toBe(1)
    expect(stats.totalRuntime).toEqual({ minutes: 295, hasGaps: true })

    const drama = stats.genreBreakdown.find(g => g.genre === 'Drama')
    const crime = stats.genreBreakdown.find(g => g.genre === 'Crime')
    expect(drama?.count).toBe(2)
    expect(crime?.count).toBe(1)

    expect(stats.monthlyTimeline).toContainEqual({ month: '2026-01', count: 1 })
    expect(stats.monthlyTimeline).toContainEqual({ month: '2026-02', count: 2 })
  })

  it('filters removed_at IS NULL before computing stats', async () => {
    const is = vi.fn().mockResolvedValue({ data: [], error: null })
    const select = vi.fn().mockReturnValue({ is })
    const from = vi.fn().mockReturnValue({ select })
    vi.mocked(createClient).mockResolvedValue({ from } as never)

    await getWatchStats()

    expect(is).toHaveBeenCalledWith('removed_at', null)
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/data/stats.test.ts`
Expected: FAIL — `getWatchStats` not exported

- [x] **Step 3: Write minimal implementation**

Append to `lib/data/stats.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import type { WatchStats } from '@/lib/types'

export async function getWatchStats(): Promise<WatchStats> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('titles')
    .select('genres, runtime_minutes, watched, watched_at')
    .is('removed_at', null)
  if (error) throw error

  const titles = data ?? []
  const watched = titles.filter(t => t.watched)

  return {
    totalWatched: watched.length,
    backlog: titles.length - watched.length,
    totalRuntime: computeRuntimeTotal(watched),
    genreBreakdown: computeGenreBreakdown(watched),
    monthlyTimeline: computeMonthlyTimeline(watched),
  }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/data/stats.test.ts`
Expected: PASS — all tests green

- [x] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: all tests across the project pass, zero failures

- [x] **Step 6: Commit**

```bash
git add lib/data/stats.ts lib/data/stats.test.ts
git commit -m "feat: add getWatchStats"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Task |
|---|---|
| `addTitle` stores `letterboxd_search_url` | Task 2 (`buildLetterboxdUrl`), Task 7 (`addTitle` accepts it as `NewTitle` field) |
| `getTitles` filters `removed_at IS NULL` | Task 6 — `.is('removed_at', null)` asserted in test |
| `softDeleteTitle` sets `removed_at`, never `DELETE` | Task 8 — test asserts `.update({ removed_at: ... })` |
| `markWatched` / `unmarkWatched` | Task 8 |
| `updateRuntime` for missing TMDB runtime | Task 8 |
| `upsertUserMeta` — want_to_watch, rating, note | Task 9 |
| `getWatchStats` — totalWatched, backlog, totalRuntime | Task 10 |
| Runtime `~` prefix logic (hasGaps) | Task 3 — `computeRuntimeTotal` returns `{ minutes, hasGaps }` |
| Genre breakdown counts multi-genre titles under each genre | Task 4 — Drama/Crime film increments both bars |
| Monthly timeline groups by YYYY-MM | Task 5 |
| Stats exclude soft-deleted titles | Task 10 — `getWatchStats` calls `.is('removed_at', null)` |

### Placeholder scan

No TBDs, TODOs, or "similar to Task N" references. All test code and implementation code is written out in full.

### Type consistency

- `RuntimeTotal` defined in Task 1 → used in `computeRuntimeTotal` (Task 3) → used in `getWatchStats` (Task 10). ✅
- `WatchStats` defined in Task 1 → returned by `getWatchStats` (Task 10). ✅
- `NewTitle` defined in Task 1 → consumed by `addTitle` (Task 7). ✅
- `UserMeta` / `UserMetaUpdate` defined in Task 1 → used in Tasks 9. ✅
