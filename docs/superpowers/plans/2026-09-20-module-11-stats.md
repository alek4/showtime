# Module 11 — Stats Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build a `/stats` server-rendered page that shows total watched count, watch time, backlog count, genre breakdown (bar chart), and monthly timeline (bar chart) over the last 12 months.

**Architecture:** Server component fetches `getWatchStats()` from the existing data layer, formats data with two new pure helpers, then passes data down to two Recharts client components (`GenreChart`, `TimelineChart`) and a presentational `StatCard`. No new API routes or DB queries — all data is already available from `getWatchStats`.

**Tech Stack:** Next.js 15 App Router, Tailwind CSS v4, Recharts (to be installed), Vitest

**Spec:** `docs/superpowers/specs/2026-09-16-showtime-design.md`
**Conventions:** `CLAUDE.md`

## Global Constraints

- TypeScript everywhere — no `any`, use `unknown` and narrow
- No `"use client"` unless component needs `useState`, `useEffect`, or event handlers
- Tailwind only — no CSS modules, no inline `style={}`
- Color tokens: `text-amber` (#F5A623), `bg-raised` (#211D19), `bg-void` (#0A0906), `text-primary` (#F0E8DC), `text-secondary` (#8C7E6E), `bg-rim`/`border-rim` (#2E2822)
- Font tokens: `font-display` (Bebas Neue), `font-body` (Outfit), `font-accent` (DM Serif Display)
- TDD: write failing test → implement → green → commit. One commit per green test suite.
- No co-author lines in commits
- Short imperative commit subjects

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `lib/data/stats.ts` | Modify | Add `formatWatchTime` and `fillTimelineGaps` pure helpers |
| `lib/data/stats.test.ts` | Modify | Add tests for both helpers |
| `app/(app)/stats/page.tsx` | Create | Server component: auth check, fetch stats, render all sections |
| `app/(app)/stats/stat-card.tsx` | Create | Presentational: large Bebas Neue value + label |
| `app/(app)/stats/genre-chart.tsx` | Create | Client: Recharts horizontal BarChart for genre breakdown |
| `app/(app)/stats/timeline-chart.tsx` | Create | Client: Recharts vertical BarChart for last 12 months |

---

## Task 1: Install Recharts

**Files:**
- Modify: `package.json` (via npm)

**Interfaces:**
- Produces: `recharts` available as a dependency for Tasks 5–6

- [x] **Step 1: Install recharts**

```bash
npm install recharts
```

If you see peer dependency errors about React 19, run instead:
```bash
npm install recharts --legacy-peer-deps
```

- [x] **Step 2: Verify the build still compiles**

```bash
npm run build
```

Expected: exits 0, no TypeScript or module errors.

- [x] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install recharts"
```

---

## Task 2: `formatWatchTime` helper + test

**Files:**
- Modify: `lib/data/stats.ts` (add export)
- Modify: `lib/data/stats.test.ts` (add describe block)

**Interfaces:**
- Produces: `formatWatchTime(minutes: number, hasGaps: boolean): string`
  - `formatWatchTime(90, false)` → `"1h 30m"`
  - `formatWatchTime(90, true)` → `"~1h 30m"`

- [x] **Step 1: Write the failing test**

Add to `lib/data/stats.test.ts` (after the existing imports, as a new `describe` block at the end of the file):

```typescript
import { computeRuntimeTotal, computeGenreBreakdown, computeMonthlyTimeline, getWatchStats, formatWatchTime } from './stats'
```

Replace the existing import line with the above (adds `formatWatchTime`), then add at the end of the file:

```typescript
describe('formatWatchTime', () => {
  it('formats hours and minutes from total minutes', () => {
    expect(formatWatchTime(90, false)).toBe('1h 30m')
  })

  it('prefixes ~ when hasGaps is true', () => {
    expect(formatWatchTime(90, true)).toBe('~1h 30m')
  })

  it('handles zero minutes', () => {
    expect(formatWatchTime(0, false)).toBe('0h 0m')
  })

  it('handles exactly one hour', () => {
    expect(formatWatchTime(60, false)).toBe('1h 0m')
  })

  it('handles large values', () => {
    expect(formatWatchTime(142 * 60 + 30, false)).toBe('142h 30m')
  })
})
```

- [x] **Step 2: Run test to verify it fails**

```bash
npm run test -- --reporter=verbose lib/data/stats.test.ts
```

Expected: FAIL — `formatWatchTime is not a function` or similar.

- [x] **Step 3: Implement `formatWatchTime` in `lib/data/stats.ts`**

Add after the `computeMonthlyTimeline` function and before the `// ─── DB query ───` comment:

```typescript
export function formatWatchTime(minutes: number, hasGaps: boolean): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const formatted = `${h}h ${m}m`
  return hasGaps ? `~${formatted}` : formatted
}
```

- [x] **Step 4: Run test to verify it passes**

```bash
npm run test -- --reporter=verbose lib/data/stats.test.ts
```

Expected: all tests in the file PASS (the new suite + existing suites).

- [x] **Step 5: Commit**

```bash
git add lib/data/stats.ts lib/data/stats.test.ts
git commit -m "feat: add formatWatchTime helper"
```

---

## Task 3: `fillTimelineGaps` helper + test

**Files:**
- Modify: `lib/data/stats.ts` (add export)
- Modify: `lib/data/stats.test.ts` (add describe block + update import)

**Interfaces:**
- Produces: `fillTimelineGaps(data: Array<{ month: string; count: number }>, now?: Date): Array<{ month: string; count: number }>`
  - Always returns exactly 12 entries
  - Last entry is the month of `now` (defaults to `new Date()`)
  - Months not present in `data` get `count: 0`

- [x] **Step 1: Write the failing test**

Update the import in `lib/data/stats.test.ts` to add `fillTimelineGaps`:

```typescript
import { computeRuntimeTotal, computeGenreBreakdown, computeMonthlyTimeline, getWatchStats, formatWatchTime, fillTimelineGaps } from './stats'
```

Add at the end of the file:

```typescript
describe('fillTimelineGaps', () => {
  it('returns exactly 12 months ending at now', () => {
    const now = new Date('2026-09-20')
    const result = fillTimelineGaps([], now)
    expect(result).toHaveLength(12)
    expect(result[0].month).toBe('2025-10')
    expect(result[11].month).toBe('2026-09')
  })

  it('fills months not in data with count 0', () => {
    const now = new Date('2026-09-20')
    const result = fillTimelineGaps([{ month: '2026-09', count: 3 }], now)
    expect(result.find(r => r.month === '2026-09')?.count).toBe(3)
    expect(result.find(r => r.month === '2026-08')?.count).toBe(0)
  })

  it('preserves counts for months present in data', () => {
    const now = new Date('2026-09-20')
    const data = [
      { month: '2026-01', count: 5 },
      { month: '2026-06', count: 2 },
    ]
    const result = fillTimelineGaps(data, now)
    expect(result.find(r => r.month === '2026-01')?.count).toBe(5)
    expect(result.find(r => r.month === '2026-06')?.count).toBe(2)
  })

  it('ignores data entries outside the 12-month window', () => {
    const now = new Date('2026-09-20')
    const data = [{ month: '2024-01', count: 99 }]
    const result = fillTimelineGaps(data, now)
    expect(result.find(r => r.month === '2024-01')).toBeUndefined()
  })
})
```

- [x] **Step 2: Run test to verify it fails**

```bash
npm run test -- --reporter=verbose lib/data/stats.test.ts
```

Expected: FAIL — `fillTimelineGaps is not a function`.

- [x] **Step 3: Implement `fillTimelineGaps` in `lib/data/stats.ts`**

Add after `formatWatchTime` and before the `// ─── DB query ───` comment:

```typescript
export function fillTimelineGaps(
  data: Array<{ month: string; count: number }>,
  now?: Date
): Array<{ month: string; count: number }> {
  const ref = now ?? new Date()
  const months: string[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1)
    months.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    )
  }
  const lookup = Object.fromEntries(data.map(d => [d.month, d.count]))
  return months.map(month => ({ month, count: lookup[month] ?? 0 }))
}
```

- [x] **Step 4: Run test to verify it passes**

```bash
npm run test -- --reporter=verbose lib/data/stats.test.ts
```

Expected: all tests PASS.

- [x] **Step 5: Commit**

```bash
git add lib/data/stats.ts lib/data/stats.test.ts
git commit -m "feat: add fillTimelineGaps helper"
```

---

## Task 4: `StatCard` component + `StatsPage` skeleton

**Files:**
- Create: `app/(app)/stats/stat-card.tsx`
- Create: `app/(app)/stats/page.tsx`

**Interfaces:**
- Consumes: `getWatchStats(): Promise<WatchStats>` from `lib/data/stats.ts`; `formatWatchTime(minutes, hasGaps): string` from `lib/data/stats.ts`
- Produces: `StatCard({ value: string, label: string, small?: boolean })` used by page and Tasks 5–6

No unit tests for presentational components. Verify visually by running the dev server.

- [x] **Step 1: Create `app/(app)/stats/stat-card.tsx`**

```typescript
type Props = {
  value: string
  label: string
  small?: boolean
}

export function StatCard({ value, label, small = false }: Props) {
  return (
    <div className="bg-raised rounded-lg p-4 flex flex-col gap-1 border border-rim">
      <span
        className={`font-display tracking-wide text-amber leading-none ${
          small ? 'text-3xl' : 'text-5xl'
        }`}
      >
        {value}
      </span>
      <span className="text-secondary text-xs uppercase tracking-widest font-body">
        {label}
      </span>
    </div>
  )
}
```

- [x] **Step 2: Create `app/(app)/stats/page.tsx`**

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getWatchStats, formatWatchTime, fillTimelineGaps } from '@/lib/data/stats'
import { StatCard } from './stat-card'

