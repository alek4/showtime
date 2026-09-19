# Module 9 — Title Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/titles/[id]` — the title detail page showing full metadata, Italy streaming badges (with synchronous cache refresh), watched toggle, per-user rating/note/want-to-watch, Letterboxd link, manual runtime input, and soft-delete.

**Architecture:** One server component fetches all data (title, user meta, streaming cache refresh if stale) before rendering. Interactive elements (watched toggle, stars, note, runtime) are isolated client components in the same folder. Server actions live in a co-located `actions.ts`. Cache refresh logic lives in a shared helper so it can be unit-tested independently of the HTTP route.

**Tech Stack:** Next.js 15 App Router, Tailwind CSS (Tailwind 4 — config in `app/globals.css` `@theme` block), Supabase, Vitest

**Spec:** `docs/superpowers/specs/2026-09-16-showtime-design.md`

## Global Constraints

- TypeScript everywhere — no `any`, use `unknown` and narrow
- No `"use client"` unless the component needs `useState`, `useEffect`, or browser event handlers
- All API keys server-side only — never in client components
- Soft-delete only — never `DELETE` from `titles` table; set `removed_at = NOW()`
- TDD: write failing test → implement → green → commit. One commit per green test or test suite.
- No co-author lines in commits
- Fonts: Bebas Neue (`font-display`), Outfit (`font-body`), DM Serif Display italic (`font-accent`)
- Colors: `bg-void` page background, `text-primary`/`text-secondary`/`text-ghost`, `text-amber`/`bg-amber`, red for watched state only
- Minimum 44px touch targets on all interactive elements
- `createClient()` from `lib/supabase/server` is `async` — always `await` it
- `params` in Next.js 15 page components is a `Promise` — must be `await`ed
- `revalidatePath` must be called in mutations so the server component re-renders with fresh data

---

## File Map

**Created:**
- `lib/data/streaming-cache.ts` — `refreshStreamingIfStale(tmdbId: number)`: checks DB cache age, calls Streaming Availability API if stale, upserts DB, returns fresh data
- `lib/data/streaming-cache.test.ts` — unit tests for `refreshStreamingIfStale`
- `app/(app)/titles/[id]/actions.ts` — `'use server'` actions: `toggleWatchedAction`, `updateRuntimeAction`, `softDeleteAction`, `upsertMetaAction`
- `app/(app)/titles/[id]/watched-toggle.tsx` — client component: watched / mark-as-watched button with date display
- `app/(app)/titles/[id]/want-to-watch-toggle.tsx` — client component: per-user want-to-watch toggle
- `app/(app)/titles/[id]/rating-input.tsx` — client component: 5 amber stars, tap to rate, tap again to clear
- `app/(app)/titles/[id]/note-input.tsx` — client component: textarea, auto-save on blur
- `app/(app)/titles/[id]/runtime-input.tsx` — client component: number input shown only when runtime_minutes is null; disappears after save via page revalidation
- `app/(app)/titles/[id]/page.tsx` — server component: fetches title + streaming + user meta; assembles full layout

**Not modified** (all required functions already exist):
- `lib/data/titles.ts` — `getTitleById`, `markWatched`, `unmarkWatched`, `softDeleteTitle`, `updateRuntime`
- `lib/data/user-meta.ts` — `upsertUserMeta`, `getUserMeta`
- `lib/streaming.ts` — `isCacheStale`, `getItPlatforms`, `PLATFORM_COLORS`, `buildStreamingUrl`
- `lib/types.ts` — `Title`, `UserMeta`, `UserMetaUpdate`
- `app/api/streaming/[tmdb_id]/route.ts` — untouched; the shared helper extracts the same logic for use in the server component without an HTTP round-trip

---

## Task 1: `refreshStreamingIfStale` helper

**Why a new file:** The existing streaming API route already handles cache refresh, but calling your own HTTP routes from a server component is an antipattern in Next.js 15. Extracting this logic into a server-side helper lets the detail page call it directly and lets us unit-test it in isolation.

**Files:**
- Create: `lib/data/streaming-cache.ts`
- Create: `lib/data/streaming-cache.test.ts`

