import { describe, it, expect, vi, afterEach } from 'vitest'
import { buildLetterboxdUrl } from './titles'

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