export default async function StatsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const stats = await getWatchStats()
  const watchTime = formatWatchTime(stats.totalRuntime.minutes, stats.totalRuntime.hasGaps)
  const topGenre = stats.genreBreakdown[0]?.genre ?? '—'

  return (
    <main className="bg-void min-h-screen pt-6 pb-4">
      <h1 className="font-display text-4xl tracking-wide text-primary px-4 mb-6">
        Stats
      </h1>
      <div className="px-4 space-y-8">
        <div className="grid grid-cols-2 gap-4">
          <StatCard value={String(stats.totalWatched)} label="Watched" />
          <StatCard value={String(stats.backlog)} label="Backlog" />
          <StatCard value={watchTime} label="Watch time" />
          <StatCard value={topGenre} label="Top genre" small />
        </div>
      </div>
    </main>
  )
}
```

- [x] **Step 3: Start the dev server and navigate to `/stats`**

```bash
npm run dev
```

Open `http://localhost:3000/stats` (sign in first if needed). Verify:
- Page title "Stats" renders in Bebas Neue
- 4 stat cards are visible with correct values
- Numbers render in amber Bebas Neue, labels in secondary small caps
- No TypeScript errors in the terminal

- [x] **Step 4: Commit**

```bash
git add app/(app)/stats/stat-card.tsx app/(app)/stats/page.tsx
git commit -m "feat: add stats page skeleton with stat cards"
```

