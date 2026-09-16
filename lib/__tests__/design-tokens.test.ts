import { describe, it, expect } from 'vitest'
import { COLORS, FONTS } from '@/lib/design-tokens'

describe('COLORS', () => {
  it('has the correct void background', () => {
    expect(COLORS.void).toBe('#0A0906')
  })
  it('has the correct surface color', () => {
    expect(COLORS.surface).toBe('#161310')
  })
  it('has the correct raised color', () => {
    expect(COLORS.raised).toBe('#211D19')
  })
  it('has the correct rim (border) color', () => {
    expect(COLORS.rim).toBe('#2E2822')
  })
  it('has the correct primary text color', () => {
    expect(COLORS.primary).toBe('#F0E8DC')
  })
  it('has the correct secondary text color', () => {
    expect(COLORS.secondary).toBe('#8C7E6E')
  })
  it('has the correct ghost text color', () => {
    expect(COLORS.ghost).toBe('#4A3F35')
  })
  it('has the correct amber accent', () => {
    expect(COLORS.amber).toBe('#F5A623')
  })
  it('has the correct amber-dim', () => {
    expect(COLORS.amberDim).toBe('#7A5212')
  })
  it('has the correct crimson (watched)', () => {
    expect(COLORS.crimson).toBe('#C0392B')
  })
  it('has the correct crimson-dim', () => {
    expect(COLORS.crimsonDim).toBe('#5C1A13')
  })
})

describe('FONTS', () => {
  it('has the display font variable', () => {
    expect(FONTS.display).toBe('var(--font-bebas)')
  })
  it('has the body font variable', () => {
    expect(FONTS.body).toBe('var(--font-outfit)')
  })
  it('has the accent font variable', () => {
    expect(FONTS.accent).toBe('var(--font-dm-serif)')
  })
})
