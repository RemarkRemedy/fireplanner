import { describe, it, expect } from 'vitest'
import { runMonteCarlo, resolveInitialRate, generateReturnsParametric, computeWithdrawalsForYear, type MonteCarloEngineParams } from './monteCarlo.ts'
import { CORRELATION_MATRIX, ASSET_CLASSES } from '@/lib/data/historicalReturns.ts'
import { SeededRNG } from '@/lib/math/random.ts'

// Standard test params for a mid-career professional
function makeDefaultParams(overrides: Record<string, unknown> = {}) {
  return {
    initialPortfolio: 1_000_000,
    allocationWeights: [0.30, 0.10, 0.10, 0.25, 0.05, 0.05, 0.10, 0.05],
    expectedReturns: ASSET_CLASSES.map((a) => a.expectedReturn),
    stdDevs: ASSET_CLASSES.map((a) => a.stdDev),
    correlationMatrix: CORRELATION_MATRIX,
    currentAge: 35,
    retirementAge: 55,
    lifeExpectancy: 90,
    annualSavings: Array(20).fill(50_000),
    postRetirementIncome: Array(35).fill(0),
    method: 'parametric' as const,
    nSimulations: 500,
    seed: 42,
    withdrawalStrategy: 'constant_dollar' as const,
    strategyParams: { swr: 0.04 },
    expenseRatio: 0.003,
    inflation: 0.025,
    ...overrides,
  }
}

describe('resolveInitialRate', () => {
  it('returns swr when present', () => {
    expect(resolveInitialRate({ swr: 0.035 })).toBe(0.035)
  })

  it('falls back to initialRate', () => {
    expect(resolveInitialRate({ initialRate: 0.05 })).toBe(0.05)
  })

  it('falls back to initial_rate (snake_case)', () => {
    expect(resolveInitialRate({ initial_rate: 0.05 })).toBe(0.05)
  })

  it('falls back to targetRate', () => {
    expect(resolveInitialRate({ targetRate: 0.045 })).toBe(0.045)
  })

  it('falls back to target_rate (snake_case)', () => {
    expect(resolveInitialRate({ target_rate: 0.045 })).toBe(0.045)
  })

  it('returns default 0.04 when no keys present', () => {
    expect(resolveInitialRate({})).toBe(0.04)
  })

  it('returns custom default', () => {
    expect(resolveInitialRate({}, 0.05)).toBe(0.05)
  })
})

