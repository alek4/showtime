# Module 12 — Settings + Nav Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add a fixed bottom navigation bar (Watchlist, Discover, Stats, Search) and a `/settings` page with display name update and sign-out.

**Architecture:** `BottomNav` is a client component (needs `usePathname`) wired into the existing `app/(app)/layout.tsx`. The settings page is a server component using two server actions — one for display name (Supabase `auth.updateUser`) and one for sign-out (`auth.signOut`). No new tables, no new API routes.

**Tech Stack:** Next.js 15 App Router, Tailwind CSS v4, Supabase Auth, Vitest

**Spec:** `docs/superpowers/specs/2026-09-16-showtime-design.md`
**Design:** `DESIGN.md`
**Conventions:** `CLAUDE.md`

## Global Constraints

- TypeScript everywhere — no `any`, use `unknown` and narrow
- No `"use client"` unless component needs `useState`, `useEffect`, or browser event handlers
- Tailwind only — no CSS modules, no inline `style={}`
- Color tokens (from `app/globals.css @theme`): `bg-void` (#0A0906), `bg-surface` (#161310), `bg-raised` (#211D19), `border-rim` (#2E2822), `text-primary` (#F0E8DC), `text-secondary` (#8C7E6E), `text-ghost` (#4A3F35), `text-amber` (#F5A623), `bg-crimson-dim` (#5C1A13), `border-crimson` (#C0392B) — use token names, never raw hex in JSX className
- Font tokens: `font-display` (Bebas Neue), `font-body` (Outfit), `font-accent` (DM Serif Display italic)
- Minimum 44px touch targets on all interactive elements
- No co-author lines in commits
- Short imperative commit subjects
- TDD: write failing test → implement → green → commit

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `app/(app)/components/bottom-nav.tsx` | Create | Client component: fixed bottom nav, 4 items, active-route highlight; exports `isActiveRoute` for testing |
| `app/(app)/components/bottom-nav.test.ts` | Create | Unit tests for `isActiveRoute` pure helper |
| `app/(app)/layout.tsx` | Modify | Import and render `<BottomNav />` |
| `app/(app)/settings/page.tsx` | Create | Server component: display name form + sign-out button |
| `app/(app)/settings/actions.ts` | Create | `updateDisplayNameAction`, `signOutAction` server actions |

---

## Task 1: BottomNav component + isActiveRoute + layout wiring

**Files:**
- Create: `app/(app)/components/bottom-nav.tsx`
- Create: `app/(app)/components/bottom-nav.test.ts`
- Modify: `app/(app)/layout.tsx`

**Interfaces:**
- Produces: `isActiveRoute(pathname: string, href: string): boolean` — exported pure helper, testable without Next.js
- Produces: `BottomNav()` — "use client" component, uses `usePathname`

- [x] **Step 1: Write the failing test**

Create `app/(app)/components/bottom-nav.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'

vi.mock('next/navigation', () => ({ usePathname: vi.fn() }))
vi.mock('next/link', () => ({ default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => children }))

import { isActiveRoute } from './bottom-nav'

describe('isActiveRoute', () => {
  it('matches / exactly — does not activate on /discover', () => {
    expect(isActiveRoute('/', '/')).toBe(true)
    expect(isActiveRoute('/discover', '/')).toBe(false)
  })

  it('matches non-root routes by startsWith', () => {
    expect(isActiveRoute('/discover', '/discover')).toBe(true)
    expect(isActiveRoute('/stats', '/discover')).toBe(false)
    expect(isActiveRoute('/search', '/search')).toBe(true)
    expect(isActiveRoute('/stats', '/stats')).toBe(true)
  })

  it('does not match a route that merely contains the href as a substring', () => {
    expect(isActiveRoute('/discover', '/dis')).toBe(false)
  })
})
```

- [x] **Step 2: Run test to verify it fails**

```bash
npm run test -- --reporter=verbose app/\(app\)/components/bottom-nav.test.ts
```

Expected: FAIL — `isActiveRoute is not a function` (module doesn't exist yet).

- [x] **Step 3: Create `app/(app)/components/bottom-nav.tsx`**

```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function isActiveRoute(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname.startsWith(href)
}

const NAV_ITEMS = [
  {
    href: '/',
    label: 'Watchlist',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: '/discover',
    label: 'Discover',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
      </svg>
    ),
  },
  {
    href: '/stats',
    label: 'Stats',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    href: '/search',
    label: 'Search',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-rim z-50">
      <div className="flex h-16">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const active = isActiveRoute(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs font-body transition-colors min-h-[44px] ${
                active ? 'text-amber' : 'text-ghost hover:text-secondary'
              }`}
            >
              {icon}
              <span className="leading-none">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

- [x] **Step 4: Run test to verify it passes**

```bash
npm run test -- --reporter=verbose app/\(app\)/components/bottom-nav.test.ts
```

Expected: all 3 tests PASS.

- [x] **Step 5: Wire BottomNav into `app/(app)/layout.tsx`**

Replace the entire file with:

```typescript
import { BottomNav } from './components/bottom-nav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen pb-16">
      {children}
      <BottomNav />
    </div>
  )
}
```

- [x] **Step 6: Start the dev server and verify**

```bash
npm run dev
```

Open `http://localhost:3000`. Verify:
- Bottom nav appears with 4 items: Watchlist, Discover, Stats, Search
- Watchlist item is amber (active), others are ghost-colored
- Navigate to `/discover` — Discover item turns amber
- Navigate to `/stats` — Stats item turns amber
- Navigate to `/search` — Search item turns amber
- Content is not hidden behind the nav (padding-bottom works)
- Nav is at least 44px tall (touch target)
- No TypeScript errors in terminal

- [x] **Step 7: Commit**

```bash
git add "app/(app)/components/bottom-nav.tsx" "app/(app)/components/bottom-nav.test.ts" "app/(app)/layout.tsx"
git commit -m "feat: add bottom navigation bar with active route highlight"
```

---

## Task 2: Settings page + sign-out

**Files:**
- Create: `app/(app)/settings/actions.ts`
- Create: `app/(app)/settings/page.tsx`

**Interfaces:**
- Consumes: `createClient()` from `@/lib/supabase/server` (async, as per CLAUDE.md)
- Produces: `updateDisplayNameAction(formData: FormData): Promise<void>` — updates `user.user_metadata.full_name` via `supabase.auth.updateUser`, redirects back to `/settings`
- Produces: `signOutAction(): Promise<void>` — calls `supabase.auth.signOut()`, redirects to `/login`

No unit tests for server actions (they call Supabase directly, the same pattern used throughout the app). Verify by running the dev server.

- [x] **Step 1: Create `app/(app)/settings/actions.ts`**

```typescript
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function updateDisplayNameAction(formData: FormData): Promise<void> {
  const displayName = (formData.get('displayName') as string).trim()
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({
    data: { full_name: displayName },
  })
  if (error) throw error
  redirect('/settings')
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

- [x] **Step 2: Create `app/(app)/settings/page.tsx`**

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { updateDisplayNameAction, signOutAction } from './actions'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const displayName: string = (user.user_metadata?.full_name as string | undefined) ?? ''

  return (
    <main className="bg-void min-h-screen pt-6 pb-4">
      <h1 className="font-display text-4xl tracking-wide text-primary px-4 mb-8">
        Settings
      </h1>
      <div className="px-4 space-y-10">
        <section>
          <h2 className="font-display text-2xl tracking-wide text-primary mb-4">
            Display name
          </h2>
          <form action={updateDisplayNameAction} className="flex flex-col gap-3">
            <input
              type="text"
              name="displayName"
              defaultValue={displayName}
              placeholder="Your name"
              className="bg-raised border border-rim rounded-lg px-4 py-3 text-primary font-body placeholder:text-ghost focus:outline-none focus:border-amber"
            />
            <button
              type="submit"
              className="bg-amber text-void font-display text-xl tracking-wide py-3 rounded-lg"
            >
              Save
            </button>
          </form>
        </section>

        <section>
          <h2 className="font-display text-2xl tracking-wide text-primary mb-4">
            Account
          </h2>
          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full bg-crimson-dim text-primary font-display text-xl tracking-wide py-3 rounded-lg border border-crimson"
            >
              Sign out
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}
```

- [x] **Step 3: Verify in the browser**

With the dev server running, navigate to `http://localhost:3000/settings`. Verify:
- "Settings" heading renders in Bebas Neue
- "Display name" section shows a text input with the current name pre-filled (empty if never set)
- Typing a new name and clicking Save → page reloads, input shows the new name
- "Sign out" button is visible with crimson background
- Clicking Sign out → redirected to `/login`
- After sign-out, navigating to any `/` route → redirected to `/login`
- Bottom nav is visible on the settings page (Settings is not in the nav — no item should be active)
- No TypeScript errors in terminal

- [x] **Step 4: Run the full test suite**

```bash
npm run test
```

Expected: all existing tests pass (≥ 115). The `bottom-nav.test.ts` tests are included.

- [x] **Step 5: Commit**

```bash
git add "app/(app)/settings/actions.ts" "app/(app)/settings/page.tsx"
git commit -m "feat: add settings page with display name update and sign-out"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] `/settings` — display name update via `updateDisplayNameAction`
- [x] `/settings` — logout via `signOutAction` → redirect to `/login`
- [x] Bottom nav — four items: Watchlist (`/`), Discover (`/discover`), Stats (`/stats`), Search (`/search`)
- [x] Bottom nav — fixed, thumb-zone, minimum 44px touch targets
- [x] Bottom nav — highlights active route (amber)
- [x] Empty states — already handled by existing `Shelf` component using `font-accent italic text-ghost` (DM Serif Display italic + dim) — no separate `empty-shelf.tsx` needed (YAGNI)
- [x] `app/(app)/layout.tsx` — `<BottomNav />` added, `pb-16` already in place from Module 11

**DESIGN.md coverage:**
- [x] "Bottom nav bar on mobile (thumb zone)" — `fixed bottom-0`, `h-16`
- [x] "Four items max: Watchlist, Discover, Stats, Search. No hamburger menu." — exactly 4 `Link` items
- [x] "Minimum 44×44px for anything interactive" — `min-h-[44px]` on each nav item
- [x] Colors: active = `text-amber`, inactive = `text-ghost hover:text-secondary` — consistent with warm palette
- [x] Sign-out button uses crimson (destructive action color) per DESIGN.md: "Red is reserved for watched state and destructive actions only"

**Placeholder scan:** None found.

**Type consistency:**
- `isActiveRoute(pathname: string, href: string): boolean` — used in `BottomNav` with `usePathname()` return (string) and `href` string literals. Matches test usage.
- `updateDisplayNameAction(formData: FormData): Promise<void>` — used as `action={updateDisplayNameAction}` on a `<form>`. Next.js server actions on forms receive `FormData`. Clean.
- `signOutAction(): Promise<void>` — used as `action={signOutAction}` on a `<form>` with no inputs. Clean.
- `user.user_metadata?.full_name` cast to `string | undefined` — consistent with Supabase `User` type where `user_metadata` is `Record<string, unknown>`.