**Interfaces:**
- Consumes: `isCacheStale(cachedAt: string | null): boolean` and `buildStreamingUrl(tmdbId: number): string` from `lib/streaming.ts`; `createClient` from `lib/supabase/server`; `StreamingApiResponse` type from `lib/streaming.ts`
- Produces: `refreshStreamingIfStale(tmdbId: number): Promise<StreamingApiResponse | null>`

- [x] **Step 1: Write the failing tests**

```typescript
// lib/data/streaming-cache.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { refreshStreamingIfStale } from './streaming-cache'

type Row = { streaming_data: unknown; streaming_cached_at: string | null } | null

function makeMockSupabase(row: Row) {
  const updateEq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn().mockReturnValue({ eq: updateEq })
  const single = vi.fn().mockResolvedValue({ data: row })
  const selectEq = vi.fn().mockReturnValue({ single })
  const select = vi.fn().mockReturnValue({ eq: selectEq })
  const from = vi.fn().mockReturnValue({ select, update })
  return { from, update }
}

describe('refreshStreamingIfStale', () => {
  beforeEach(() => {
    vi.stubEnv('STREAMING_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ streamingOptions: { it: [] } }),
    }))
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('returns cached data and skips fetch when cache is fresh (< 24h)', async () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const cachedData = { streamingOptions: { it: [{ service: { id: 'netflix' } }] } }
    vi.mocked(createClient).mockResolvedValue(
      makeMockSupabase({ streaming_data: cachedData, streaming_cached_at: oneHourAgo }) as never
    )

    const result = await refreshStreamingIfStale(238)

    expect(fetch).not.toHaveBeenCalled()
    expect(result).toEqual(cachedData)
  })

  it('calls Streaming API and returns fresh data when cache is stale (> 24h)', async () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const freshData = { streamingOptions: { it: [{ service: { id: 'prime' } }] } }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => freshData,
    }))
    const mock = makeMockSupabase({ streaming_data: null, streaming_cached_at: twoDaysAgo })
    vi.mocked(createClient).mockResolvedValue(mock as never)

    const result = await refreshStreamingIfStale(238)

    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('streaming-availability.p.rapidapi.com'),
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-rapidapi-key': 'test-key' }),
      })
    )
    expect(mock.update).toHaveBeenCalledWith(
      expect.objectContaining({ streaming_cached_at: expect.any(String) })
    )
    expect(result).toEqual(freshData)
  })

  it('calls Streaming API when streaming_cached_at is null (never cached)', async () => {
    const mock = makeMockSupabase({ streaming_data: null, streaming_cached_at: null })
    vi.mocked(createClient).mockResolvedValue(mock as never)

    await refreshStreamingIfStale(238)

    expect(fetch).toHaveBeenCalledOnce()
  })

  it('returns null when title row is not found in DB', async () => {
    vi.mocked(createClient).mockResolvedValue(makeMockSupabase(null) as never)

    const result = await refreshStreamingIfStale(999)

    expect(result).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

```bash
npm run test lib/data/streaming-cache.test.ts
```

Expected: FAIL — `Cannot find module './streaming-cache'`

- [x] **Step 3: Implement `refreshStreamingIfStale`**

```typescript
// lib/data/streaming-cache.ts
import { createClient } from '@/lib/supabase/server'
import { isCacheStale, buildStreamingUrl } from '@/lib/streaming'
import type { StreamingApiResponse } from '@/lib/streaming'

