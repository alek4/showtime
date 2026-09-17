import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { computeRuntimeTotal, computeGenreBreakdown, computeMonthlyTimeline, getWatchStats } from './stats'

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

describe('getWatchStats', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns correct totals, runtime, genre breakdown, and monthly timeline', async () => {
    const mockTitles = [
      { genres: ['Drama', 'Crime'], runtime_minutes: 175, watched: true, watched_at: '2026-01-15T10:00:00Z' },
      { genres: ['Drama'], runtime_minutes: 120, watched: true, watched_at: '2026-02-10T10:00:00Z' },
      { genres: ['Comedy'], runtime_minutes: null, watched: true, watched_at: '2026-02-20T10:00:00Z' },
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
