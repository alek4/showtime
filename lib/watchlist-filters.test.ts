import { describe, it, expect } from 'vitest'
import { applyFilters, deriveFilterOptions, DEFAULT_FILTERS } from './watchlist-filters'
import type { Title } from '@/lib/types'
import type { StreamingApiResponse } from '@/lib/streaming'

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
    added_by: 'user-a',
    added_at: '2024-01-01T00:00:00Z',
    streaming_data: null,
    streaming_cached_at: null,
    removed_at: null,
    ...overrides,
  }
}

const USER_A = 'user-a'
const USER_B = 'user-b'

describe('applyFilters', () => {
  it('returns all titles when default filters applied', () => {
    const titles = [makeTitle({ watched: false }), makeTitle({ id: 'id-2', watched: true })]
    expect(applyFilters(titles, DEFAULT_FILTERS, USER_A)).toHaveLength(2)
  })

  it('filters to only unwatched titles when status is unwatched', () => {
    const titles = [
      makeTitle({ id: 't1', watched: false }),
      makeTitle({ id: 't2', watched: true }),
    ]
    const result = applyFilters(titles, { ...DEFAULT_FILTERS, status: 'unwatched' }, USER_A)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('t1')
  })

  it('filters to only watched titles when status is watched', () => {
    const titles = [
      makeTitle({ id: 't1', watched: false }),
      makeTitle({ id: 't2', watched: true }),
    ]
    const result = applyFilters(titles, { ...DEFAULT_FILTERS, status: 'watched' }, USER_A)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('t2')
  })

  it('filters by a single genre (title must include all selected genres)', () => {
    const titles = [
      makeTitle({ id: 't1', genres: ['Drama', 'Crime'] }),
      makeTitle({ id: 't2', genres: ['Comedy'] }),
    ]
    const result = applyFilters(titles, { ...DEFAULT_FILTERS, genres: ['Drama'] }, USER_A)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('t1')
  })

  it('filters by multiple genres (title must include ALL selected genres)', () => {
    const titles = [
      makeTitle({ id: 't1', genres: ['Drama', 'Crime'] }),
      makeTitle({ id: 't2', genres: ['Drama'] }),
    ]
    const result = applyFilters(titles, { ...DEFAULT_FILTERS, genres: ['Drama', 'Crime'] }, USER_A)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('t1')
  })

  it('filters by platform — only titles with that service in Italy streaming options', () => {
    const netflixData: StreamingApiResponse = {
      streamingOptions: {
        it: [
          {
            service: { id: 'netflix', name: 'Netflix', homePage: '', themeColorCode: '', imageSet: {} },
            type: 'subscription',
            link: '',
          },
        ],
      },
    }
    const titles = [
      makeTitle({ id: 't1', streaming_data: netflixData }),
      makeTitle({ id: 't2', streaming_data: null }),
    ]
    const result = applyFilters(titles, { ...DEFAULT_FILTERS, platform: 'netflix' }, USER_A)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('t1')
  })

  it('filters by addedBy me — only titles added by currentUserId', () => {
    const titles = [
      makeTitle({ id: 't1', added_by: USER_A }),
      makeTitle({ id: 't2', added_by: USER_B }),
    ]
    const result = applyFilters(titles, { ...DEFAULT_FILTERS, addedBy: 'me' }, USER_A)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('t1')
  })

  it('filters by addedBy partner — only titles NOT added by currentUserId', () => {
    const titles = [
      makeTitle({ id: 't1', added_by: USER_A }),
      makeTitle({ id: 't2', added_by: USER_B }),
    ]
    const result = applyFilters(titles, { ...DEFAULT_FILTERS, addedBy: 'partner' }, USER_A)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('t2')
  })

  it('combines multiple filters (status + genre)', () => {
    const titles = [
      makeTitle({ id: 't1', watched: false, genres: ['Drama'] }),
      makeTitle({ id: 't2', watched: true, genres: ['Drama'] }),
      makeTitle({ id: 't3', watched: false, genres: ['Comedy'] }),
    ]
    const result = applyFilters(
      titles,
      { ...DEFAULT_FILTERS, status: 'unwatched', genres: ['Drama'] },
      USER_A,
    )
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('t1')
  })
})

describe('deriveFilterOptions', () => {
  it('returns all unique genres sorted alphabetically', () => {
    const titles = [
      makeTitle({ genres: ['Drama', 'Crime'] }),
      makeTitle({ genres: ['Comedy', 'Drama'] }),
    ]
    const { allGenres } = deriveFilterOptions(titles)
    expect(allGenres).toEqual(['Comedy', 'Crime', 'Drama'])
  })

  it('returns unique platforms across all titles Italy streaming data', () => {
    const netflixData: StreamingApiResponse = {
      streamingOptions: {
        it: [
          { service: { id: 'netflix', name: 'Netflix', homePage: '', themeColorCode: '', imageSet: {} }, type: 'subscription', link: '' },
        ],
      },
    }
    const primeData: StreamingApiResponse = {
      streamingOptions: {
        it: [
          { service: { id: 'prime', name: 'Prime Video', homePage: '', themeColorCode: '', imageSet: {} }, type: 'subscription', link: '' },
        ],
      },
    }
    const titles = [
      makeTitle({ streaming_data: netflixData }),
      makeTitle({ streaming_data: primeData }),
      makeTitle({ streaming_data: null }),
    ]
    const { allPlatforms } = deriveFilterOptions(titles)
    expect(allPlatforms.map(p => p.id)).toEqual(expect.arrayContaining(['netflix', 'prime']))
    expect(allPlatforms).toHaveLength(2)
  })

  it('returns empty arrays when titles list is empty', () => {
    const { allGenres, allPlatforms } = deriveFilterOptions([])
    expect(allGenres).toEqual([])
    expect(allPlatforms).toEqual([])
  })
})