export async function refreshStreamingIfStale(
  tmdbId: number
): Promise<StreamingApiResponse | null> {
  const supabase = await createClient()

  const { data: row } = await supabase
    .from('titles')
    .select('streaming_data, streaming_cached_at')
    .eq('tmdb_id', tmdbId)
    .single()

  if (!row) return null

  if (!isCacheStale(row.streaming_cached_at)) {
    return row.streaming_data as StreamingApiResponse | null
  }

  if (!process.env.STREAMING_API_KEY) {
    return row.streaming_data as StreamingApiResponse | null
  }

  const response = await fetch(buildStreamingUrl(tmdbId), {
    headers: {
      'x-rapidapi-key': process.env.STREAMING_API_KEY,
      'x-rapidapi-host': 'streaming-availability.p.rapidapi.com',
    },
  })

  if (!response.ok) return row.streaming_data as StreamingApiResponse | null

  const freshData = (await response.json()) as StreamingApiResponse

  await supabase
    .from('titles')
    .update({
      streaming_data: freshData,
      streaming_cached_at: new Date().toISOString(),
    })
    .eq('tmdb_id', tmdbId)

  return freshData
}
```

- [x] **Step 4: Run tests to verify they pass**

```bash
npm run test lib/data/streaming-cache.test.ts
```

Expected: 4 tests PASS

- [x] **Step 5: Commit**

```bash
git add lib/data/streaming-cache.ts lib/data/streaming-cache.test.ts
git commit -m "feat: add refreshStreamingIfStale helper for title detail page"
```

---

## Task 2: Server actions

No separate unit tests — these are thin wrappers around the already-tested data layer functions, following the same pattern as `app/(app)/search/actions.ts`.

**Files:**
- Create: `app/(app)/titles/[id]/actions.ts`

**Interfaces:**
- Consumes: `markWatched`, `unmarkWatched`, `softDeleteTitle`, `updateRuntime` from `lib/data/titles.ts`; `upsertUserMeta` from `lib/data/user-meta.ts`; `UserMeta`, `UserMetaUpdate` from `lib/types.ts`
- Produces:
  - `toggleWatchedAction(titleId: string, markAsWatched: boolean): Promise<void>`
  - `updateRuntimeAction(titleId: string, runtimeMinutes: number): Promise<void>`
  - `softDeleteAction(titleId: string): Promise<void>` — soft-deletes then redirects to `/`
  - `upsertMetaAction(titleId: string, updates: UserMetaUpdate): Promise<UserMeta>`

- [x] **Step 1: Create the actions file**

```typescript
// app/(app)/titles/[id]/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { markWatched, unmarkWatched, softDeleteTitle, updateRuntime } from '@/lib/data/titles'
import { upsertUserMeta } from '@/lib/data/user-meta'
import type { UserMeta, UserMetaUpdate } from '@/lib/types'

export async function toggleWatchedAction(
  titleId: string,
  markAsWatched: boolean
): Promise<void> {
  if (markAsWatched) {
    await markWatched(titleId)
  } else {
    await unmarkWatched(titleId)
  }
  revalidatePath('/titles/[id]', 'page')
  revalidatePath('/')
}

export async function updateRuntimeAction(
  titleId: string,
  runtimeMinutes: number
): Promise<void> {
  await updateRuntime(titleId, runtimeMinutes)
  revalidatePath('/titles/[id]', 'page')
}

export async function softDeleteAction(titleId: string): Promise<void> {
  await softDeleteTitle(titleId)
  redirect('/')
}

export async function upsertMetaAction(
  titleId: string,
  updates: UserMetaUpdate
): Promise<UserMeta> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const result = await upsertUserMeta(user.id, titleId, updates)
  // want_to_watch affects the amber dot on poster cards on the home page
  revalidatePath('/')
  return result
}
```

- [x] **Step 2: Verify the file compiles**

```bash
npm run build 2>&1 | head -30
```

Expected: no TypeScript errors in the new file (other errors unrelated to this file are fine if they pre-existed).

- [x] **Step 3: Commit**

```bash
git add app/\(app\)/titles/\[id\]/actions.ts
git commit -m "feat: add title detail server actions"
```

---

## Task 3: `WatchedToggle` client component

Shows "Mark as watched" (amber) or "Watched" (red-dim) based on current state. After action, `revalidatePath` in the action triggers the server component to re-render, updating the button state from the new server-side `watched` value. `useOptimistic` gives immediate visual feedback during the network round-trip.

**Files:**
- Create: `app/(app)/titles/[id]/watched-toggle.tsx`

**Interfaces:**
- Consumes: `toggleWatchedAction` from `./actions`
- Props: `{ titleId: string; initialWatched: boolean; watchedAt: string | null }`

- [x] **Step 1: Create the component**

```typescript
// app/(app)/titles/[id]/watched-toggle.tsx
'use client'

import { useOptimistic, useTransition } from 'react'
import { toggleWatchedAction } from './actions'

type Props = {
  titleId: string
  initialWatched: boolean
  watchedAt: string | null
}

