import { describe, expect, it } from 'vitest'
import {
  getSurvivorMultiplier,
  type SurvivorContext,
} from '@/lib/calculations/survivorSpending'

function makeSurvivorContext(overrides?: Partial<SurvivorContext>): SurvivorContext {
  return {
    adultLifeExpectancyYearOffsets: [50, 54], // self dies at yearOffset 50, partner at 54
    survivorExpenseRatio: 0.75,
    ...overrides,
  }
}

describe('getSurvivorMultiplier', () => {
  it('returns 1 when both adults are alive', () => {
    const ctx = makeSurvivorContext()
    expect(getSurvivorMultiplier(ctx, 'shared', 30)).toBe(1)
  })

  it('returns survivorExpenseRatio when one adult has died', () => {
    const ctx = makeSurvivorContext()
    // yearOffset 51: self dead (lifeExpectancy offset 50), partner alive (54)
    expect(getSurvivorMultiplier(ctx, 'shared', 51)).toBe(0.75)
  })

  it('returns survivorExpenseRatio when the other adult has died', () => {
    const ctx = makeSurvivorContext({
      adultLifeExpectancyYearOffsets: [60, 45],
    })
    // yearOffset 46: partner dead (45), self alive (60)
    expect(getSurvivorMultiplier(ctx, 'shared', 46)).toBe(0.75)
  })

  it('returns survivorExpenseRatio when both adults are dead', () => {
    const ctx = makeSurvivorContext()
    // yearOffset 55: both dead (50, 54)
    // In practice this shouldn't happen because the timing window ends,
    // but the function should still return the ratio
    expect(getSurvivorMultiplier(ctx, 'shared', 55)).toBe(0.75)
  })

  it('returns 1 for non-shared expenses even after a death', () => {
    const ctx = makeSurvivorContext()
    expect(getSurvivorMultiplier(ctx, 'self', 51)).toBe(1)
    expect(getSurvivorMultiplier(ctx, 'partner', 51)).toBe(1)
  })

  it('returns 1 for shared expense at exact death year (still alive that year)', () => {
    const ctx = makeSurvivorContext()
    // yearOffset 50 is the lifeExpectancy offset — adult is still alive at this offset
    expect(getSurvivorMultiplier(ctx, 'shared', 50)).toBe(1)
  })

  it('returns 1 when there is only one adult', () => {
    const ctx = makeSurvivorContext({
      adultLifeExpectancyYearOffsets: [50],
    })
    expect(getSurvivorMultiplier(ctx, 'shared', 30)).toBe(1)
    expect(getSurvivorMultiplier(ctx, 'shared', 51)).toBe(1)
  })

  it('returns 1 when survivorExpenseRatio is undefined (defaults to 1)', () => {
    const ctx = makeSurvivorContext({
      survivorExpenseRatio: undefined,
    })
    expect(getSurvivorMultiplier(ctx, 'shared', 51)).toBe(1)
  })

  it('handles custom survivorExpenseRatio', () => {
    const ctx = makeSurvivorContext({
      survivorExpenseRatio: 0.6,
    })
    expect(getSurvivorMultiplier(ctx, 'shared', 51)).toBe(0.6)
  })
})