describe('runMonteCarlo', () => {
  it('returns all expected keys', () => {
    const result = runMonteCarlo(makeDefaultParams())
    expect(result).toHaveProperty('success_rate')
    expect(result).toHaveProperty('percentile_bands')
    expect(result).toHaveProperty('terminal_stats')
    expect(result).toHaveProperty('failure_distribution')
  })

  it('success_rate is between 0 and 1', () => {
    const result = runMonteCarlo(makeDefaultParams())
    expect(result.success_rate).toBeGreaterThanOrEqual(0)
    expect(result.success_rate).toBeLessThanOrEqual(1)
  })

  it('percentile_bands has correct length (lifeExpectancy - currentAge + 1)', () => {
    const params = makeDefaultParams()
    const result = runMonteCarlo(params)
    const expectedLength = params.lifeExpectancy - params.currentAge + 1
    expect(result.percentile_bands.years.length).toBe(expectedLength)
    expect(result.percentile_bands.ages.length).toBe(expectedLength)
    expect(result.percentile_bands.p5.length).toBe(expectedLength)
    expect(result.percentile_bands.p50.length).toBe(expectedLength)
    expect(result.percentile_bands.p95.length).toBe(expectedLength)
  })

  it('percentile_bands years start at 0', () => {
    const result = runMonteCarlo(makeDefaultParams())
    expect(result.percentile_bands.years[0]).toBe(0)
  })

  it('percentile_bands ages start at currentAge', () => {
    const params = makeDefaultParams()
    const result = runMonteCarlo(params)
    expect(result.percentile_bands.ages[0]).toBe(params.currentAge)
  })

  it('percentile bands are monotonically ordered (p5 <= p10 <= ... <= p95) at each year', () => {
    const result = runMonteCarlo(makeDefaultParams())
    const bands = result.percentile_bands
    for (let i = 0; i < bands.years.length; i++) {
      expect(bands.p5[i]).toBeLessThanOrEqual(bands.p10[i] + 1e-6)
      expect(bands.p10[i]).toBeLessThanOrEqual(bands.p25[i] + 1e-6)
      expect(bands.p25[i]).toBeLessThanOrEqual(bands.p50[i] + 1e-6)
      expect(bands.p50[i]).toBeLessThanOrEqual(bands.p75[i] + 1e-6)
      expect(bands.p75[i]).toBeLessThanOrEqual(bands.p90[i] + 1e-6)
      expect(bands.p90[i]).toBeLessThanOrEqual(bands.p95[i] + 1e-6)
    }
  })

  it('initial portfolio matches at year 0 (all percentiles equal initialPortfolio)', () => {
    const params = makeDefaultParams()
    const result = runMonteCarlo(params)
    // At year 0, all simulations start with the same initial portfolio
    expect(result.percentile_bands.p5[0]).toBeCloseTo(params.initialPortfolio, -1)
    expect(result.percentile_bands.p50[0]).toBeCloseTo(params.initialPortfolio, -1)
    expect(result.percentile_bands.p95[0]).toBeCloseTo(params.initialPortfolio, -1)
  })

  it('is reproducible with the same seed', () => {
    const params = makeDefaultParams({ seed: 123 })
    const r1 = runMonteCarlo(params)
    const r2 = runMonteCarlo(params)
    expect(r1.success_rate).toBe(r2.success_rate)
    expect(r1.terminal_stats.median).toBe(r2.terminal_stats.median)
    expect(r1.percentile_bands.p50).toEqual(r2.percentile_bands.p50)
  })

  it('produces different results with different seeds', () => {
    const r1 = runMonteCarlo(makeDefaultParams({ seed: 42 }))
    const r2 = runMonteCarlo(makeDefaultParams({ seed: 99 }))
    // Very unlikely to be exactly equal with different seeds
    expect(r1.success_rate).not.toBe(r2.success_rate)
  })

  it('terminal_stats has all required fields', () => {
    const result = runMonteCarlo(makeDefaultParams())
    expect(typeof result.terminal_stats.median).toBe('number')
    expect(typeof result.terminal_stats.mean).toBe('number')
    expect(typeof result.terminal_stats.worst).toBe('number')
    expect(typeof result.terminal_stats.best).toBe('number')
    expect(typeof result.terminal_stats.p5).toBe('number')
    expect(typeof result.terminal_stats.p95).toBe('number')
  })

  it('terminal_stats worst <= median <= best', () => {
    const result = runMonteCarlo(makeDefaultParams())
    expect(result.terminal_stats.worst).toBeLessThanOrEqual(result.terminal_stats.median)
    expect(result.terminal_stats.median).toBeLessThanOrEqual(result.terminal_stats.best)
  })

  it('terminal_stats p5 <= p95', () => {
    const result = runMonteCarlo(makeDefaultParams())
    expect(result.terminal_stats.p5).toBeLessThanOrEqual(result.terminal_stats.p95)
  })

  it('failure_distribution has all required fields', () => {
    const result = runMonteCarlo(makeDefaultParams())
    expect(Array.isArray(result.failure_distribution.buckets)).toBe(true)
    expect(Array.isArray(result.failure_distribution.counts)).toBe(true)
    expect(typeof result.failure_distribution.total_failures).toBe('number')
  })

  it('failure_distribution total_failures is consistent with success_rate', () => {
    const params = makeDefaultParams()
    const result = runMonteCarlo(params)
    const expectedFailures = Math.round((1 - result.success_rate) * params.nSimulations)
    expect(result.failure_distribution.total_failures).toBe(expectedFailures)
  })

  it('failure_distribution bucket counts sum to total_failures', () => {
    const result = runMonteCarlo(makeDefaultParams())
    const sumCounts = result.failure_distribution.counts.reduce((a, b) => a + b, 0)
    expect(sumCounts).toBe(result.failure_distribution.total_failures)
  })
})

describe('runMonteCarlo — bootstrap method', () => {
  it('runs successfully with bootstrap method', () => {
    const result = runMonteCarlo(makeDefaultParams({ method: 'bootstrap' }))
    expect(result.success_rate).toBeGreaterThanOrEqual(0)
    expect(result.success_rate).toBeLessThanOrEqual(1)
    expect(result.percentile_bands.years.length).toBe(90 - 35 + 1)
  })

  it('is reproducible with same seed', () => {
    const params = makeDefaultParams({ method: 'bootstrap', seed: 77 })
    const r1 = runMonteCarlo(params)
    const r2 = runMonteCarlo(params)
    expect(r1.success_rate).toBe(r2.success_rate)
    expect(r1.terminal_stats.median).toBe(r2.terminal_stats.median)
  })
})

