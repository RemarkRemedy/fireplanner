/**
 * Tests for the SWR optimizer binary search.
 * Uses nSims=500 for speed (enough for consistent ordering at different confidence levels).
 */
import { describe, it, expect } from 'vitest'
import { optimizeSwr } from './swrOptimizer'
import { CORRELATION_MATRIX, ASSET_CLASSES } from '@/lib/data/historicalReturns'

const BASE_PARAMS = {
  initialPortfolio: 2_000_000,
  allocationWeights: [0.30, 0.10, 0.10, 0.25, 0.10, 0.05, 0.05, 0.05],
  expectedReturns: ASSET_CLASSES.map(a => a.expectedReturn),
  stdDevs: ASSET_CLASSES.map(a => a.stdDev),
  correlationMatrix: CORRELATION_MATRIX,
  currentAge: 55,
  retirementAge: 55,
  lifeExpectancy: 90,
  annualSavings: [] as number[],
  postRetirementIncome: Array(35).fill(0),
  method: 'parametric' as const,
  withdrawalStrategy: 'constant_dollar' as const,
  strategyParams: { swr: 0.04 },
  expenseRatio: 0.003,
  inflation: 0.025,
  withdrawalBasis: 'rate' as const,
}

describe('optimizeSwr', () => {
  it('returns a number', () => {
    const result = optimizeSwr(0.90, BASE_PARAMS, { nSims: 500 })
    expect(typeof result).toBe('number')
  })

  it('result is within search range', () => {
    const result = optimizeSwr(0.90, BASE_PARAMS, { nSims: 500 })
    expect(result).toBeGreaterThanOrEqual(0.02)
    expect(result).toBeLessThanOrEqual(0.08)
  })

  it('higher confidence produces lower SWR', { timeout: 15_000 }, () => {
    const swr95 = optimizeSwr(0.95, BASE_PARAMS, { nSims: 500 })
    const swr85 = optimizeSwr(0.85, BASE_PARAMS, { nSims: 500 })
    expect(swr95).toBeLessThanOrEqual(swr85)
  })

  it('rounds to 3 decimal places', () => {
    const result = optimizeSwr(0.90, BASE_PARAMS, { nSims: 500 })
    expect(result).toBe(parseFloat(result.toFixed(3)))
  })

  it('works with guardrails strategy', () => {
    const result = optimizeSwr(0.90, {
      ...BASE_PARAMS,
      withdrawalStrategy: 'guardrails',
      strategyParams: {
        initialRate: 0.05,
        ceilingTrigger: 1.20,
        floorTrigger: 0.80,
        adjustmentSize: 0.10,
      },
    })
    expect(typeof result).toBe('number')
    expect(result).toBeGreaterThanOrEqual(0.02)
    expect(result).toBeLessThanOrEqual(0.08)
  })

  it('works with floor_ceiling strategy', () => {
    const result = optimizeSwr(0.90, {
      ...BASE_PARAMS,
      withdrawalStrategy: 'floor_ceiling',
      strategyParams: {
        floorAmount: 60_000,
        ceilingAmount: 150_000,
        targetRate: 0.045,
      },
    })
    expect(typeof result).toBe('number')
    expect(result).toBeGreaterThanOrEqual(0.02)
    expect(result).toBeLessThanOrEqual(0.08)
  })

  it('works with cape_based strategy', () => {
    const result = optimizeSwr(0.90, {
      ...BASE_PARAMS,
      withdrawalStrategy: 'cape_based',
      strategyParams: {
        baseRate: 0.04,
        capeWeight: 0.50,
        currentCape: 30,
      },
    })
    expect(typeof result).toBe('number')
    expect(result).toBeGreaterThanOrEqual(0.02)
    expect(result).toBeLessThanOrEqual(0.08)
  })

  it('is deterministic with fixed seed', () => {
    const r1 = optimizeSwr(0.90, BASE_PARAMS, { nSims: 500, seed: 12345 })
    const r2 = optimizeSwr(0.90, BASE_PARAMS, { nSims: 500, seed: 12345 })
    expect(r1).toBe(r2)
  })

  it('accepts custom swrMin / swrMax bounds', () => {
    const result = optimizeSwr(0.90, BASE_PARAMS, {
      nSims: 500,
      swrMin: 0.03,
      swrMax: 0.05,
    })
    expect(result).toBeGreaterThanOrEqual(0.03)
    expect(result).toBeLessThanOrEqual(0.05)
  })

  it('works with vanguard_dynamic strategy', () => {
    const result = optimizeSwr(0.90, {
      ...BASE_PARAMS,
      withdrawalStrategy: 'vanguard_dynamic',
      strategyParams: { swr: 0.04, ceiling: 0.05, floor: 0.025 },
    }, { nSims: 500 })
    expect(typeof result).toBe('number')
    expect(result).toBeGreaterThanOrEqual(0.02)
  })

  it('works with vpw strategy', () => {
    const result = optimizeSwr(0.90, {
      ...BASE_PARAMS,
      withdrawalStrategy: 'vpw',
      strategyParams: { expectedRealReturn: 0.03, targetEndValue: 0 },
    }, { nSims: 500 })
    expect(typeof result).toBe('number')
    expect(result).toBeGreaterThanOrEqual(0.02)
  })

  it('strips annualExpensesAtRetirement so SWR binary search still varies withdrawal', () => {
    // If expenses leak through, every MC iteration uses the fixed expense amount
    // regardless of candidate SWR, and the optimizer can't distinguish rates.
    const withExpenses = optimizeSwr(0.90, {
      ...BASE_PARAMS,
      annualExpensesAtRetirement: 36_000, // 1.8% of $2M — very conservative
    }, { nSims: 500, seed: 12345 })

    const withoutExpenses = optimizeSwr(0.90, BASE_PARAMS, { nSims: 500, seed: 12345 })

    // Both should converge to a valid SWR within the search range
    expect(withExpenses).toBeGreaterThanOrEqual(0.02)
    expect(withExpenses).toBeLessThanOrEqual(0.08)
    // They should produce the same result because the optimizer ignores expenses
    expect(withExpenses).toBe(withoutExpenses)
  })
})