---

## Task 5: `GenreChart` component

**Files:**
- Create: `app/(app)/stats/genre-chart.tsx`
- Modify: `app/(app)/stats/page.tsx` (add import + JSX section)

**Interfaces:**
- Consumes: `data: Array<{ genre: string; count: number }>` — sorted count descending (already sorted by `computeGenreBreakdown`)
- Produces: `GenreChart({ data })` — horizontal Recharts BarChart

- [x] **Step 1: Create `app/(app)/stats/genre-chart.tsx`**

```typescript
'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

type Props = {
  data: Array<{ genre: string; count: number }>
}

export function GenreChart({ data }: Props) {
  const barHeight = 40
  const height = Math.max(160, data.length * barHeight)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
      >
        <XAxis
          type="number"
          tick={{ fill: '#8C7E6E', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="genre"
          tick={{ fill: '#F0E8DC', fontSize: 13 }}
          axisLine={false}
          tickLine={false}
          width={100}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#211D19',
            border: '1px solid #2E2822',
            borderRadius: 8,
          }}
          labelStyle={{ color: '#F0E8DC' }}
          itemStyle={{ color: '#F5A623' }}
          cursor={{ fill: '#2E2822' }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={i === 0 ? '#F5A623' : '#7A5212'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
```

- [x] **Step 2: Wire `GenreChart` into `app/(app)/stats/page.tsx`**