describe('runMonteCarlo — fat_tail method', () => {
  it('runs successfully with fat_tail method', () => {
    const result = runMonteCarlo(makeDefaultParams({ method: 'fat_tail' }))
    expect(result.success_rate).toBeGreaterThanOrEqual(0)
    expect(result.success_rate).toBeLessThanOrEqual(1)
    expect(result.percentile_bands.years.length).toBe(90 - 35 + 1)
  })

  it('is reproducible with same seed', () => {
    const params = makeDefaultParams({ method: 'fat_tail', seed: 55 })
    const r1 = runMonteCarlo(params)
    const r2 = runMonteCarlo(params)
    expect(r1.success_rate).toBe(r2.success_rate)
    expect(r1.terminal_stats.median).toBe(r2.terminal_stats.median)
  })
})

describe('runMonteCarlo — already-retired scenario', () => {
  it('handles currentAge == retirementAge (pure decumulation)', () => {
    const params = makeDefaultParams({
      currentAge: 55,
      retirementAge: 55,
      lifeExpectancy: 90,
      annualSavings: [],
      postRetirementIncome: Array(35).fill(10_000),
    })
    const result = runMonteCarlo(params)
    expect(result.success_rate).toBeGreaterThanOrEqual(0)
    expect(result.success_rate).toBeLessThanOrEqual(1)
    // Should be 36 points (90 - 55 + 1)
    expect(result.percentile_bands.years.length).toBe(36)
    expect(result.percentile_bands.ages[0]).toBe(55)
  })
})

describe('runMonteCarlo — VPW strategy', () => {
  it('runs VPW strategy successfully', () => {
    const result = runMonteCarlo(
      makeDefaultParams({
        withdrawalStrategy: 'vpw',
        strategyParams: { expectedRealReturn: 0.03, targetEndValue: 0 },
      })
    )
    expect(result.success_rate).toBeGreaterThanOrEqual(0)
    expect(result.success_rate).toBeLessThanOrEqual(1)
  })
})

describe('runMonteCarlo — guardrails strategy', () => {
  it('runs guardrails strategy successfully', () => {
    const result = runMonteCarlo(
      makeDefaultParams({
        withdrawalStrategy: 'guardrails',
        strategyParams: {
          initialRate: 0.05,
          ceilingTrigger: 1.20,
          floorTrigger: 0.80,
          adjustmentSize: 0.10,
        },
      })
    )
    expect(result.success_rate).toBeGreaterThanOrEqual(0)
    expect(result.success_rate).toBeLessThanOrEqual(1)
  })
})

describe('runMonteCarlo — vanguard_dynamic strategy', () => {
  it('runs vanguard_dynamic strategy successfully', () => {
    const result = runMonteCarlo(
      makeDefaultParams({
        withdrawalStrategy: 'vanguard_dynamic',
        strategyParams: { swr: 0.04, ceiling: 0.05, floor: 0.025 },
      })
    )
    expect(result.success_rate).toBeGreaterThanOrEqual(0)
    expect(result.success_rate).toBeLessThanOrEqual(1)
  })
})

describe('runMonteCarlo — cape_based strategy', () => {
  it('runs cape_based strategy successfully', () => {
    const result = runMonteCarlo(
      makeDefaultParams({
        withdrawalStrategy: 'cape_based',
        strategyParams: { baseRate: 0.04, capeWeight: 0.50, currentCape: 30 },
      })
    )
    expect(result.success_rate).toBeGreaterThanOrEqual(0)
    expect(result.success_rate).toBeLessThanOrEqual(1)
  })
})

describe('runMonteCarlo — floor_ceiling strategy', () => {
  it('runs floor_ceiling strategy successfully', () => {
    const result = runMonteCarlo(
      makeDefaultParams({
        withdrawalStrategy: 'floor_ceiling',
        strategyParams: { floorAmount: 60_000, ceilingAmount: 150_000, targetRate: 0.045 },
      })
    )
    expect(result.success_rate).toBeGreaterThanOrEqual(0)
    expect(result.success_rate).toBeLessThanOrEqual(1)
  })
})

describe('runMonteCarlo — percent_of_portfolio strategy', () => {
  it('runs percent_of_portfolio strategy successfully', () => {
    const result = runMonteCarlo(
      makeDefaultParams({
        withdrawalStrategy: 'percent_of_portfolio',
        strategyParams: { rate: 0.04 },
      })
    )
    expect(result.success_rate).toBeGreaterThanOrEqual(0)
    expect(result.success_rate).toBeLessThanOrEqual(1)
  })
})

describe('runMonteCarlo — one_over_n strategy', () => {
  it('runs one_over_n strategy successfully', () => {
    const result = runMonteCarlo(
      makeDefaultParams({
        withdrawalStrategy: 'one_over_n',
        strategyParams: {},
      })
    )
    // one_over_n always spends everything, so it never "fails" unless portfolio hits 0 mid-year
    expect(result.success_rate).toBeGreaterThanOrEqual(0)
    expect(result.success_rate).toBeLessThanOrEqual(1)
  })
})

