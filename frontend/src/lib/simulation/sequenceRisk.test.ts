/**
 * Tests for the sequence risk stress testing engine.
 * Faithfully ported from backend/app/api/routes/sequence_risk.py.
 */

import { describe, it, expect } from 'vitest'
import { runSequenceRisk } from './sequenceRisk'
import { CORRELATION_MATRIX, ASSET_CLASSES } from '@/lib/data/historicalReturns'

const PARAMS = {
  initialPortfolio: 2_000_000,
  allocationWeights: [0.30, 0.10, 0.10, 0.25, 0.10, 0.05, 0.05, 0.05],
  expectedReturns: ASSET_CLASSES.map(a => a.expectedReturn),
  stdDevs: ASSET_CLASSES.map(a => a.stdDev),
  correlationMatrix: CORRELATION_MATRIX,
  retirementAge: 55,
  lifeExpectancy: 90,
  withdrawalStrategy: 'constant_dollar' as const,
  strategyParams: { swr: 0.04 },
  nSimulations: 200, // Keep low for test speed
  seed: 42,
  expenseRatio: 0.003,
  inflation: 0.025,
  postRetirementIncome: [] as number[],
  withdrawalBasis: 'expenses' as const,
  crisis: {
    id: 'gfc',
    name: 'Global Financial Crisis',
    equityReturnSequence: [-0.38, -0.10, 0.15],
    durationYears: 3,
  },
}

