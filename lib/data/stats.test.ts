import { describe, it, expect, vi, afterEach } from 'vitest'
import { computeRuntimeTotal } from './stats'

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
