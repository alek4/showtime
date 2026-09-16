# Module 3 — Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Login page at `/login`, middleware that protects all routes, and an authenticated route-group layout shell.

**Architecture:** Pure redirect logic extracted to a unit-testable helper; middleware wires that helper to Next.js's request/response cycle using `@supabase/ssr`'s cookie-aware client. All authenticated pages live under the `(app)` route group so they share a layout. No signup route — accounts are Supabase-dashboard-only.

**Tech Stack:** Next.js 15 App Router, `@supabase/ssr`, Supabase Auth (email + password), Vitest

**Spec:** `docs/superpowers/specs/2026-09-16-showtime-design.md`
**Conventions:** `CLAUDE.md`

## Global Constraints

- TypeScript everywhere — no `any`, use `unknown` and narrow
- No `"use client"` unless the component needs `useState`, `useEffect`, or browser events
- No public signup — only `/login` is exposed, no `/register`
- RLS already enforces `allowed_users`; auth here is just Supabase email + password
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (not `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- `createClient()` in `lib/supabase/server.ts` is `async` — always `await` it
- No co-author lines in commits
- TDD: failing test → implementation → green → commit

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `lib/auth/get-redirect.ts` | Create | Pure function: given `isAuthenticated + pathname` → redirect instruction |
| `lib/auth/get-redirect.test.ts` | Create | Unit tests for the pure helper |
| `middleware.ts` | Create | Next.js middleware: session refresh + calls redirect helper |
| `app/login/actions.ts` | Create | `signIn` server action (calls Supabase `signInWithPassword`) |
| `app/login/page.tsx` | Create | Login form UI (reads `?error` search param for failure messages) |
| `app/(app)/layout.tsx` | Create | Authenticated layout shell (bottom nav placeholder — filled in Module 12) |
| `app/(app)/page.tsx` | Create | Placeholder home (proves auth flow works; replaced in Module 8) |
| `app/page.tsx` | **Delete** | Boilerplate — conflicts with `app/(app)/page.tsx` at `/` |

---

## Task 1: Auth Redirect Helper

**Files:**
- Create: `lib/auth/get-redirect.ts`
- Create: `lib/auth/get-redirect.test.ts`

**Interfaces:**
- Produces: `getAuthRedirect(isAuthenticated: boolean, pathname: string): AuthRedirectResult`
- Produces: `type AuthRedirectResult = { action: 'redirect'; to: string } | { action: 'continue' }`

- [x] **Step 1: Write the failing test**

```typescript
// lib/auth/get-redirect.test.ts
import { describe, it, expect } from 'vitest'
import { getAuthRedirect } from './get-redirect'

describe('getAuthRedirect', () => {
  it('redirects unauthenticated user away from home', () => {
    expect(getAuthRedirect(false, '/')).toEqual({ action: 'redirect', to: '/login' })
  })

  it('redirects unauthenticated user away from nested route', () => {
    expect(getAuthRedirect(false, '/stats')).toEqual({ action: 'redirect', to: '/login' })
  })

  it('allows unauthenticated user to access login page', () => {
    expect(getAuthRedirect(false, '/login')).toEqual({ action: 'continue' })
  })

  it('redirects authenticated user away from login page', () => {
    expect(getAuthRedirect(true, '/login')).toEqual({ action: 'redirect', to: '/' })
  })

  it('allows authenticated user to access home', () => {
    expect(getAuthRedirect(true, '/')).toEqual({ action: 'continue' })
  })

  it('allows authenticated user to access nested route', () => {
    expect(getAuthRedirect(true, '/stats')).toEqual({ action: 'continue' })
  })
})
```

- [x] **Step 2: Run test to verify it fails**

```
npm run test -- lib/auth/get-redirect.test.ts
```
Expected: FAIL — `Cannot find module './get-redirect'`

- [x] **Step 3: Implement the helper**

```typescript
// lib/auth/get-redirect.ts
export type AuthRedirectResult =
  | { action: 'redirect'; to: string }
  | { action: 'continue' }

export function getAuthRedirect(
  isAuthenticated: boolean,
  pathname: string
): AuthRedirectResult {
  const isLoginPage = pathname === '/login'

  if (!isAuthenticated && !isLoginPage) {
    return { action: 'redirect', to: '/login' }
  }
  if (isAuthenticated && isLoginPage) {
    return { action: 'redirect', to: '/' }
  }
  return { action: 'continue' }
}
```

- [x] **Step 4: Run test to verify it passes**

```
npm run test -- lib/auth/get-redirect.test.ts
```
Expected: 6 tests PASS

- [x] **Step 5: Commit**

```bash
git add lib/auth/get-redirect.ts lib/auth/get-redirect.test.ts
git commit -m "feat: add auth redirect helper with unit tests"
```

---

## Task 2: Middleware

**Files:**
- Create: `middleware.ts` (project root — Next.js requires this exact location)

**Interfaces:**
- Consumes: `getAuthRedirect(isAuthenticated, pathname)` from `lib/auth/get-redirect`
- Consumes: `createServerClient` from `@supabase/ssr`

The middleware must use `@supabase/ssr`'s cookie-passing pattern **exactly as shown** — deviating from it breaks session refresh.

- [x] **Step 1: Create middleware.ts**

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthRedirect } from '@/lib/auth/get-redirect'

export async function middleware(request: NextRequest) {
  // supabaseResponse must be reassigned inside setAll — this is the SSR cookie pattern
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() both validates the session token and refreshes it
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const result = getAuthRedirect(user !== null, request.nextUrl.pathname)

  if (result.action === 'redirect') {
    const url = request.nextUrl.clone()
    url.pathname = result.to
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  // Run on every request except static assets
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [x] **Step 2: Run linter**

```
npm run lint
```
Expected: no errors

- [x] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: add Next.js middleware for session refresh and route protection"
```

---

## Task 3: Login Server Action

**Files:**
- Create: `app/login/actions.ts`

**Interfaces:**
- Produces: `signIn(formData: FormData): Promise<void>` — on error redirects to `/login?error=invalid_credentials`; on success redirects to `/`

- [x] **Step 1: Create actions.ts**

```typescript
// app/login/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signIn(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect('/login?error=invalid_credentials')
  }

  redirect('/')
}
```

- [x] **Step 2: Run linter**

```
npm run lint
```
Expected: no errors

- [x] **Step 3: Commit**

```bash
git add app/login/actions.ts
git commit -m "feat: add signIn server action"
```

---

## Task 4: Login Page UI

**Files:**
- Create: `app/login/page.tsx`

**Interfaces:**
- Consumes: `signIn` from `./actions`
- Receives: `searchParams: Promise<{ error?: string }>` — Next.js 15 makes page search params async

The page is a Server Component (no `"use client"`). The `<form action={signIn}>` binds directly to the server action. Errors are communicated via URL search params to avoid requiring a client component.

- [x] **Step 1: Create page.tsx**

```tsx
// app/login/page.tsx
import { signIn } from './actions'

type Props = {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const { error } = await searchParams

  return (
    <div className="min-h-screen bg-void flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-5xl text-primary mb-2 text-center tracking-wider">
          SHOWTIME
        </h1>
        <p className="font-body text-secondary text-center text-sm mb-10">
          Your private watchlist
        </p>

        <form action={signIn} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="email"
              className="block font-body text-sm text-secondary mb-1.5"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full bg-surface border border-rim rounded-lg px-4 py-3 font-body text-primary placeholder:text-ghost focus:outline-none focus:border-amber"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block font-body text-sm text-secondary mb-1.5"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full bg-surface border border-rim rounded-lg px-4 py-3 font-body text-primary focus:outline-none focus:border-amber"
            />
          </div>

          {error === 'invalid_credentials' && (
            <p className="font-body text-sm text-crimson text-center">
              Invalid email or password.
            </p>
          )}

          <button
            type="submit"
            className="w-full bg-amber text-void font-display text-xl py-3 rounded-lg mt-2 hover:opacity-90 transition-opacity"
          >
            SIGN IN
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [x] **Step 2: Run linter and type-check**

```
npm run lint
npx tsc --noEmit
```
Expected: no errors

- [x] **Step 3: Commit**

```bash
git add app/login/page.tsx
git commit -m "feat: add login page UI"
```

---

## Task 5: Route Group + Authenticated Shell

**Files:**
- Create: `app/(app)/layout.tsx`
- Create: `app/(app)/page.tsx`
- **Delete:** `app/page.tsx` (conflicts with `app/(app)/page.tsx` at the same `/` URL)

`app/(app)/page.tsx` is a temporary placeholder that proves the auth flow works end-to-end. Module 8 will replace it with the real watchlist home.

**Interfaces:**
- Consumes: `signOut` (defined below in `app/(app)/page.tsx` inline for now; Module 12 moves sign-out to `/settings`)

- [x] **Step 1: Delete the boilerplate app/page.tsx**

```bash
# PowerShell
Remove-Item app\page.tsx
```

Or delete via your editor.

- [x] **Step 2: Create the authenticated layout**

```tsx
// app/(app)/layout.tsx
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    // pb-16 reserved for the bottom nav bar added in Module 12
    <div className="min-h-screen pb-16">
      {children}
    </div>
  )
}
```

- [x] **Step 3: Create the placeholder home page**

```tsx
// app/(app)/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function signOut() {
  'use server'
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="p-6">
      <h1 className="font-display text-3xl text-primary mb-2">Watchlist</h1>
      <p className="font-body text-secondary text-sm mb-8">
        Signed in as {user?.email}
      </p>
      <p className="font-body text-ghost text-sm mb-8">
        Coming soon — Module 8 replaces this page.
      </p>
      <form action={signOut}>
        <button
          type="submit"
          className="font-body text-sm text-secondary underline underline-offset-2"
        >
          Sign out
        </button>
      </form>
    </main>
  )
}
```

- [x] **Step 4: Run linter and type-check**

```
npm run lint
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 5: Manual smoke test**

Start the dev server:
```
npm run dev
```

1. Open `http://localhost:3000` while **not** logged in → browser should redirect to `http://localhost:3000/login`
2. Enter wrong credentials → page reloads with "Invalid email or password."
3. Enter correct credentials (use a real Supabase account from the dashboard) → redirects to `/`, sees "Signed in as your@email.com"
4. Click "Sign out" → redirects to `/login`
5. Navigate directly to `http://localhost:3000/login` while logged in → redirects to `/`

All five flows must pass.

- [x] **Step 6: Commit**

```bash
git add app/(app)/layout.tsx "app/(app)/page.tsx"
git commit -m "feat: add authenticated route group and placeholder home"
```

---

## Post-Module Checklist

- [x] All unit tests pass: `npm run test`
- [x] TypeScript clean: `npx tsc --noEmit`
- [x] Lint clean: `npm run lint`
- [ ] Manual smoke test complete (all 5 flows above)
- [x] Update `CLAUDE.md` build status table: Module 3 → ✅ Done
- [x] Check off Module 3 tasks in `docs/superpowers/plans/2026-09-16-showtime-implementation.md`
