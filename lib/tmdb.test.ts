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