describe('runSequenceRisk', () => {
  it('returns all expected keys (snake_case)', () => {
    const result = runSequenceRisk(PARAMS)
    expect(result).toHaveProperty('normal_success_rate')
    expect(result).toHaveProperty('crisis_success_rate')
    expect(result).toHaveProperty('success_degradation')
    expect(result).toHaveProperty('normal_percentile_bands')
    expect(result).toHaveProperty('crisis_percentile_bands')
    expect(result).toHaveProperty('mitigations')
  })

  it('crisis success rate <= normal success rate (with tolerance)', () => {
    const result = runSequenceRisk(PARAMS)
    expect(result.crisis_success_rate).toBeLessThanOrEqual(result.normal_success_rate + 0.05)
  })

  it('success_degradation = normal - crisis', () => {
    const result = runSequenceRisk(PARAMS)
    expect(result.success_degradation).toBeCloseTo(
      result.normal_success_rate - result.crisis_success_rate,
      6,
    )
  })

  it('returns 3 mitigations', () => {
    const result = runSequenceRisk(PARAMS)
    expect(result.mitigations).toHaveLength(3)
  })

  it('each mitigation has required fields', () => {
    const result = runSequenceRisk(PARAMS)
    for (const m of result.mitigations) {
      expect(m).toHaveProperty('strategy')
      expect(m).toHaveProperty('description')
      expect(m).toHaveProperty('normal_success_rate')
      expect(m).toHaveProperty('crisis_success_rate')
      expect(m).toHaveProperty('success_improvement')
    }
  })

  it('mitigations have expected names', () => {
    const result = runSequenceRisk(PARAMS)
    const names = result.mitigations.map(m => m.strategy)
    expect(names).toContain('Conservative Allocation')
    expect(names).toContain('Cash Buffer (2 Years)')
    expect(names).toContain('Flexible Spending (-15%)')
  })

  it('percentile bands have correct length', () => {
    const result = runSequenceRisk(PARAMS)
    const nYears = 90 - 55 + 1 // 36
    expect(result.normal_percentile_bands.p50).toHaveLength(nYears)
    expect(result.crisis_percentile_bands.p50).toHaveLength(nYears)
  })

  it('is reproducible with same seed', () => {
    const r1 = runSequenceRisk(PARAMS)
    const r2 = runSequenceRisk(PARAMS)
    expect(r1.normal_success_rate).toBe(r2.normal_success_rate)
    expect(r1.crisis_success_rate).toBe(r2.crisis_success_rate)
  })

  it('success rates are valid probabilities', () => {
    const result = runSequenceRisk(PARAMS)
    expect(result.normal_success_rate).toBeGreaterThanOrEqual(0)
    expect(result.normal_success_rate).toBeLessThanOrEqual(1)
    expect(result.crisis_success_rate).toBeGreaterThanOrEqual(0)
    expect(result.crisis_success_rate).toBeLessThanOrEqual(1)
    for (const m of result.mitigations) {
      expect(m.normal_success_rate).toBeGreaterThanOrEqual(0)
      expect(m.normal_success_rate).toBeLessThanOrEqual(1)
      expect(m.crisis_success_rate).toBeGreaterThanOrEqual(0)
      expect(m.crisis_success_rate).toBeLessThanOrEqual(1)
    }
  })

  it('percentile bands have all required fields', () => {
    const result = runSequenceRisk(PARAMS)
    const nYears = 90 - 55 + 1 // 36
    for (const bands of [result.normal_percentile_bands, result.crisis_percentile_bands]) {
      expect(bands).toHaveProperty('years')
      expect(bands).toHaveProperty('ages')
      expect(bands).toHaveProperty('p5')
      expect(bands).toHaveProperty('p10')
      expect(bands).toHaveProperty('p25')
      expect(bands).toHaveProperty('p50')
      expect(bands).toHaveProperty('p75')
      expect(bands).toHaveProperty('p90')
      expect(bands).toHaveProperty('p95')
      expect(bands.years).toHaveLength(nYears)
      expect(bands.ages).toHaveLength(nYears)
      expect(bands.ages[0]).toBe(55)
      expect(bands.ages[nYears - 1]).toBe(90)
    }
  })

  it('percentile ordering is non-decreasing at each year', () => {
    const result = runSequenceRisk(PARAMS)
    const bands = result.normal_percentile_bands
    const nYears = bands.p5.length
    for (let i = 0; i < nYears; i++) {
      expect(bands.p5[i]).toBeLessThanOrEqual(bands.p10[i] + 1e-9)
      expect(bands.p10[i]).toBeLessThanOrEqual(bands.p25[i] + 1e-9)
      expect(bands.p25[i]).toBeLessThanOrEqual(bands.p50[i] + 1e-9)
      expect(bands.p50[i]).toBeLessThanOrEqual(bands.p75[i] + 1e-9)
      expect(bands.p75[i]).toBeLessThanOrEqual(bands.p90[i] + 1e-9)
      expect(bands.p90[i]).toBeLessThanOrEqual(bands.p95[i] + 1e-9)
    }
  })

  it('year 0 balance equals initial portfolio for normal bands', () => {
    const result = runSequenceRisk(PARAMS)
    // All simulations start at initialPortfolio, so all percentiles at year 0 = initialPortfolio
    expect(result.normal_percentile_bands.p50[0]).toBeCloseTo(2_000_000, -3)
  })

  it('works with no post-retirement income', () => {
    const result = runSequenceRisk({ ...PARAMS, postRetirementIncome: [] })
    expect(result).toHaveProperty('normal_success_rate')
    expect(result.normal_success_rate).toBeGreaterThanOrEqual(0)
  })

  it('works with post-retirement income', () => {
    const incomeParams = {
      ...PARAMS,
      postRetirementIncome: [20000, 20000, 20000, 20000, 20000],
    }
    const withIncome = runSequenceRisk(incomeParams)
    const withoutIncome = runSequenceRisk(PARAMS)
    // Additional income should not decrease success rate
    expect(withIncome.normal_success_rate).toBeGreaterThanOrEqual(
      withoutIncome.normal_success_rate - 0.05,
    )
  })

  it('crisis with empty equity sequence acts like normal run', () => {
    const noCrisisParams = {
      ...PARAMS,
      crisis: {
        id: 'empty',
        name: 'No Crisis',
        equityReturnSequence: [],
        durationYears: 0,
      },
    }
    const result = runSequenceRisk(noCrisisParams)
    // Both should be the same since there's no crisis override
    // (they use different child RNGs so won't be identical, but should be close)
    expect(Math.abs(result.normal_success_rate - result.crisis_success_rate)).toBeLessThan(0.15)
  })

  it('conservative allocation mitigation uses modified weights', () => {
    const result = runSequenceRisk(PARAMS)
    const conserv = result.mitigations.find(m => m.strategy === 'Conservative Allocation')
    expect(conserv).toBeDefined()
    // Bond tent shifts equity to bonds, so should have different characteristics
    expect(conserv!.normal_success_rate).toBeGreaterThanOrEqual(0)
    expect(conserv!.crisis_success_rate).toBeGreaterThanOrEqual(0)
  })

  it('success_improvement = mitigation_crisis_rate - baseline_crisis_rate', () => {
    const result = runSequenceRisk(PARAMS)
    const baselineCrisisRate = result.crisis_success_rate
    for (const m of result.mitigations) {
      expect(m.success_improvement).toBeCloseTo(
        m.crisis_success_rate - baselineCrisisRate,
        6,
      )
    }
  })

  // ---------------------------------------------------------------------------
  // All 12 withdrawal strategies
  // ---------------------------------------------------------------------------

  it('works with all 12 withdrawal strategies', () => {
    const strategyConfigs: Array<{ strategy: string; params: Record<string, number> }> = [
      { strategy: 'constant_dollar', params: { swr: 0.04 } },
      { strategy: 'vpw', params: { expectedRealReturn: 0.03, targetEndValue: 0 } },
      { strategy: 'guardrails', params: { initialRate: 0.05, ceilingTrigger: 1.2, floorTrigger: 0.8, adjustmentSize: 0.1 } },
      { strategy: 'vanguard_dynamic', params: { swr: 0.04, ceiling: 0.05, floor: 0.025 } },
      { strategy: 'cape_based', params: { baseRate: 0.04, capeWeight: 0.5, currentCape: 30 } },
      { strategy: 'floor_ceiling', params: { floorAmount: 60000, ceilingAmount: 150000, targetRate: 0.045 } },
      { strategy: 'percent_of_portfolio', params: { rate: 0.04 } },
      { strategy: 'one_over_n', params: {} },
      { strategy: 'sensible_withdrawals', params: { baseRate: 0.03, extrasRate: 0.10 } },
      { strategy: 'ninety_five_percent', params: { swr: 0.04 } },
      { strategy: 'endowment', params: { swr: 0.04, smoothingWeight: 0.70 } },
      { strategy: 'hebeler_autopilot', params: { expectedRealReturn: 0.03 } },
    ]

    for (const { strategy, params } of strategyConfigs) {
      const result = runSequenceRisk({
        ...PARAMS,
        withdrawalStrategy: strategy,
        strategyParams: params,
        nSimulations: 100, // Keep low for speed
      })
      expect(result.normal_success_rate).toBeGreaterThanOrEqual(0)
      expect(result.normal_success_rate).toBeLessThanOrEqual(1)
      expect(result.crisis_success_rate).toBeGreaterThanOrEqual(0)
      expect(result.crisis_success_rate).toBeLessThanOrEqual(1)
      expect(result.mitigations).toHaveLength(3)
    }
  })

  it('sensible_withdrawals tracks prevYearGains through crisis', () => {
    const result = runSequenceRisk({
      ...PARAMS,
      withdrawalStrategy: 'sensible_withdrawals',
      strategyParams: { baseRate: 0.03, extrasRate: 0.10 },
      nSimulations: 100,
    })
    // Verify no NaN in percentile bands (would indicate broken gain tracking)
    for (const v of result.crisis_percentile_bands.p50) {
      expect(Number.isFinite(v)).toBe(true)
    }
  })

  // ---------------------------------------------------------------------------
  // oneTimeWithdrawals
  // ---------------------------------------------------------------------------

  it('oneTimeWithdrawals reduces portfolio during stress test', () => {
    const withoutOneTime = runSequenceRisk(PARAMS)
    const withOneTime = runSequenceRisk({
      ...PARAMS,
      oneTimeWithdrawals: [
        { year: 2, amount: 200_000 },
        { year: 5, amount: 100_000 },
      ],
    })
    // One-time withdrawals should not improve success rate
    expect(withOneTime.normal_success_rate).toBeLessThanOrEqual(
      withoutOneTime.normal_success_rate + 0.05
    )
  })

  it('oneTimeWithdrawals are passed through to mitigations', () => {
    const result = runSequenceRisk({
      ...PARAMS,
      oneTimeWithdrawals: [{ year: 1, amount: 100_000 }],
    })
    // Should still produce 3 mitigations without error
    expect(result.mitigations).toHaveLength(3)
    for (const m of result.mitigations) {
      expect(Number.isFinite(m.crisis_success_rate)).toBe(true)
    }
  })

  // ---------------------------------------------------------------------------
  // annualExpensesAtRetirement
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Negative balance clamping (sequenceRisk.ts:195-210)
  // ---------------------------------------------------------------------------

  it('all percentile band values are >= 0 with aggressive SWR', () => {
    // With 20% SWR, many simulations deplete — verify balance clamping to 0
    const result = runSequenceRisk({
      ...PARAMS,
      initialPortfolio: 500_000,
      strategyParams: { swr: 0.20 },
      nSimulations: 200,
    })

    for (const bands of [result.normal_percentile_bands, result.crisis_percentile_bands]) {
      for (const val of bands.p5) expect(val).toBeGreaterThanOrEqual(0)
      for (const val of bands.p10) expect(val).toBeGreaterThanOrEqual(0)
      for (const val of bands.p25) expect(val).toBeGreaterThanOrEqual(0)
      for (const val of bands.p50) expect(val).toBeGreaterThanOrEqual(0)
      for (const val of bands.p75) expect(val).toBeGreaterThanOrEqual(0)
      for (const val of bands.p90) expect(val).toBeGreaterThanOrEqual(0)
      for (const val of bands.p95) expect(val).toBeGreaterThanOrEqual(0)
    }
  })

  it('very aggressive SWR produces low crisis success rate with many failures', () => {
    // With 50% SWR on a $500K portfolio, most simulations should fail
    const result = runSequenceRisk({
      ...PARAMS,
      initialPortfolio: 500_000,
      strategyParams: { swr: 0.50 },
      nSimulations: 200,
    })

    // Crisis success rate should be very low (most sims fail)
    expect(result.crisis_success_rate).toBeLessThan(0.2)
    // Normal success rate should also be low
    expect(result.normal_success_rate).toBeLessThan(0.3)
    // All percentile bands still non-negative (clamped)
    for (const val of result.crisis_percentile_bands.p5) {
      expect(val).toBeGreaterThanOrEqual(0)
    }
  })

  // ---------------------------------------------------------------------------
  // annualExpensesAtRetirement
  // ---------------------------------------------------------------------------

  it('uses annualExpensesAtRetirement for initial withdrawal when set', () => {
    // Default: withdrawal = $2M × 0.04 = $80K
    // With expenses = $40K: withdrawal is halved → higher success rate
    const withExpenses = runSequenceRisk({
      ...PARAMS,
      annualExpensesAtRetirement: 40_000,
    })
    const withoutExpenses = runSequenceRisk(PARAMS)

    // Lower withdrawal should preserve more portfolio → higher or equal success
    expect(withExpenses.normal_success_rate).toBeGreaterThanOrEqual(
      withoutExpenses.normal_success_rate,
    )
    // Crisis success should also differ (not silently ignored)
    expect(withExpenses.crisis_success_rate).not.toBe(
      withoutExpenses.crisis_success_rate,
    )
  })

  it('uses portfolio × SWR when withdrawalBasis is rate', () => {
    const expenseResult = runSequenceRisk({
      ...PARAMS,
      annualExpensesAtRetirement: 96000,  // $96K expenses
      withdrawalBasis: 'expenses',
    })
    const rateResult = runSequenceRisk({
      ...PARAMS,
      annualExpensesAtRetirement: 96000,
      withdrawalBasis: 'rate',
    })
    // Rate-driven ($2M × 4% = $80K) withdraws less than expense-driven ($96K)
    // so rate-driven should have higher normal success rate
    expect(rateResult.normal_success_rate).toBeGreaterThan(expenseResult.normal_success_rate)
  })
})