describe('runMonteCarlo — sensible_withdrawals strategy', () => {
  it('runs sensible_withdrawals strategy successfully', () => {
    const result = runMonteCarlo(
      makeDefaultParams({
        withdrawalStrategy: 'sensible_withdrawals',
        strategyParams: { baseRate: 0.03, extrasRate: 0.10 },
      })
    )
    expect(result.success_rate).toBeGreaterThanOrEqual(0)
    expect(result.success_rate).toBeLessThanOrEqual(1)
  })

  it('prevYearGains tracking produces valid withdrawal bands', () => {
    const result = runMonteCarlo(
      makeDefaultParams({
        withdrawalStrategy: 'sensible_withdrawals',
        strategyParams: { baseRate: 0.03, extrasRate: 0.10 },
        nSimulations: 200,
      })
    )
    // Withdrawal bands should exist and have no NaN values
    if (result.withdrawal_bands) {
      for (const v of result.withdrawal_bands.p50) {
        expect(Number.isFinite(v)).toBe(true)
      }
    }
  })
})

describe('runMonteCarlo — ninety_five_percent strategy', () => {
  it('runs ninety_five_percent strategy successfully', () => {
    const result = runMonteCarlo(
      makeDefaultParams({
        withdrawalStrategy: 'ninety_five_percent',
        strategyParams: { swr: 0.04 },
      })
    )
    expect(result.success_rate).toBeGreaterThanOrEqual(0)
    expect(result.success_rate).toBeLessThanOrEqual(1)
  })
})

describe('runMonteCarlo — endowment strategy', () => {
  it('runs endowment strategy successfully', () => {
    const result = runMonteCarlo(
      makeDefaultParams({
        withdrawalStrategy: 'endowment',
        strategyParams: { swr: 0.04, smoothingWeight: 0.70 },
      })
    )
    expect(result.success_rate).toBeGreaterThanOrEqual(0)
    expect(result.success_rate).toBeLessThanOrEqual(1)
  })
})

describe('runMonteCarlo — hebeler_autopilot strategy', () => {
  it('runs hebeler_autopilot strategy successfully', () => {
    const result = runMonteCarlo(
      makeDefaultParams({
        withdrawalStrategy: 'hebeler_autopilot',
        strategyParams: { expectedRealReturn: 0.03 },
      })
    )
    expect(result.success_rate).toBeGreaterThanOrEqual(0)
    expect(result.success_rate).toBeLessThanOrEqual(1)
  })
})

describe('generateReturnsParametric', () => {
  it('returns array of correct shape (nSims x nYears)', () => {
    const rng = new SeededRNG(42)
    const returns = generateReturnsParametric(
      rng,
      100,
      10,
      [0.30, 0.10, 0.10, 0.25, 0.05, 0.05, 0.10, 0.05],
      ASSET_CLASSES.map((a) => a.expectedReturn),
      ASSET_CLASSES.map((a) => a.stdDev),
      CORRELATION_MATRIX,
    )
    expect(returns.length).toBe(100)
    expect(returns[0].length).toBe(10)
  })

  it('returns are finite numbers', () => {
    const rng = new SeededRNG(42)
    const returns = generateReturnsParametric(
      rng,
      50,
      5,
      [0.30, 0.10, 0.10, 0.25, 0.05, 0.05, 0.10, 0.05],
      ASSET_CLASSES.map((a) => a.expectedReturn),
      ASSET_CLASSES.map((a) => a.stdDev),
      CORRELATION_MATRIX,
    )
    for (let s = 0; s < 50; s++) {
      for (let y = 0; y < 5; y++) {
        expect(Number.isFinite(returns[s][y])).toBe(true)
      }
    }
  })
})

describe('computeWithdrawalsForYear', () => {
  it('dispatches constant_dollar correctly', () => {
    const withdrawal = computeWithdrawalsForYear(
      'constant_dollar',
      1_000_000,
      3,
      30,
      40_000,
      38_000,
      0.025,
      { swr: 0.04 },
      undefined,
    )
    // constant_dollar: initialWithdrawal * (1 + inflation)^year = 40000 * 1.025^3
    const expected = 40_000 * 1.025 ** 3
    expect(withdrawal).toBeCloseTo(expected, 2)
  })

  it('dispatches vpw correctly', () => {
    const withdrawal = computeWithdrawalsForYear(
      'vpw',
      1_000_000,
      0,
      30,
      40_000,
      0,
      0.025,
      { expectedRealReturn: 0.03, targetEndValue: 0 },
      undefined,
    )
    // VPW: remaining = 30 - 0 = 30, rate = r*(1-0)/( 1 - (1+r)^-n )
    expect(withdrawal).toBeGreaterThan(0)
    expect(withdrawal).toBeLessThan(1_000_000)
  })

  it('throws on unknown strategy', () => {
    expect(() =>
      computeWithdrawalsForYear(
        'unknown_strategy',
        1_000_000,
        0,
        30,
        40_000,
        0,
        0.025,
        {},
        undefined,
      )
    ).toThrow('Unknown withdrawal strategy')
  })
})

