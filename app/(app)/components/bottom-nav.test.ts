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

  it('does not match an unrelated route', () => {
    expect(isActiveRoute('/discover', '/stats')).toBe(false)
    expect(isActiveRoute('/stats', '/stats')).toBe(true)
  })
})
