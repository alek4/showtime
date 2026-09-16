import { describe, it, expect } from 'vitest'
import { isCacheStale, buildStreamingUrl } from './streaming'

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
  it('includes the tmdb_id in movie/{id} format', () => {
    const url = buildStreamingUrl(238)
    expect(url).toContain('movie%2F238')
  })

  it('always targets Italy (country=it)', () => {
    expect(buildStreamingUrl(238)).toContain('country=it')
  })
})
