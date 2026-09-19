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