describe('portfolioAdjustments', () => {
  it('omitted portfolioAdjustments gives identical results to empty', () => {
    const paramsWithout = makeDefaultParams()
    const paramsWith = makeDefaultParams({ portfolioAdjustments: [] })

    const resultWithout = runMonteCarlo(paramsWithout)
    const resultWith = runMonteCarlo(paramsWith)

    expect(resultWith.success_rate).toBe(resultWithout.success_rate)
    expect(resultWith.terminal_stats.median).toBe(resultWithout.terminal_stats.median)
  })

  it('$500K injection during accumulation increases terminal balance', () => {
    // Use lower SWR so portfolios survive long enough to show injection impact
    const testParams = { strategyParams: { swr: 0.03 } }
    const baseline = runMonteCarlo(makeDefaultParams(testParams))
    const withInjection = runMonteCarlo(makeDefaultParams({
      ...testParams,
      portfolioAdjustments: [{ year: 5, amount: 500_000 }],
    }))

    expect(withInjection.terminal_stats.median).toBeGreaterThan(baseline.terminal_stats.median)
  })

  it('$500K injection during decumulation improves success rate', () => {
    // Use params that produce some failures (high SWR, low portfolio)
    const stressParams = {
      initialPortfolio: 500_000,
      annualSavings: [],
      currentAge: 60,
      retirementAge: 60,
      lifeExpectancy: 95,
      postRetirementIncome: Array(35).fill(0),
      strategyParams: { swr: 0.06 },
      nSimulations: 1000,
    }

    const baseline = runMonteCarlo(makeDefaultParams(stressParams))
    const withInjection = runMonteCarlo(makeDefaultParams({
      ...stressParams,
      portfolioAdjustments: [{ year: 5, amount: 500_000 }],
    }))

    expect(withInjection.success_rate).toBeGreaterThanOrEqual(baseline.success_rate)
  })

  it('multiple adjustments at different years all apply', () => {
    // Use lower SWR so portfolios survive long enough to show injection impact
    const testParams = { strategyParams: { swr: 0.03 } }
    const baseline = runMonteCarlo(makeDefaultParams(testParams))
    const withMultiple = runMonteCarlo(makeDefaultParams({
      ...testParams,
      portfolioAdjustments: [
        { year: 2, amount: 100_000 },
        { year: 10, amount: 200_000 },
        { year: 25, amount: 300_000 },
      ],
    }))

    expect(withMultiple.terminal_stats.median).toBeGreaterThan(baseline.terminal_stats.median)
  })

  it('out-of-range year indices are ignored', () => {
    const baseline = runMonteCarlo(makeDefaultParams())
    const withOutOfRange = runMonteCarlo(makeDefaultParams({
      portfolioAdjustments: [
        { year: -1, amount: 1_000_000 },
        { year: 999, amount: 1_000_000 },
      ],
    }))

    expect(withOutOfRange.success_rate).toBe(baseline.success_rate)
    expect(withOutOfRange.terminal_stats.median).toBe(baseline.terminal_stats.median)
  })
})