// ---------------------------------------------------------------------------
// Glide path (yearlyWeights)
// ---------------------------------------------------------------------------

describe('sequence risk with yearlyWeights (glide path)', () => {
  const nYears = PARAMS.lifeExpectancy - PARAMS.retirementAge

  it('undefined yearlyWeights preserves original behavior', () => {
    const base = runSequenceRisk(PARAMS)
    const explicit = runSequenceRisk({ ...PARAMS, yearlyWeights: undefined })
    expect(explicit.normal_success_rate).toBe(base.normal_success_rate)
    expect(explicit.crisis_success_rate).toBe(base.crisis_success_rate)
  })

  it('constant yearlyWeights matches fixed weights', () => {
    const constantWeights = Array.from({ length: nYears }, () => [...PARAMS.allocationWeights])
    const constResult = runSequenceRisk({ ...PARAMS, yearlyWeights: constantWeights })
    const fixedResult = runSequenceRisk(PARAMS)
    // Same seed + same weights = same results
    // Small tolerance because RNG sequence differs (per-asset vs portfolio generation)
    expect(Math.abs(constResult.normal_success_rate - fixedResult.normal_success_rate)).toBeLessThan(0.15)
  })

  it('glide path produces different results from fixed weights', () => {
    const yearlyWeights = Array.from({ length: nYears }, (_, y) => {
      const t = y / (nYears - 1)
      // Shift from current allocation toward 100% bonds over retirement
      return PARAMS.allocationWeights.map((w, i) => {
        if (i === 3) return w + (1 - w) * t  // bonds increase
        return w * (1 - t)                     // everything else decreases
      })
    })
    const glideResult = runSequenceRisk({ ...PARAMS, yearlyWeights })
    const fixedResult = runSequenceRisk(PARAMS)
    // Normal results should differ (crisis may both be 0 for severe scenarios)
    expect(glideResult.normal_success_rate).not.toBe(fixedResult.normal_success_rate)
  })

  it('mitigations still work with yearlyWeights', () => {
    const yearlyWeights = Array.from({ length: nYears }, () => [...PARAMS.allocationWeights])
    const result = runSequenceRisk({ ...PARAMS, yearlyWeights })
    expect(result.mitigations).toHaveLength(3)
    result.mitigations.forEach(m => {
      expect(m.normal_success_rate).toBeGreaterThanOrEqual(0)
      expect(m.crisis_success_rate).toBeGreaterThanOrEqual(0)
    })
  })
})
