import { describe, it, expect } from 'vitest'
import {
  calculateItemFireNumber,
  calculateBlendedFireNumber,
  calculateBlendedSwr,
} from './expenseSwr'
import type { RetirementExpenseItem } from '@/lib/types'

function makeItem(overrides: Partial<RetirementExpenseItem> = {}): RetirementExpenseItem {
  return {
    id: 'test-1',
    label: 'Test Expense',
    annualAmount: 24000,
    flexibility: 'essential',
    swr: 0.04,
    ...overrides,
  }
}

describe('calculateItemFireNumber', () => {
  it('computes perpetuity for lifetime items (no endAge)', () => {
    // FIRE number = annualAmount / swr = 24000 / 0.04 = 600000
    const result = calculateItemFireNumber(makeItem(), 65, 90, 0.04)
    expect(result).toBeCloseTo(600000, 0)
  })

  it('returns 0 when swr is 0', () => {
    const result = calculateItemFireNumber(makeItem({ swr: 0 }), 65, 90, 0.04)
    expect(result).toBe(0)
  })

  it('returns 0 when annualAmount is 0', () => {
    const result = calculateItemFireNumber(makeItem({ annualAmount: 0 }), 65, 90, 0.04)
    expect(result).toBe(0)
  })

  it('computes PV of annuity for fixed-term items (endAge set)', () => {
    // Fixed-term item: endAge = 75, retirementAge = 65 => 10 years
    // netRealReturn = 0.04
    // PV annuity = amount * (1 - (1+r)^-n) / r
    // = 24000 * (1 - 1.04^-10) / 0.04
    const item = makeItem({ endAge: 75 })
    const result = calculateItemFireNumber(item, 65, 90, 0.04)
    const expected = 24000 * (1 - Math.pow(1.04, -10)) / 0.04
    expect(result).toBeCloseTo(expected, 0)
  })

  it('uses perpetuity when endAge >= lifeExpectancy', () => {
    const item = makeItem({ endAge: 95 })
    const result = calculateItemFireNumber(item, 65, 90, 0.04)
    // endAge (95) >= lifeExpectancy (90), so use perpetuity
    expect(result).toBeCloseTo(24000 / 0.04, 0)
  })

  it('uses perpetuity when endAge equals lifeExpectancy', () => {
    const item = makeItem({ endAge: 90 })
    const result = calculateItemFireNumber(item, 65, 90, 0.04)
    expect(result).toBeCloseTo(24000 / 0.04, 0)
  })

  it('handles endAge <= retirementAge (0-year term)', () => {
    const item = makeItem({ endAge: 60 })
    const result = calculateItemFireNumber(item, 65, 90, 0.04)
    expect(result).toBe(0)
  })

  it('handles netRealReturn of 0 for fixed-term items', () => {
    // When r = 0, PV annuity = amount * n
    const item = makeItem({ endAge: 75 })
    const result = calculateItemFireNumber(item, 65, 90, 0)
    expect(result).toBeCloseTo(24000 * 10, 0)
  })

  it('handles negative netRealReturn for perpetuity', () => {
    // Negative real return: swr 0.04, but we use the item's own swr for perpetuity
    const result = calculateItemFireNumber(makeItem(), 65, 90, -0.01)
    // Perpetuity uses item.swr, not netRealReturn
    expect(result).toBeCloseTo(24000 / 0.04, 0)
  })
})

describe('calculateBlendedFireNumber', () => {
  it('returns 0 for empty items array', () => {
    expect(calculateBlendedFireNumber([], 65, 90, 0.04)).toBe(0)
  })

  it('sums individual FIRE numbers', () => {
    const items = [
      makeItem({ id: '1', annualAmount: 24000, swr: 0.04 }), // 600000
      makeItem({ id: '2', annualAmount: 12000, swr: 0.03 }), // 400000
    ]
    const result = calculateBlendedFireNumber(items, 65, 90, 0.04)
    expect(result).toBeCloseTo(1000000, 0)
  })

  it('mixes perpetuity and fixed-term items', () => {
    const items = [
      makeItem({ id: '1', annualAmount: 24000, swr: 0.04 }),           // perpetuity: 600000
      makeItem({ id: '2', annualAmount: 12000, swr: 0.04, endAge: 75 }), // fixed-term: PV annuity
    ]
    const fixedTermFire = 12000 * (1 - Math.pow(1.04, -10)) / 0.04
    const result = calculateBlendedFireNumber(items, 65, 90, 0.04)
    expect(result).toBeCloseTo(600000 + fixedTermFire, 0)
  })
})

describe('calculateBlendedSwr', () => {
  it('returns 0 when blended FIRE number is 0', () => {
    expect(calculateBlendedSwr([], 65, 90, 0.04)).toBe(0)
  })

  it('computes blended SWR as totalExpenses / blendedFireNumber', () => {
    const items = [
      makeItem({ id: '1', annualAmount: 24000, swr: 0.04 }), // 600000
      makeItem({ id: '2', annualAmount: 12000, swr: 0.03 }), // 400000
    ]
    // total expenses = 36000, blended fire = 1000000
    // blended SWR = 36000 / 1000000 = 0.036
    const result = calculateBlendedSwr(items, 65, 90, 0.04)
    expect(result).toBeCloseTo(0.036, 6)
  })

  it('equals the single SWR when all items share the same SWR', () => {
    const items = [
      makeItem({ id: '1', annualAmount: 24000, swr: 0.04 }),
      makeItem({ id: '2', annualAmount: 12000, swr: 0.04 }),
    ]
    const result = calculateBlendedSwr(items, 65, 90, 0.04)
    expect(result).toBeCloseTo(0.04, 6)
  })
})