Add the import at the top of `page.tsx`:

```typescript
import { GenreChart } from './genre-chart'
```

Replace the closing `</div>` of the `space-y-8` div with:

```typescript
        {stats.genreBreakdown.length > 0 && (
          <section>
            <h2 className="font-display text-2xl tracking-wide text-primary mb-3">
              By genre
            </h2>
            <GenreChart data={stats.genreBreakdown} />
          </section>
        )}
      </div>
    </main>
  )
}
```

The full updated return should look like:

```typescript
  return (
    <main className="bg-void min-h-screen pt-6 pb-4">
      <h1 className="font-display text-4xl tracking-wide text-primary px-4 mb-6">
        Stats
      </h1>
      <div className="px-4 space-y-8">
        <div className="grid grid-cols-2 gap-4">
          <StatCard value={String(stats.totalWatched)} label="Watched" />
          <StatCard value={String(stats.backlog)} label="Backlog" />
          <StatCard value={watchTime} label="Watch time" />
          <StatCard value={topGenre} label="Top genre" small />
        </div>

        {stats.genreBreakdown.length > 0 && (
          <section>
            <h2 className="font-display text-2xl tracking-wide text-primary mb-3">
              By genre
            </h2>
            <GenreChart data={stats.genreBreakdown} />
          </section>
        )}
      </div>
    </main>
  )
```

- [x] **Step 3: Verify in browser**

Navigate to `http://localhost:3000/stats`. Verify:
- Genre section appears with a horizontal bar chart
- Highest-count genre bar is amber (#F5A623), rest are amber-dim (#7A5212)
- Tooltip appears on hover with dark background
- Section is hidden when watchlist has no watched titles (empty `genreBreakdown`)
- No TypeScript or console errors

- [x] **Step 4: Commit**

```bash
git add app/(app)/stats/genre-chart.tsx app/(app)/stats/page.tsx
git commit -m "feat: add genre breakdown chart to stats page"
```

---

## Task 6: `TimelineChart` component

**Files:**
- Create: `app/(app)/stats/timeline-chart.tsx`
- Modify: `app/(app)/stats/page.tsx` (add import, pass `fillTimelineGaps` output, add JSX section)

**Interfaces:**
- Consumes: `data: Array<{ month: string; count: number }>` — exactly 12 entries in `YYYY-MM` order (caller passes `fillTimelineGaps(stats.monthlyTimeline)`)
- Produces: `TimelineChart({ data })` — vertical Recharts BarChart

- [x] **Step 1: Create `app/(app)/stats/timeline-chart.tsx`**

```typescript
'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

type Props = {
  data: Array<{ month: string; count: number }>
}

function shortMonth(yyyyMm: string): string {
  const [year, m] = yyyyMm.split('-')
  const d = new Date(Number(year), Number(m) - 1, 1)
  return d.toLocaleString('en', { month: 'short' })
}

export function TimelineChart({ data }: Props) {
  const display = data.map(d => ({ ...d, label: shortMonth(d.month) }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={display} margin={{ top: 0, right: 0, bottom: 0, left: -24 }}>
        <XAxis
          dataKey="label"
          tick={{ fill: '#8C7E6E', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: '#8C7E6E', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#211D19',
            border: '1px solid #2E2822',
            borderRadius: 8,
          }}
          labelStyle={{ color: '#F0E8DC' }}
          itemStyle={{ color: '#F5A623' }}
          cursor={{ fill: '#2E2822' }}
        />
        <Bar dataKey="count" fill="#F5A623" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
```

- [x] **Step 2: Wire `TimelineChart` into `app/(app)/stats/page.tsx`**

Add the import at the top of `page.tsx`:

```typescript
import { TimelineChart } from './timeline-chart'
```

The `fillTimelineGaps` call is already in the import from `lib/data/stats`. The variable `timelineData` is already computed in the existing page scaffold. Update `page.tsx` to add the Monthly section. The final full `page.tsx` should be:

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getWatchStats, formatWatchTime, fillTimelineGaps } from '@/lib/data/stats'
import { StatCard } from './stat-card'
import { GenreChart } from './genre-chart'
import { TimelineChart } from './timeline-chart'

