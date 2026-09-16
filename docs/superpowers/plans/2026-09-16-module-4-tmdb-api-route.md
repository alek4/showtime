# Module 4 — TMDB API Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** A server-side Next.js API route at `/api/tmdb` that proxies TMDB search, movie detail, and discover requests — keeping the API key server-side at all times.

**Architecture:** URL-building logic lives in `lib/tmdb.ts` as a pure function (`buildTmdbUrl`) so it can be unit-tested without mocking Next.js internals. The route handler in `app/api/tmdb/route.ts` is a thin wrapper that calls the builder, adds the Authorization header, and forwards the TMDB response. Types for all three TMDB response shapes are also exported from `lib/tmdb.ts` for use by later modules.

**Tech Stack:** Next.js 15 API Routes, TMDB REST API v3, Vitest

**Spec:** `docs/superpowers/specs/2026-09-16-showtime-design.md`
**Conventions:** `CLAUDE.md`

## Global Constraints

- TypeScript everywhere — no `any`, use `unknown` and narrow
- `TMDB_API_KEY` is server-side only — no `NEXT_PUBLIC_` prefix, never referenced in client components
- API key must be sent as `Authorization: Bearer` header, never as a URL query param (`?api_key=...`)
- All TMDB calls go through `/api/tmdb` — never called directly from client components
- TDD: failing test → implementation → green → commit
- No co-author lines in commits

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `lib/tmdb.ts` | Create | TMDB types + `buildTmdbUrl` + `tmdbPosterUrl` helpers |
| `lib/tmdb.test.ts` | Create | Unit tests for URL builder and poster URL helper |
| `app/api/tmdb/route.ts` | Create | Thin GET handler — calls `buildTmdbUrl`, fetches, proxies response |

---

## Task 1: TMDB Types and URL Builder

The URL-building logic is extracted here so it can be tested as a pure function — no HTTP, no Next.js. The route handler (Task 2) will call this.

**Files:**
- Create: `lib/tmdb.ts`
- Create: `lib/tmdb.test.ts`

**Interfaces:**
- Produces: `buildTmdbUrl(params: URLSearchParams): string | null` — returns a fully-formed TMDB API URL, or `null` for unknown/invalid actions
- Produces: `tmdbPosterUrl(posterPath: string | null): string | null` — prepends TMDB image base URL
- Produces: `TMDBMovie`, `TMDBMovieDetail`, `TMDBSearchResult`, `TMDBDiscoverResult` types

- [x] **Step 1: Write the failing tests**

```typescript
// lib/tmdb.test.ts
import { describe, it, expect } from 'vitest'
import { buildTmdbUrl, tmdbPosterUrl } from './tmdb'

describe('buildTmdbUrl', () => {
  it('search: builds URL with encoded query', () => {
    const params = new URLSearchParams({ action: 'search', query: 'The Godfather' })
    const url = buildTmdbUrl(params)
    expect(url).toContain('/search/movie')
    expect(url).toContain('query=The+Godfather')
  })

  it('search: includes page param (defaults to 1)', () => {
    const params = new URLSearchParams({ action: 'search', query: 'test', page: '3' })
    const url = buildTmdbUrl(params)
    expect(url).toContain('page=3')
  })

  it('detail: builds URL with movie id and appends credits', () => {
    const params = new URLSearchParams({ action: 'detail', id: '238' })
    const url = buildTmdbUrl(params)
    expect(url).toContain('/movie/238')
    expect(url).toContain('append_to_response=credits')
  })

  it('discover: always sets watch_region=IT', () => {
    const params = new URLSearchParams({ action: 'discover', with_watch_providers: '8' })
    const url = buildTmdbUrl(params)
    expect(url).toContain('/discover/movie')
    expect(url).toContain('watch_region=IT')
  })

  it('discover: forwards caller params to TMDB', () => {
    const params = new URLSearchParams({
      action: 'discover',
      with_watch_providers: '8',
      with_genres: '18',
    })
    const url = buildTmdbUrl(params)
    expect(url).toContain('with_watch_providers=8')
    expect(url).toContain('with_genres=18')
  })

  it('returns null for unknown action', () => {
    const params = new URLSearchParams({ action: 'unknown' })
    expect(buildTmdbUrl(params)).toBeNull()
  })
})

describe('tmdbPosterUrl', () => {
  it('prepends the TMDB image base URL', () => {
    expect(tmdbPosterUrl('/abc123.jpg')).toBe('https://image.tmdb.org/t/p/w500/abc123.jpg')
  })

  it('returns null for null input', () => {
    expect(tmdbPosterUrl(null)).toBeNull()
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

```
npm run test -- lib/tmdb.test.ts
```
Expected: FAIL — `Cannot find module './tmdb'`

- [x] **Step 3: Implement lib/tmdb.ts**

```typescript
// lib/tmdb.ts

// ─── Types ────────────────────────────────────────────────────────────────────

export type TMDBMovie = {
  id: number
  title: string
  release_date: string        // "YYYY-MM-DD"
  poster_path: string | null
  overview: string
  genre_ids: number[]
  popularity: number
  vote_average: number
}

export type TMDBMovieDetail = {
  id: number
  title: string
  release_date: string
  poster_path: string | null
  overview: string
  runtime: number | null
  genres: Array<{ id: number; name: string }>
  credits: {
    cast: Array<{
      id: number
      name: string
      character: string
      order: number
    }>
  }
}

