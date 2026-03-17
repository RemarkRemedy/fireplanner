import { describe, it, expect } from 'vitest'
import type { ExpenseAdjustment } from '@/lib/types'
import { getEffectiveExpenses, computeExpensePhases, computeWeightedRetirementRatio } from './expenses'

describe('getEffectiveExpenses', () => {
  const base = 48000

  it('returns base when no adjustments', () => {
    expect(getEffectiveExpenses(30, base, [], 90)).toBe(48000)
  })

  it('adds active adjustment at startAge', () => {
    const adj: ExpenseAdjustment[] = [
      { id: '1', label: 'Rent', amount: 12000, startAge: 28, endAge: 60 },
    ]
    expect(getEffectiveExpenses(28, base, adj, 90)).toBe(60000)
  })

  it('excludes adjustment at endAge (exclusive upper bound)', () => {
    const adj: ExpenseAdjustment[] = [
      { id: '1', label: 'Rent', amount: 12000, startAge: 28, endAge: 60 },
    ]
    // Active at 59, not at 60
    expect(getEffectiveExpenses(59, base, adj, 90)).toBe(60000)
    expect(getEffectiveExpenses(60, base, adj, 90)).toBe(48000)
  })

  it('excludes adjustment before startAge', () => {
    const adj: ExpenseAdjustment[] = [
      { id: '1', label: 'Rent', amount: 12000, startAge: 35, endAge: 60 },
    ]
    expect(getEffectiveExpenses(34, base, adj, 90)).toBe(48000)
  })

  it('sums overlapping adjustments', () => {
    const adj: ExpenseAdjustment[] = [
      { id: '1', label: 'Rent', amount: 12000, startAge: 25, endAge: 60 },
      { id: '2', label: 'Kid school', amount: 6000, startAge: 30, endAge: 48 },
    ]
    // At age 35: both active → 48000 + 12000 + 6000
    expect(getEffectiveExpenses(35, base, adj, 90)).toBe(66000)
  })

  it('handles negative adjustments (reduced spending)', () => {
    const adj: ExpenseAdjustment[] = [
      { id: '1', label: 'Live with parents', amount: -20000, startAge: 25, endAge: 30 },
    ]
    expect(getEffectiveExpenses(27, base, adj, 90)).toBe(28000)
  })

  it('floors at zero when negative adjustments exceed base', () => {
    const adj: ExpenseAdjustment[] = [
      { id: '1', label: 'Huge discount', amount: -60000, startAge: 25, endAge: 30 },
    ]
    expect(getEffectiveExpenses(27, base, adj, 90)).toBe(0)
  })

  it('resolves null endAge to lifeExpectancy', () => {
    const adj: ExpenseAdjustment[] = [
      { id: '1', label: 'Ongoing cost', amount: 5000, startAge: 40, endAge: null },
    ]
    // Active at 85 (before lifeExpectancy 90)
    expect(getEffectiveExpenses(85, base, adj, 90)).toBe(53000)
    // Not active at 90 (endAge is exclusive)
    expect(getEffectiveExpenses(90, base, adj, 90)).toBe(48000)
  })

  it('resolves null endAge with different lifeExpectancy', () => {
    const adj: ExpenseAdjustment[] = [
      { id: '1', label: 'Ongoing', amount: 5000, startAge: 40, endAge: null },
    ]
    // lifeExpectancy = 80, so active at 79 but not 80
    expect(getEffectiveExpenses(79, base, adj, 80)).toBe(53000)
    expect(getEffectiveExpenses(80, base, adj, 80)).toBe(48000)
  })
})

