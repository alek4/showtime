import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { buildLetterboxdUrl, getTitles, getTitleById, addTitle } from './titles'

describe('buildLetterboxdUrl', () => {
  it('encodes spaces as + between words', () => {
    expect(buildLetterboxdUrl('The Godfather', 1972))
      .toBe('https://letterboxd.com/search/films/The+Godfather+1972')
  })

  it('appends year separated by a +', () => {
    const url = buildLetterboxdUrl('Parasite', 2019)
    expect(url).toContain('Parasite+2019')
  })

  it('encodes special characters', () => {
    const url = buildLetterboxdUrl("Schindler's List", 1993)
    expect(url).toContain('Schindler')
    expect(url).toContain('1993')
  })
})

describe('getTitles', () => {
  afterEach(() => vi.clearAllMocks())

  it('filters removed_at IS NULL — never returns soft-deleted titles', async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null })
    const is = vi.fn().mockReturnValue({ order })
    const select = vi.fn().mockReturnValue({ is })
    const from = vi.fn().mockReturnValue({ select })
    vi.mocked(createClient).mockResolvedValue({ from } as never)

    await getTitles()

    expect(is).toHaveBeenCalledWith('removed_at', null)
  })

  it('returns the titles array from Supabase', async () => {
    const fakeTitles = [{ id: 'abc', title: 'The Godfather' }]
    const order = vi.fn().mockResolvedValue({ data: fakeTitles, error: null })
    const is = vi.fn().mockReturnValue({ order })
    const select = vi.fn().mockReturnValue({ is })
    const from = vi.fn().mockReturnValue({ select })
    vi.mocked(createClient).mockResolvedValue({ from } as never)

    const result = await getTitles()

    expect(result).toEqual(fakeTitles)
  })
})

describe('getTitleById', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns the title when found', async () => {
    const fakeTitle = { id: 'abc', title: 'The Godfather', removed_at: null }
    const single = vi.fn().mockResolvedValue({ data: fakeTitle, error: null })
    const is = vi.fn().mockReturnValue({ single })
    const eq = vi.fn().mockReturnValue({ is })
    const select = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ select })
    vi.mocked(createClient).mockResolvedValue({ from } as never)

    const result = await getTitleById('abc')

    expect(result).toEqual(fakeTitle)
  })

  it('returns null when Supabase returns PGRST116 (no rows)', async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'No rows found' },
    })
    const is = vi.fn().mockReturnValue({ single })
    const eq = vi.fn().mockReturnValue({ is })
    const select = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ select })
    vi.mocked(createClient).mockResolvedValue({ from } as never)

    const result = await getTitleById('non-existent')

    expect(result).toBeNull()
  })
})

describe('addTitle', () => {
  afterEach(() => vi.clearAllMocks())

  it('inserts the title with watched: false and returns the saved row', async () => {
    const input = {
      tmdb_id: 238,
      title: 'The Godfather',
      year: 1972,
      poster_url: '/poster.jpg',
      runtime_minutes: 175,
      genres: ['Drama', 'Crime'],
      overview: 'The aging patriarch...',
      letterboxd_search_url: 'https://letterboxd.com/search/films/The+Godfather+1972',
      added_by: 'user-uuid-123',
    }
    const savedTitle = { ...input, id: 'new-uuid', watched: false, added_at: '2026-09-17T10:00:00Z' }

    const single = vi.fn().mockResolvedValue({ data: savedTitle, error: null })
    const selectAfterInsert = vi.fn().mockReturnValue({ single })
    const insert = vi.fn().mockReturnValue({ select: selectAfterInsert })
    const from = vi.fn().mockReturnValue({ insert })
    vi.mocked(createClient).mockResolvedValue({ from } as never)

    const result = await addTitle(input)

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ watched: false }))
    expect(result).toEqual(savedTitle)
  })
})