export function WatchedToggle({ titleId, initialWatched, watchedAt }: Props) {
  const [isPending, startTransition] = useTransition()
  const [optimisticWatched, setOptimisticWatched] = useOptimistic(initialWatched)

  function handleToggle() {
    const next = !optimisticWatched
    startTransition(async () => {
      setOptimisticWatched(next)
      await toggleWatchedAction(titleId, next)
    })
  }

  const dateLabel = watchedAt
    ? new Date(watchedAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleToggle}
        disabled={isPending}
        className={`font-body text-sm px-4 py-2 rounded min-h-[44px] transition-colors disabled:opacity-40 ${
          optimisticWatched
            ? 'bg-red-dim text-primary hover:bg-red/20'
            : 'bg-amber text-void hover:bg-amber-dim'
        }`}
      >
        {isPending ? 'Saving…' : optimisticWatched ? 'Watched' : 'Mark as watched'}
      </button>
      {dateLabel && (
        <span className="font-body text-xs text-secondary">{dateLabel}</span>
      )}
    </div>
  )
}
```

- [x] **Step 2: Run the full test suite to confirm no regressions**

```bash
npm run test
```

Expected: same count as before (91 tests) — all pass.

- [x] **Step 3: Commit**

```bash
git add app/\(app\)/titles/\[id\]/watched-toggle.tsx
git commit -m "feat: add WatchedToggle client component"
```

---

## Task 4: `WantToWatchToggle` client component

Per-user toggle that sets `user_title_meta.want_to_watch`. The amber dot on poster cards in the home page reflects this value (handled by `revalidatePath('/')` in `upsertMetaAction`).

**Files:**
- Create: `app/(app)/titles/[id]/want-to-watch-toggle.tsx`

**Interfaces:**
- Consumes: `upsertMetaAction` from `./actions`
- Props: `{ titleId: string; initialValue: boolean }`

- [x] **Step 1: Create the component**

```typescript
// app/(app)/titles/[id]/want-to-watch-toggle.tsx
'use client'

import { useOptimistic, useTransition } from 'react'
import { upsertMetaAction } from './actions'

type Props = {
  titleId: string
  initialValue: boolean
}

export function WantToWatchToggle({ titleId, initialValue }: Props) {
  const [isPending, startTransition] = useTransition()
  const [optimistic, setOptimistic] = useOptimistic(initialValue)

  function handleToggle() {
    const next = !optimistic
    startTransition(async () => {
      setOptimistic(next)
      await upsertMetaAction(titleId, { want_to_watch: next })
    })
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={`font-body text-sm px-4 py-2 rounded min-h-[44px] transition-colors disabled:opacity-40 ${
        optimistic
          ? 'bg-amber text-void'
          : 'bg-surface text-secondary border border-border hover:border-amber/50'
      }`}
    >
      {isPending ? 'Saving…' : optimistic ? '★ Want to watch' : '+ Want to watch'}
    </button>
  )
}
```

- [x] **Step 2: Commit**

```bash
git add app/\(app\)/titles/\[id\]/want-to-watch-toggle.tsx
git commit -m "feat: add WantToWatchToggle client component"
```

---

## Task 5: `RatingInput` client component

Five amber stars. Tapping a star sets that rating. Tapping the current rating clears it (sets null). Design spec says "Five amber stars (★), filled/unfilled. Not a slider, not a number input."

**Files:**
- Create: `app/(app)/titles/[id]/rating-input.tsx`

**Interfaces:**
- Consumes: `upsertMetaAction` from `./actions`
- Props: `{ titleId: string; initialRating: number | null }`

- [x] **Step 1: Create the component**

```typescript
// app/(app)/titles/[id]/rating-input.tsx
'use client'

import { useOptimistic, useTransition } from 'react'
import { upsertMetaAction } from './actions'

type Props = {
  titleId: string
  initialRating: number | null
}

