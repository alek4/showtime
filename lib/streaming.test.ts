import { describe, it, expect } from 'vitest'
import { isCacheStale, buildStreamingUrl, getItPlatforms } from './streaming'
import type { StreamingApiResponse } from './streaming'

describe('isCacheStale', () => {
  it('returns true for null cachedAt', () => {
    expect(isCacheStale(null)).toBe(true)
  })

  it('returns true when cache is older than 24 hours', () => {
    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
    expect(isCacheStale(twentyFiveHoursAgo)).toBe(true)
  })

  it('returns false when cache is less than 24 hours old', () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    expect(isCacheStale(oneHourAgo)).toBe(false)
  })

  it('returns false for a cache timestamp set right now', () => {
    expect(isCacheStale(new Date().toISOString())).toBe(false)
  })
})

describe('buildStreamingUrl', () => {
  it('includes the tmdb_id in the URL path', () => {
    const url = buildStreamingUrl(238)
    expect(url).toContain('/shows/movie/238')
  })

  it('always targets Italy (country=it)', () => {
    expect(buildStreamingUrl(238)).toContain('country=it')
  })
})

describe('getItPlatforms', () => {
  it('returns Italy streaming options when present', () => {
    const data: StreamingApiResponse = {
      streamingOptions: {
        it: [
          {
            service: { id: 'netflix', name: 'Netflix', homePage: '', themeColorCode: '', imageSet: {} },
            type: 'subscription',
            link: 'https://netflix.com',
          },
        ],
      },
    }
    const result = getItPlatforms(data)
    expect(result).toHaveLength(1)
    expect(result[0].service.id).toBe('netflix')
  })

  it('returns empty array for null streaming data', () => {
    expect(getItPlatforms(null)).toEqual([])
  })

  it('returns empty array when it key is absent', () => {
    expect(getItPlatforms({ streamingOptions: {} })).toEqual([])
  })

  it('returns empty array when streamingOptions is absent', () => {
    expect(getItPlatforms({})).toEqual([])
  })
})