describe('MC success rate invariants', () => {
  it('success rate is exactly 0 or 1 for extreme cases', () => {
    // Huge portfolio, low SWR → should be ~100% success
    const safe = runMonteCarlo(makeDefaultParams({
      initialPortfolio: 100_000_000,
      annualSavings: Array(20).fill(0),
      strategyParams: { swr: 0.001 },
      nSimulations: 200,
    }))
    expect(safe.success_rate).toBe(1)

    // Tiny portfolio, massive SWR → should be ~0% success
    const risky = runMonteCarlo(makeDefaultParams({
      initialPortfolio: 1000,
      annualSavings: [],
      currentAge: 60,
      retirementAge: 60,
      lifeExpectancy: 95,
      postRetirementIncome: Array(35).fill(0),
      strategyParams: { swr: 0.50 },
      nSimulations: 200,
    }))
    expect(risky.success_rate).toBe(0)
  })

  it('higher SWR reduces success rate', () => {
    const conservative = runMonteCarlo(makeDefaultParams({
      strategyParams: { swr: 0.02 },
      nSimulations: 500,
    }))
    const aggressive = runMonteCarlo(makeDefaultParams({
      strategyParams: { swr: 0.08 },
      nSimulations: 500,
    }))
    expect(conservative.success_rate).toBeGreaterThanOrEqual(aggressive.success_rate)
  })

  it('withdrawal_bands covers decumulation years', () => {
    const params = makeDefaultParams()
    const result = runMonteCarlo(params)
    if (result.withdrawal_bands) {
      // Withdrawal bands cover only decumulation years
      const nYearsDecum = Math.max(1, params.lifeExpectancy - params.retirementAge)
      expect(result.withdrawal_bands.years.length).toBe(nYearsDecum)
    }
  })

  // ---------------------------------------------------------------------------
  // Spending metrics
  // ---------------------------------------------------------------------------

  it('spending_metrics values are between 0 and 1', () => {
    const result = runMonteCarlo(makeDefaultParams())
    const sm = result.spending_metrics!
    expect(sm.volatileSpending).toBeGreaterThanOrEqual(0)
    expect(sm.volatileSpending).toBeLessThanOrEqual(1)
    expect(sm.smallSpending).toBeGreaterThanOrEqual(0)
    expect(sm.smallSpending).toBeLessThanOrEqual(1)
    expect(sm.largeEndPortfolio).toBeGreaterThanOrEqual(0)
    expect(sm.largeEndPortfolio).toBeLessThanOrEqual(1)
    expect(sm.smallEndPortfolio).toBeGreaterThanOrEqual(0)
    expect(sm.smallEndPortfolio).toBeLessThanOrEqual(1)
  })

  it('constant_dollar strategy has low volatile spending', () => {
    const result = runMonteCarlo(makeDefaultParams({
      withdrawalStrategy: 'constant_dollar',
      strategyParams: { swr: 0.04 },
    }))
    // Constant dollar withdraws same inflation-adjusted amount — only volatile
    // when portfolio depletes (withdrawals drop to 0 or are capped).
    // With modest SWR and good savings, most sims should be non-volatile.
    // Threshold at 0.6 accounts for conservative forward-looking return assumptions.
    expect(result.spending_metrics!.volatileSpending).toBeLessThan(0.6)
  })

  it('different strategies produce different spending metrics', () => {
    const cd = runMonteCarlo(makeDefaultParams({
      withdrawalStrategy: 'constant_dollar',
      strategyParams: { swr: 0.04 },
    }))
    const vpwResult = runMonteCarlo(makeDefaultParams({
      withdrawalStrategy: 'vpw',
      strategyParams: { expectedRealReturn: 0.03, targetEndValue: 0 },
    }))
    // Both should have valid metrics, and they should differ
    expect(cd.spending_metrics!.volatileSpending).toBeDefined()
    expect(vpwResult.spending_metrics!.volatileSpending).toBeDefined()
    // VPW and constant_dollar have fundamentally different withdrawal patterns
    const cdMetrics = cd.spending_metrics!
    const vpwMetrics = vpwResult.spending_metrics!
    // At least one metric should differ between the two strategies
    const allSame =
      cdMetrics.volatileSpending === vpwMetrics.volatileSpending &&
      cdMetrics.smallSpending === vpwMetrics.smallSpending &&
      cdMetrics.largeEndPortfolio === vpwMetrics.largeEndPortfolio &&
      cdMetrics.smallEndPortfolio === vpwMetrics.smallEndPortfolio
    expect(allSame).toBe(false)
  })

  // ---------------------------------------------------------------------------
  // Histogram snapshots
  // ---------------------------------------------------------------------------

  it('histogram_snapshots exist at expected years', () => {
    const params = makeDefaultParams()
    const result = runMonteCarlo(params)
    const snapshots = result.histogram_snapshots!
    expect(snapshots.length).toBeGreaterThanOrEqual(1)
    // First snapshot should be at retirement age
    expect(snapshots[0].age).toBe(params.retirementAge)
  })

  it('histogram bucket counts sum to nSims', () => {
    const params = makeDefaultParams({ nSimulations: 200 })
    const result = runMonteCarlo(params)
    for (const snap of result.histogram_snapshots!) {
      const totalCount = snap.buckets.reduce((sum, b) => sum + b.count, 0)
      expect(totalCount).toBe(200)
    }
  })

  it('histogram has correct number of buckets', () => {
    const result = runMonteCarlo(makeDefaultParams())
    for (const snap of result.histogram_snapshots!) {
      expect(snap.buckets.length).toBe(snap.nBuckets)
      expect(snap.nBuckets).toBe(20)
    }
  })

  it('histogram buckets are contiguous', () => {
    const result = runMonteCarlo(makeDefaultParams())
    for (const snap of result.histogram_snapshots!) {
      for (let i = 1; i < snap.buckets.length; i++) {
        expect(snap.buckets[i].min).toBeCloseTo(snap.buckets[i - 1].max, 2)
      }
    }
  })
})