export type TMDBPagedResult<T> = {
  page: number
  results: T[]
  total_pages: number
  total_results: number
}

export type TMDBSearchResult = TMDBPagedResult<TMDBMovie>
export type TMDBDiscoverResult = TMDBPagedResult<TMDBMovie>

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TMDB_BASE = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500'

export function tmdbPosterUrl(posterPath: string | null): string | null {
  if (!posterPath) return null
  return `${TMDB_IMAGE_BASE}${posterPath}`
}

/**
 * Builds a TMDB API URL from the route's incoming search params.
 * Returns null for unknown or invalid actions — caller should respond 400.
 * The API key is NOT included here; the route handler adds it as a header.
 */
export function buildTmdbUrl(params: URLSearchParams): string | null {
  const action = params.get('action')

  switch (action) {
    case 'search': {
      const out = new URLSearchParams()
      out.set('query', params.get('query') ?? '')
      out.set('page', params.get('page') ?? '1')
      out.set('language', 'en-US')
      return `${TMDB_BASE}/search/movie?${out.toString()}`
    }
    case 'detail': {
      const id = params.get('id')
      if (!id) return null
      const out = new URLSearchParams()
      out.set('append_to_response', 'credits')
      out.set('language', 'en-US')
      return `${TMDB_BASE}/movie/${id}?${out.toString()}`
    }
    case 'discover': {
      const out = new URLSearchParams()
      params.forEach((value, key) => {
        if (key !== 'action') out.set(key, value)
      })
      // watch_region=IT is authoritative — always override caller value
      out.set('watch_region', 'IT')
      if (!out.has('language')) out.set('language', 'en-US')
      return `${TMDB_BASE}/discover/movie?${out.toString()}`
    }
    default:
      return null
  }
}
```

- [x] **Step 4: Run tests to verify they pass**

```
npm run test -- lib/tmdb.test.ts
```
Expected: 8 tests PASS

- [x] **Step 5: Commit**

```bash
git add lib/tmdb.ts lib/tmdb.test.ts
git commit -m "feat: add TMDB types and URL builder with unit tests"
```

---

## Task 2: TMDB API Route

Thin handler: resolve URL → check for null → fetch with Authorization header → proxy response. No URL logic here — that's all in `buildTmdbUrl`.

**Files:**
- Create: `app/api/tmdb/route.ts`

**Interfaces:**
- Consumes: `buildTmdbUrl(params)` from `@/lib/tmdb`
- Exposes: `GET /api/tmdb?action=search&query=...` → TMDB search JSON
- Exposes: `GET /api/tmdb?action=detail&id=238` → TMDB movie detail JSON
- Exposes: `GET /api/tmdb?action=discover&with_watch_providers=8&...` → TMDB discover JSON

- [x] **Step 1: Create the route handler**

```typescript
// app/api/tmdb/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { buildTmdbUrl } from '@/lib/tmdb'

export async function GET(request: NextRequest) {
  if (!process.env.TMDB_API_KEY) {
    return NextResponse.json({ error: 'TMDB not configured' }, { status: 500 })
  }

  const tmdbUrl = buildTmdbUrl(request.nextUrl.searchParams)

  if (!tmdbUrl) {
    return NextResponse.json(
      { error: 'Invalid or missing action parameter' },
      { status: 400 }
    )
  }

  const response = await fetch(tmdbUrl, {
    headers: {
      Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
      'Content-Type': 'application/json',
    },
  })

  const data: unknown = await response.json()
  return NextResponse.json(data, { status: response.status })
}
```

- [x] **Step 2: Run lint and type-check**

```
npm run lint
npx tsc --noEmit
```
Expected: no errors

- [x] **Step 3: Manual smoke test**

Make sure `.env.local` has `TMDB_API_KEY` set to your TMDB Read Access Token (from TMDB → Settings → API → API Read Access Token).

Start the dev server:
```
npm run dev
```

Open these URLs in the browser and verify you get valid JSON back:

```
http://localhost:3000/api/tmdb?action=search&query=The+Godfather
```
Expected: `{ results: [...], total_pages: ..., ... }` with movie objects

```
http://localhost:3000/api/tmdb?action=detail&id=238
```
Expected: full movie object with `runtime`, `genres` array, `credits.cast` array

```
http://localhost:3000/api/tmdb?action=discover&with_watch_providers=8
```
Expected: `{ results: [...] }` — movies available on Netflix (provider id 8) in Italy

```
http://localhost:3000/api/tmdb?action=unknown
```
Expected: `{ "error": "Invalid or missing action parameter" }` with status 400

In all valid responses: confirm the response JSON does **not** contain your `TMDB_API_KEY` string.

- [x] **Step 4: Commit**

```bash
git add app/api/tmdb/route.ts
git commit -m "feat: add TMDB API proxy route"
```

---

## Post-Module Checklist

- [x] All unit tests pass: `npm run test`
- [x] TypeScript clean: `npx tsc --noEmit`
- [x] Lint clean: `npm run lint`
- [x] Manual smoke test complete (all 4 URLs above)
- [x] Update `CLAUDE.md` build status table: Module 4 → ✅ Done
- [x] Check off Module 4 tasks in `docs/superpowers/plans/2026-09-16-showtime-implementation.md`