describe('computeExpensePhases', () => {
  const base = 48000

  it('returns single phase when no adjustments', () => {
    const phases = computeExpensePhases(base, [], 30, 90, 90)
    expect(phases).toEqual([
      { fromAge: 30, toAge: 90, amount: 48000 },
    ])
  })

  it('splits into phases at adjustment boundaries', () => {
    const adj: ExpenseAdjustment[] = [
      { id: '1', label: 'Rent', amount: 12000, startAge: 35, endAge: 60 },
    ]
    const phases = computeExpensePhases(base, adj, 30, 90, 90)
    expect(phases).toEqual([
      { fromAge: 30, toAge: 35, amount: 48000 },
      { fromAge: 35, toAge: 60, amount: 60000 },
      { fromAge: 60, toAge: 90, amount: 48000 },
    ])
  })

  it('handles overlapping adjustments with multiple transition points', () => {
    const adj: ExpenseAdjustment[] = [
      { id: '1', label: 'Rent', amount: 12000, startAge: 28, endAge: 60 },
      { id: '2', label: 'Kid school', amount: 6000, startAge: 35, endAge: 48 },
    ]
    const phases = computeExpensePhases(base, adj, 25, 90, 90)
    expect(phases).toEqual([
      { fromAge: 25, toAge: 28, amount: 48000 },
      { fromAge: 28, toAge: 35, amount: 60000 },
      { fromAge: 35, toAge: 48, amount: 66000 },
      { fromAge: 48, toAge: 60, amount: 60000 },
      { fromAge: 60, toAge: 90, amount: 48000 },
    ])
  })

  it('resolves null endAge to lifeExpectancy for phase computation', () => {
    const adj: ExpenseAdjustment[] = [
      { id: '1', label: 'Ongoing', amount: 5000, startAge: 40, endAge: null },
    ]
    const phases = computeExpensePhases(base, adj, 30, 90, 90)
    expect(phases).toEqual([
      { fromAge: 30, toAge: 40, amount: 48000 },
      { fromAge: 40, toAge: 90, amount: 53000 },
    ])
  })

  it('omits phases outside the requested range', () => {
    const adj: ExpenseAdjustment[] = [
      { id: '1', label: 'Early', amount: 5000, startAge: 20, endAge: 25 },
    ]
    // Range starts at 30, so the 20-25 adjustment is irrelevant
    const phases = computeExpensePhases(base, adj, 30, 90, 90)
    expect(phases).toEqual([
      { fromAge: 30, toAge: 90, amount: 48000 },
    ])
  })

  it('clips adjustment boundaries to requested range', () => {
    const adj: ExpenseAdjustment[] = [
      { id: '1', label: 'Long', amount: 10000, startAge: 25, endAge: 95 },
    ]
    // Range is 30-90, adjustment extends beyond both sides
    const phases = computeExpensePhases(base, adj, 30, 90, 90)
    expect(phases).toEqual([
      { fromAge: 30, toAge: 90, amount: 58000 },
    ])
  })

  it('merges consecutive phases with same delta into one phase', () => {
    // Two contiguous adjustments with the same amount: ages 30-40 (+10K), ages 40-50 (+10K)
    // Both produce the same effective amount (48000 + 10000 = 58000), so they should merge
    const adj: ExpenseAdjustment[] = [
      { id: '1', label: 'Cost A', amount: 10000, startAge: 30, endAge: 40 },
      { id: '2', label: 'Cost B', amount: 10000, startAge: 40, endAge: 50 },
    ]
    const phases = computeExpensePhases(base, adj, 25, 60, 90)
    // Expected: 25-30 = 48K, 30-50 = 58K (merged), 50-60 = 48K
    expect(phases).toEqual([
      { fromAge: 25, toAge: 30, amount: 48000 },
      { fromAge: 30, toAge: 50, amount: 58000 },
      { fromAge: 50, toAge: 60, amount: 48000 },
    ])
  })

  it('does NOT merge consecutive phases with different amounts', () => {
    // Two contiguous adjustments with different amounts
    const adj: ExpenseAdjustment[] = [
      { id: '1', label: 'Low', amount: 10000, startAge: 30, endAge: 40 },
      { id: '2', label: 'High', amount: 20000, startAge: 40, endAge: 50 },
    ]
    const phases = computeExpensePhases(base, adj, 25, 60, 90)
    // Expected: 4 phases (no merging because amounts differ)
    expect(phases).toEqual([
      { fromAge: 25, toAge: 30, amount: 48000 },
      { fromAge: 30, toAge: 40, amount: 58000 },
      { fromAge: 40, toAge: 50, amount: 68000 },
      { fromAge: 50, toAge: 60, amount: 48000 },
    ])
  })

  it('handles negative adjustment floor at zero in phases', () => {
    const adj: ExpenseAdjustment[] = [
      { id: '1', label: 'Huge discount', amount: -60000, startAge: 30, endAge: 40 },
    ]
    const phases = computeExpensePhases(base, adj, 25, 50, 90)
    expect(phases).toEqual([
      { fromAge: 25, toAge: 30, amount: 48000 },
      { fromAge: 30, toAge: 40, amount: 0 },
      { fromAge: 40, toAge: 50, amount: 48000 },
    ])
  })
})

describe('computeWeightedRetirementRatio', () => {
  it('returns 1.0 when all categories are zero', () => {
    expect(computeWeightedRetirementRatio({ food: 0, transport: 0 }, { food: 0.8 })).toBe(1.0)
  })
  it('returns 1.0 when breakdown is empty', () => {
    expect(computeWeightedRetirementRatio({}, {})).toBe(1.0)
  })
  it('returns the multiplier for a single category', () => {
    expect(computeWeightedRetirementRatio({ food: 500 }, { food: 0.85 })).toBeCloseTo(0.85)
  })
  it('returns uniform multiplier when all categories have the same multiplier', () => {
    expect(computeWeightedRetirementRatio({ food: 500, transport: 300, travel: 200 }, { food: 0.7, transport: 0.7, travel: 0.7 })).toBeCloseTo(0.7)
  })
  it('computes weighted average across categories', () => {
    // food: 600 (60%), transport: 400 (40%), multipliers: 1.0 and 0.5 → 0.8
    expect(computeWeightedRetirementRatio({ food: 600, transport: 400 }, { food: 1.0, transport: 0.5 })).toBeCloseTo(0.8)
  })
  it('defaults to 1.0 for categories with no multiplier', () => {
    expect(computeWeightedRetirementRatio({ food: 500 }, {})).toBeCloseTo(1.0)
  })
  it('ignores negative amounts', () => {
    expect(computeWeightedRetirementRatio({ food: 500, transport: -100 }, { food: 0.85, transport: 0.5 })).toBeCloseTo(0.85)
  })
  it('clamps multipliers above 5.0', () => {
    expect(computeWeightedRetirementRatio({ food: 500 }, { food: 10 })).toBeCloseTo(5.0)
  })
  it('clamps multipliers below 0', () => {
    expect(computeWeightedRetirementRatio({ food: 500 }, { food: -2 })).toBeCloseTo(0)
  })
  it('returns 1.0 for backward-compat (empty breakdown from legacy data)', () => {
    expect(computeWeightedRetirementRatio({}, { food: 0.8 })).toBe(1.0)
  })
})