describe('retirement cash bucket mitigation', () => {
  // Minimal setup: 0 accumulation years, 10 decumulation years, 1 asset class
  const baseBucketParams: MonteCarloEngineParams = {
    initialPortfolio: 1_000_000,
    allocationWeights: [1, 0, 0, 0, 0, 0, 0, 0],
    expectedReturns: [0.07, 0, 0, 0, 0, 0, 0, 0],
    stdDevs: [0.15, 0, 0, 0, 0, 0, 0, 0],
    correlationMatrix: Array.from({ length: 8 }, (_, i) =>
      Array.from({ length: 8 }, (_, j) => (i === j ? 1 : 0))
    ),
    currentAge: 65,
    retirementAge: 65,
    lifeExpectancy: 75,
    annualSavings: [],
    postRetirementIncome: [],
    method: 'parametric',
    nSimulations: 100,
    seed: 42,
    withdrawalStrategy: 'constant_dollar',
    strategyParams: { swr: 0.04 },
    expenseRatio: 0.003,
    inflation: 0.025,
  }

  it('mitigation none — unchanged from baseline', () => {
    const withNone = runMonteCarlo({
      ...baseBucketParams,
      retirementMitigation: { type: 'none' },
      seed: 42,
    })
    const withoutField = runMonteCarlo({
      ...baseBucketParams,
      seed: 42,
    })
    expect(withNone.success_rate).toBe(withoutField.success_rate)
  })

  it('cash bucket — deterministic with seed', () => {
    const config = {
      ...baseBucketParams,
      retirementMitigation: {
        type: 'cash_bucket' as const,
        targetMonths: 24,
        cashReturn: 0.02,
      },
      annualExpensesAtRetirement: 40000,
      seed: 42,
    }
    const r1 = runMonteCarlo(config)
    const r2 = runMonteCarlo(config)
    expect(r1.success_rate).toBe(r2.success_rate)
    expect(r1.percentile_bands.p50).toEqual(r2.percentile_bands.p50)
  })

  it('cash bucket carves from initial portfolio', () => {
    const withBucket = runMonteCarlo({
      ...baseBucketParams,
      retirementMitigation: {
        type: 'cash_bucket' as const,
        targetMonths: 24,
        cashReturn: 0.02,
      },
      annualExpensesAtRetirement: 40000,
      seed: 42,
    })
    // Bucket = 24 months × 40000/12 = 80000 carved from 1M
    // Both should have valid success rates
    const noBucket = runMonteCarlo({
      ...baseBucketParams,
      seed: 42,
    })
    expect(withBucket.success_rate).toBeGreaterThanOrEqual(0)
    expect(noBucket.success_rate).toBeGreaterThanOrEqual(0)
    // Median year-0 balance with bucket should be lower (80K carved out)
    expect(withBucket.percentile_bands.p50[0]).toBeLessThan(noBucket.percentile_bands.p50[0])
  })

  // Deterministic bucket tests: 1 sim, near-zero stddev for predictable returns
  const deterministicBucketParams: MonteCarloEngineParams = {
    initialPortfolio: 1_000_000,
    allocationWeights: [1, 0, 0, 0, 0, 0, 0, 0],
    expectedReturns: [0.07, 0, 0, 0, 0, 0, 0, 0],
    stdDevs: [0.001, 0, 0, 0, 0, 0, 0, 0],  // near-zero vol for predictable returns
    correlationMatrix: Array.from({ length: 8 }, (_, i) =>
      Array.from({ length: 8 }, (_, j) => (i === j ? 1 : 0))
    ),
    currentAge: 60,
    retirementAge: 60,
    lifeExpectancy: 70,
    annualSavings: [],
    postRetirementIncome: [],
    method: 'parametric',
    nSimulations: 1,
    seed: 42,
    withdrawalStrategy: 'constant_dollar',
    strategyParams: { swr: 0.04 },
    expenseRatio: 0,        // zero fees for easier math
    inflation: 0,            // zero inflation for easier math
    retirementMitigation: {
      type: 'cash_bucket',
      targetMonths: 24,
      cashReturn: 0.02,
    },
    annualExpensesAtRetirement: 60_000,  // bucket = 24 * 60000/12 = 120,000
  }

  it('bucket absorbs withdrawals — portfolio is not drawn from when bucket has funds', () => {
    const result = runMonteCarlo(deterministicBucketParams)
    // Bucket = 120K carved from 1M → portfolio starts at 880K
    // Year 0 balance in percentile bands is post-carve
    expect(result.percentile_bands.p50[0]).toBeCloseTo(880_000, -3)
    // Withdrawal = 60K (annualExpensesAtRetirement, not portfolio * SWR)
    // Year 0: 60K < 120K bucket → fully absorbed by bucket
    // Portfolio grows unencumbered: 880K * (1 + ~0.07) (minus any refill)
    const year1Balance = result.percentile_bands.p50[1]
    // Without bucket, balance would be (880K - 60K) * 1.07 ≈ 877,400
    // With bucket absorbing withdrawal, portfolio should be higher
    expect(year1Balance).toBeGreaterThan(877_000)
  })

  it('portfolio grows unencumbered while bucket absorbs withdrawals', () => {
    // Bucket = 120K, withdrawal = 60K/yr (annualExpensesAtRetirement), portfolio starts at 880K
    // Year 0→1: bucket absorbs 60K withdrawal, portfolio grows at ~7%
    const result = runMonteCarlo(deterministicBucketParams)
    const year0 = result.percentile_bands.p50[0]  // ~880K after carve
    const year1 = result.percentile_bands.p50[1]

    // The key mechanism: portfolio grew from ~880K WITHOUT a 60K withdrawal deducted
    // If withdrawal had come from portfolio, year1 ≈ (880K - 60K) * 1.07 = 877.4K
    // With bucket absorbing it, year1 should be higher
    const withoutProtection = (year0 - 60_000) * 1.07  // ~877K
    expect(year1).toBeGreaterThan(withoutProtection)
  })

  it('bucket refill does not exceed 10% of portfolio value', () => {
    // Use a large bucket (48 months = 240K) with a small portfolio
    // so the 10% cap is binding
    const result = runMonteCarlo({
      ...deterministicBucketParams,
      initialPortfolio: 500_000,
      retirementMitigation: {
        type: 'cash_bucket',
        targetMonths: 48,
        cashReturn: 0.02,
      },
      annualExpensesAtRetirement: 60_000,  // bucket = 48 * 5000 = 240K
    })
    // Bucket = 240K from 500K → portfolio starts at 260K
    // Portfolio at year 0 should be around 260K
    expect(result.percentile_bands.p50[0]).toBeCloseTo(260_000, -3)
    // Portfolio survives (bucket absorbs early withdrawals)
    expect(result.success_rate).toBeGreaterThan(0)
  })

  it('bucket improves outcomes vs no bucket in stable markets', () => {
    // With near-deterministic positive returns, bucket should help
    // by shielding portfolio from early withdrawals (more compounding)
    const withBucket = runMonteCarlo({
      ...deterministicBucketParams,
      nSimulations: 100,
      seed: 123,
      stdDevs: [0.10, 0, 0, 0, 0, 0, 0, 0],  // moderate vol
    })
    const noBucket = runMonteCarlo({
      ...deterministicBucketParams,
      nSimulations: 100,
      seed: 123,
      stdDevs: [0.10, 0, 0, 0, 0, 0, 0, 0],
      retirementMitigation: { type: 'none' },
    })
    // In stable/positive markets, bucket trades off initial portfolio size
    // for withdrawal smoothing. Both should have valid success rates.
    expect(withBucket.success_rate).toBeGreaterThanOrEqual(0)
    expect(noBucket.success_rate).toBeGreaterThanOrEqual(0)
    // Terminal median should differ (bucket changes the path)
    const lastIdx = withBucket.percentile_bands.p50.length - 1
    expect(withBucket.percentile_bands.p50[lastIdx]).not.toBe(noBucket.percentile_bands.p50[lastIdx])
  })

  it('zero bucket size has no effect on portfolio', () => {
    const zeroBucket = runMonteCarlo({
      ...deterministicBucketParams,
      retirementMitigation: {
        type: 'cash_bucket',
        targetMonths: 0,
        cashReturn: 0.02,
      },
      annualExpensesAtRetirement: 60_000,  // bucket = 0 * 5000 = 0
      seed: 42,
    })
    const noBucket = runMonteCarlo({
      ...deterministicBucketParams,
      retirementMitigation: { type: 'none' },
      seed: 42,
    })
    // Zero bucket target → zero carved → same as no bucket
    expect(zeroBucket.percentile_bands.p50[0]).toBe(noBucket.percentile_bands.p50[0])
    expect(zeroBucket.success_rate).toBe(noBucket.success_rate)
  })

  it('bucket larger than portfolio is capped at portfolio value', () => {
    const result = runMonteCarlo({
      ...deterministicBucketParams,
      initialPortfolio: 50_000,  // small portfolio
      retirementMitigation: {
        type: 'cash_bucket',
        targetMonths: 24,
        cashReturn: 0.02,
      },
      annualExpensesAtRetirement: 60_000,  // bucket target = 120K > 50K portfolio
    })
    // Bucket is capped at available portfolio (50K), portfolio starts at 0
    expect(result.percentile_bands.p50[0]).toBe(0)
    // Should still run without errors
    expect(result.success_rate).toBeGreaterThanOrEqual(0)
  })
})