export function RatingInput({ titleId, initialRating }: Props) {
  const [isPending, startTransition] = useTransition()
  const [optimisticRating, setOptimisticRating] = useOptimistic<number | null>(initialRating)

  function handleRate(star: number) {
    // Tapping the current star clears the rating
    const newRating = optimisticRating === star ? null : star
    startTransition(async () => {
      setOptimisticRating(newRating)
      await upsertMetaAction(titleId, { rating: newRating })
    })
  }

  return (
    <div className="flex gap-2" role="group" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          onClick={() => handleRate(star)}
          disabled={isPending}
          aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
          className="text-3xl leading-none disabled:opacity-40 transition-colors"
        >
          <span
            className={
              optimisticRating !== null && star <= optimisticRating
                ? 'text-amber'
                : 'text-ghost'
            }
          >
            ★
          </span>
        </button>
      ))}
    </div>
  )
}
```

- [x] **Step 2: Commit**

```bash
git add app/\(app\)/titles/\[id\]/rating-input.tsx
git commit -m "feat: add RatingInput client component with 5-star amber UI"
```

---

## Task 6: `NoteInput` client component

Textarea that auto-saves on blur. Only fires the action when the value has actually changed since the last save (avoids redundant DB writes on every unfocus).

**Files:**
- Create: `app/(app)/titles/[id]/note-input.tsx`

**Interfaces:**
- Consumes: `upsertMetaAction` from `./actions`
- Props: `{ titleId: string; initialNote: string | null }`

- [x] **Step 1: Create the component**

```typescript
// app/(app)/titles/[id]/note-input.tsx
'use client'

import { useRef, useState, useTransition } from 'react'
import { upsertMetaAction } from './actions'

type Props = {
  titleId: string
  initialNote: string | null
}

export function NoteInput({ titleId, initialNote }: Props) {
  const [value, setValue] = useState(initialNote ?? '')
  const [isPending, startTransition] = useTransition()
  const savedRef = useRef(initialNote ?? '')

  function handleBlur() {
    if (value === savedRef.current) return
    startTransition(async () => {
      await upsertMetaAction(titleId, { note: value || null })
      savedRef.current = value
    })
  }

  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={handleBlur}
        placeholder="Add a note…"
        rows={3}
        className="w-full bg-surface text-primary font-body text-sm rounded px-3 py-2 resize-none placeholder:text-ghost focus:outline-none focus:ring-1 focus:ring-amber/50"
      />
      {isPending && (
        <span className="absolute bottom-2 right-2 font-body text-xs text-secondary">
          Saving…
        </span>
      )}
    </div>
  )
}
```

- [x] **Step 2: Commit**

```bash
git add app/\(app\)/titles/\[id\]/note-input.tsx
git commit -m "feat: add NoteInput client component with auto-save on blur"
```

---

## Task 7: `RuntimeInput` client component

Shown only when `runtime_minutes` is null. After a successful save, `updateRuntimeAction` calls `revalidatePath('/titles/[id]', 'page')`, which triggers the server component to re-render. Since `runtime_minutes` will now be set, the server component won't render `<RuntimeInput />` at all — no local `saved` state needed.

**Files:**
- Create: `app/(app)/titles/[id]/runtime-input.tsx`

**Interfaces:**
- Consumes: `updateRuntimeAction` from `./actions`
- Props: `{ titleId: string }`

- [x] **Step 1: Create the component**

```typescript
// app/(app)/titles/[id]/runtime-input.tsx
'use client'

import { useState, useTransition } from 'react'
import { updateRuntimeAction } from './actions'

type Props = {
  titleId: string
}