export default async function StatsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const stats = await getWatchStats()
  const watchTime = formatWatchTime(stats.totalRuntime.minutes, stats.totalRuntime.hasGaps)
  const topGenre = stats.genreBreakdown[0]?.genre ?? '—'
  const timelineData = fillTimelineGaps(stats.monthlyTimeline)

  return (
    <main className="bg-void min-h-screen pt-6 pb-4">
      <h1 className="font-display text-4xl tracking-wide text-primary px-4 mb-6">
        Stats
      </h1>
      <div className="px-4 space-y-8">
        <div className="grid grid-cols-2 gap-4">
          <StatCard value={String(stats.totalWatched)} label="Watched" />
          <StatCard value={String(stats.backlog)} label="Backlog" />
          <StatCard value={watchTime} label="Watch time" />
          <StatCard value={topGenre} label="Top genre" small />
        </div>

        {stats.genreBreakdown.length > 0 && (
          <section>
            <h2 className="font-display text-2xl tracking-wide text-primary mb-3">
              By genre
            </h2>
            <GenreChart data={stats.genreBreakdown} />
          </section>
        )}

        <section>
          <h2 className="font-display text-2xl tracking-wide text-primary mb-3">
            Monthly
          </h2>
          <TimelineChart data={timelineData} />
        </section>
      </div>
    </main>
  )
}
```

- [x] **Step 3: Verify in browser**

Navigate to `http://localhost:3000/stats`. Verify:
- "Monthly" section appears with a 12-bar vertical bar chart
- X-axis shows 3-letter month names (Oct, Nov, …, Sep)
- Bars are amber; months with no watches show a zero-height (or very short) bar
- Tooltip shows the month label and count on hover
- No TypeScript or console errors
- Run `npm run test` — all existing tests still pass (should still be 106+)

- [x] **Step 4: Commit**

```bash
git add app/(app)/stats/timeline-chart.tsx app/(app)/stats/page.tsx
git commit -m "feat: add monthly timeline chart to stats page"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Total movies watched — `StatCard` with `stats.totalWatched`
- [x] Total watch time with `~` prefix — `formatWatchTime` + `StatCard`
- [x] Backlog count — `StatCard` with `stats.backlog`
- [x] Genre breakdown, counting across all genres — `computeGenreBreakdown` (existing), `GenreChart`
- [x] Monthly timeline, last 12 months — `fillTimelineGaps` + `TimelineChart`

**Placeholder scan:** None found.

**Type consistency:**
- `getWatchStats` returns `WatchStats` with `genreBreakdown: Array<{ genre: string; count: number }>` and `monthlyTimeline: Array<{ month: string; count: number }>` — matches prop types in both chart components.
- `formatWatchTime(minutes: number, hasGaps: boolean): string` — called with `stats.totalRuntime.minutes` and `stats.totalRuntime.hasGaps`, both correct.
- `fillTimelineGaps` returns `Array<{ month: string; count: number }>` — matches `TimelineChart` prop type.