export function RuntimeInput({ titleId }: Props) {
  const [value, setValue] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const minutes = parseInt(value, 10)
    if (!Number.isInteger(minutes) || minutes <= 0) return
    startTransition(async () => {
      await updateRuntimeAction(titleId, minutes)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-center">
      <input
        type="number"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Runtime (min)"
        min={1}
        className="bg-surface text-primary font-body text-sm rounded px-3 py-2 w-36 focus:outline-none focus:ring-1 focus:ring-amber/50"
      />
      <button
        type="submit"
        disabled={isPending || !value}
        className="font-body text-sm bg-amber text-void px-4 py-2 rounded min-h-[44px] disabled:opacity-40"
      >
        {isPending ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}
```

- [x] **Step 2: Commit**

```bash
git add app/\(app\)/titles/\[id\]/runtime-input.tsx
git commit -m "feat: add RuntimeInput client component"
```

---

## Task 8: Title detail page (server component)

The page opens with the poster filling ~50% of the viewport height on mobile (per DESIGN.md: "look first, read second"). Content starts below with a gradient bleed from poster into the void background. Streaming cache is refreshed synchronously before render if stale.

**Files:**
- Create: `app/(app)/titles/[id]/page.tsx`

**Interfaces:**
- Consumes: `getTitleById` from `lib/data/titles`; `getUserMeta` from `lib/data/user-meta`; `refreshStreamingIfStale` from `lib/data/streaming-cache`; `isCacheStale`, `getItPlatforms`, `PLATFORM_COLORS` from `lib/streaming`; all client components from this folder; `softDeleteAction` from `./actions`
- `params: Promise<{ id: string }>` — Next.js 15 dynamic route; must be awaited

- [x] **Step 1: Create the page**

```typescript
// app/(app)/titles/[id]/page.tsx
import { notFound, redirect } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { getTitleById } from '@/lib/data/titles'
import { getUserMeta } from '@/lib/data/user-meta'
import { refreshStreamingIfStale } from '@/lib/data/streaming-cache'
import { isCacheStale, getItPlatforms, PLATFORM_COLORS } from '@/lib/streaming'
import { WatchedToggle } from './watched-toggle'
import { WantToWatchToggle } from './want-to-watch-toggle'
import { RatingInput } from './rating-input'
import { NoteInput } from './note-input'
import { RuntimeInput } from './runtime-input'
import { softDeleteAction } from './actions'

type Props = {
  params: Promise<{ id: string }>
}

export default async function TitleDetailPage({ params }: Props) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const title = await getTitleById(id)
  if (!title) notFound()

  // Synchronous cache refresh — per spec: "user waits ~1-2s, always sees fresh data"
  let streamingData = title.streaming_data
  if (isCacheStale(title.streaming_cached_at)) {
    streamingData = await refreshStreamingIfStale(title.tmdb_id)
  }

  const userMeta = await getUserMeta(user.id, title.id)
  const platforms = getItPlatforms(streamingData)

  const runtimeDisplay = title.runtime_minutes
    ? `${Math.floor(title.runtime_minutes / 60)}h ${title.runtime_minutes % 60}m`
    : null

  const deleteWithId = softDeleteAction.bind(null, title.id)

  return (
    <main className="bg-void min-h-screen pb-24">
      {/* Poster hero — fills top 50vh on mobile */}
      <div className="relative w-full h-[50vh]">
        {title.watched && (
          <div className="absolute top-0 inset-x-0 h-1 bg-red-600 z-10" />
        )}
        {title.poster_url ? (
          <Image
            src={title.poster_url}
            alt={title.title}
            fill
            className="object-cover object-top"
            sizes="100vw"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-surface" />
        )}
        {/* Gradient bleed into void background */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-void to-transparent" />
      </div>

      {/* Content */}
      <div className="px-4 pt-4">
        <h1 className="font-display text-4xl tracking-wide text-primary leading-tight">
          {title.title}
        </h1>
        <p className="font-body text-sm text-secondary mt-1">
          {title.year}
          {runtimeDisplay && ` · ${runtimeDisplay}`}
          {title.genres.length > 0 && ` · ${title.genres.join(', ')}`}
        </p>

        {/* Streaming badges */}
        {platforms.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {platforms.map(p => {
              const colors = PLATFORM_COLORS[p.service.id]
              if (!colors) return null
              return (
                <span
                  key={p.service.id}
                  className={`font-body text-xs px-2 py-1 rounded text-primary ${colors.tailwindBg}`}
                >
                  {colors.label}
                </span>
              )
            })}
          </div>
        ) : (
          <p className="font-body text-sm text-secondary mt-3">
            No streaming info available for Italy
          </p>
        )}

        {/* Letterboxd search link */}
        <a
          href={title.letterboxd_search_url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-body text-sm text-amber mt-3 inline-block hover:underline"
        >
          Search on Letterboxd →
        </a>

        {/* Shared: watched toggle */}
        <div className="mt-6">
          <WatchedToggle
            titleId={title.id}
            initialWatched={title.watched}
            watchedAt={title.watched_at}
          />
        </div>

        {/* Per-user section */}
        <div className="mt-6 flex flex-col gap-4 border-t border-border pt-4">
          <WantToWatchToggle
            titleId={title.id}
            initialValue={userMeta?.want_to_watch ?? false}
          />

          <div>
            <p className="font-body text-xs text-secondary mb-2">Your rating</p>
            <RatingInput
              titleId={title.id}
              initialRating={userMeta?.rating ?? null}
            />
          </div>

          <div>
            <p className="font-body text-xs text-secondary mb-1">Your note</p>
            <NoteInput
              titleId={title.id}
              initialNote={userMeta?.note ?? null}
            />
          </div>
        </div>

        {/* Overview */}
        {title.overview && (
          <div className="mt-6 border-t border-border pt-4">
            <p className="font-body text-sm text-secondary leading-relaxed">
              {title.overview}
            </p>
          </div>
        )}

        {/* Runtime input — only shown when runtime_minutes is null */}
        {title.runtime_minutes === null && (
          <div className="mt-6 border-t border-border pt-4">
            <p className="font-body text-xs text-secondary mb-2">
              Runtime not available — add manually
            </p>
            <RuntimeInput titleId={title.id} />
          </div>
        )}

        {/* Soft-delete */}
        <div className="mt-8 border-t border-border pt-4">
          <form action={deleteWithId}>
            <button
              type="submit"
              className="font-body text-sm text-red-400 px-4 py-2 rounded border border-red-dim min-h-[44px] hover:bg-red-dim/20 transition-colors"
            >
              Remove from list
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
```

- [x] **Step 2: Run the full test suite**

```bash
npm run test
```

Expected: all tests pass (count unchanged — no regressions).

- [x] **Step 3: Run a production build to catch TypeScript errors**

```bash
npm run build
```

Expected: no TypeScript errors. (Next.js may show route warnings for dynamic segments — those are normal.)

- [x] **Step 4: Start the dev server and manually test the golden path**

```bash
npm run dev
```

Manual test checklist:
1. Navigate to a title from the watchlist home page (`/titles/[id]`)
2. Poster fills top half of viewport; gradient bleeds into dark background
3. Title, year, runtime, genres shown below poster
4. Streaming badges appear (or "No streaming info available for Italy" if none)
5. Letterboxd link opens a search page in a new tab
6. "Mark as watched" button turns red immediately on click; page re-renders with "Watched" + date
7. "Want to watch" toggle turns amber on click; amber dot updates on home page after navigating back
8. Rate 3 stars → 3 amber stars filled; reload → stars persist
9. Type a note → blur → "Saving…" flash → reload → note persists
10. For a title with null runtime: "Add runtime" input appears; enter a value → save → input disappears and runtime shows in metadata line
11. "Remove from list" → redirected to `/`; title no longer on home page

- [x] **Step 5: Commit**

```bash
git add app/\(app\)/titles/\[id\]/page.tsx
git commit -m "feat: add title detail page with streaming refresh, watched toggle, rating, and note"
```

---

## Spec Coverage Self-Check

| Spec requirement | Task |
|---|---|
| Full TMDB metadata: poster, overview, runtime, genres | Task 8 (page) |
| Streaming availability badges for Italy | Task 1 (cache helper) + Task 8 |
| Synchronous cache refresh if stale (>24h) | Task 1 + Task 8 |
| "No streaming info available for Italy" fallback | Task 8 |
| Letterboxd search link | Task 8 |
| Watched toggle (shared) | Task 3 + Task 2 |
| Watched date display | Task 3 |
| "Want to watch" toggle (per-user) | Task 4 + Task 2 |
| 1–5 star rating (per-user) | Task 5 + Task 2 |
| Short note (per-user) | Task 6 + Task 2 |
| "Add runtime" input when runtime_minutes is null | Task 7 + Task 2 |
| Soft-delete ("remove from list") | Task 2 + Task 8 |
| Poster fills ~50% viewport height on mobile | Task 8 |
| Amber star UI (not slider) | Task 5 |
| Red watched bar on poster | Task 8 |
| `removed_at = NOW()` soft-delete (never DELETE) | Task 2 (`softDeleteTitle` in data layer, already correct) |
| Auth guard → redirect to /login if unauthenticated | Task 8 |
| 44px minimum touch targets | Tasks 3–7 (all buttons use `min-h-[44px]`) |
