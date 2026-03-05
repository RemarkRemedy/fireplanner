import { describe, it, expect } from 'vitest'
import type { MonteCarloResult, StrategyParamsMap, WithdrawalStrategyType } from '@/lib/types'
import { buildAllocationSummary, deriveWRCritical50, buildPlannerResultsPayload } from './resultsPayload'

describe('buildAllocationSummary', () => {
  it('formats standard weights as Stocks/Bonds/Cash', () => {
    // 8 asset classes: US, SG, Intl, Bonds, REITs, Gold, Cash, CPF
    const weights = [0.3, 0.1, 0.1, 0.2, 0.1, 0, 0.2, 0]
    expect(buildAllocationSummary(weights)).toBe('Stocks 60 / Bonds 20 / Cash 20')
  })

  it('includes Gold when >= 0.5%', () => {
    const weights = [0.3, 0.05, 0.05, 0.2, 0.1, 0.1, 0.2, 0]
    expect(buildAllocationSummary(weights)).toContain('Gold 10')
  })

  it('includes CPF when >= 0.5%', () => {
    const weights = [0.3, 0.05, 0.05, 0.2, 0.1, 0, 0.2, 0.1]
    expect(buildAllocationSummary(weights)).toContain('CPF 10')
  })

  it('handles empty weights gracefully', () => {
    expect(buildAllocationSummary([])).toBe('Stocks 0 / Bonds 0 / Cash 0')
  })
})

const SAMPLE_RESULT: MonteCarloResult = {
  success_rate: 0.91,
  percentile_bands: {
    years: [0, 1, 2],
    ages: [30, 31, 32],
    p5: [100_000, 105_000, 110_000],
    p10: [100_000, 110_000, 120_000],
    p25: [100_000, 120_000, 140_000],
    p50: [100_000, 130_000, 160_000],
    p75: [100_000, 140_000, 180_000],
    p90: [100_000, 150_000, 200_000],
    p95: [100_000, 160_000, 220_000],
  },
  terminal_stats: {
    median: 100_000,
    mean: 120_000,
    worst: 5_000,
    best: 400_000,
    p5: 10_000,
    p95: 300_000,
  },
  safe_swr: {
    confidence_95: 0.03,
    confidence_90: 0.035,
    confidence_85: 0.04,
    confidence_50: 0.047,
  },
  failure_distribution: {
    buckets: ['0-5'],
    counts: [100],
    total_failures: 100,
    counts_5y: [0, 0],
  },
  withdrawal_bands: {
    years: [0],
    ages: [65],
    p5: [20_000],
    p10: [25_000],
    p25: [30_000],
    p50: [40_000],
    p75: [50_000],
    p90: [60_000],
    p95: [65_000],
  },
  n_simulations: 10_000,
  computation_time_ms: 42,
  cached: false,
}

const STRATEGY_PARAMS: StrategyParamsMap = {
  constant_dollar: { swr: 0.04 },
  vpw: { expectedRealReturn: 0.05, targetEndValue: 0 },
  guardrails: { initialRate: 0.04, ceilingTrigger: 1.2, floorTrigger: 0.8, adjustmentSize: 0.1 },
  vanguard_dynamic: { swr: 0.04, ceiling: 0.05, floor: 0.025 },
  cape_based: { baseRate: 0.04, capeWeight: 0.5, currentCape: 30 },
  floor_ceiling: { floor: 0.03, ceiling: 0.06, targetRate: 0.04 },
  percent_of_portfolio: { rate: 0.04 },
  one_over_n: {},
  sensible_withdrawals: { baseRate: 0.04, extrasRate: 0.02 },
  ninety_five_percent: { swr: 0.04 },
  endowment: { swr: 0.05, smoothingWeight: 0.7 },
  hebeler_autopilot: { expectedRealReturn: 0.045 },
}

describe('deriveWRCritical50', () => {
  it('derives from withdrawal bands p50 when available', () => {
    const wr = deriveWRCritical50({
      result: SAMPLE_RESULT,
      initialPortfolio: 1_000_000,
      selectedStrategy: 'constant_dollar' as WithdrawalStrategyType,
      strategyParams: STRATEGY_PARAMS,
    })
    // 40_000 / 1_000_000 = 0.04
    expect(wr).toBeCloseTo(0.04, 4)
  })

  it('falls back to constant_dollar SWR when no withdrawal bands', () => {
    const noBands = { ...SAMPLE_RESULT, withdrawal_bands: undefined }
    const wr = deriveWRCritical50({
      result: noBands as MonteCarloResult,
      initialPortfolio: 1_000_000,
      selectedStrategy: 'constant_dollar' as WithdrawalStrategyType,
      strategyParams: STRATEGY_PARAMS,
    })
    expect(wr).toBeCloseTo(0.04, 4)
  })

  it('falls back to safe_swr confidence_85 for non-constant strategies', () => {
    const noBands = { ...SAMPLE_RESULT, withdrawal_bands: undefined }
    const wr = deriveWRCritical50({
      result: noBands as MonteCarloResult,
      initialPortfolio: 1_000_000,
      selectedStrategy: 'vpw' as WithdrawalStrategyType,
      strategyParams: STRATEGY_PARAMS,
    })
    expect(wr).toBeCloseTo(0.04, 4)
  })
})

describe('buildPlannerResultsPayload', () => {
  it('produces all required keys', () => {
    const payload = buildPlannerResultsPayload({
      result: SAMPLE_RESULT,
      initialPortfolio: 1_000_000,
      currentAge: 30,
      annualExpenses: 50_000,
      lifeExpectancy: 90,
      retirementAge: 55,
      allocationWeights: [0.3, 0.1, 0.1, 0.2, 0.1, 0, 0.2, 0],
      selectedStrategy: 'constant_dollar' as WithdrawalStrategyType,
      strategyParams: STRATEGY_PARAMS,
    })

    expect(payload).toHaveProperty('schemaVersion', 1)
    expect(payload).toHaveProperty('p_success')
    expect(payload).toHaveProperty('WR_critical_50')
    expect(payload).toHaveProperty('horizonYears')
    expect(payload).toHaveProperty('allocationSummary')
    expect(payload).toHaveProperty('fire_age')
    expect(payload).toHaveProperty('portfolio_at_fire')
    expect(payload).toHaveProperty('wr_critical_10')
    expect(payload).toHaveProperty('wr_critical_90')
  })

  it('handles zero expenses without dividing by zero', () => {
    const payload = buildPlannerResultsPayload({
      result: SAMPLE_RESULT,
      initialPortfolio: 1_000_000,
      currentAge: 30,
      annualExpenses: 0,
      lifeExpectancy: 90,
      retirementAge: 55,
      allocationWeights: [0.5, 0, 0, 0.3, 0, 0, 0.2, 0],
      selectedStrategy: 'constant_dollar' as WithdrawalStrategyType,
      strategyParams: STRATEGY_PARAMS,
    })

    expect(payload.fire_age).toBeDefined()
    expect(Number.isFinite(payload.p_success)).toBe(true)
  })

  it('clamps NaN success_rate to 0', () => {
    const badResult = { ...SAMPLE_RESULT, success_rate: NaN }
    const payload = buildPlannerResultsPayload({
      result: badResult,
      initialPortfolio: 1_000_000,
      currentAge: 30,
      annualExpenses: 50_000,
      lifeExpectancy: 90,
      retirementAge: 55,
      allocationWeights: [0.5, 0, 0, 0.3, 0, 0, 0.2, 0],
      selectedStrategy: 'constant_dollar' as WithdrawalStrategyType,
      strategyParams: STRATEGY_PARAMS,
    })

    expect(payload.p_success).toBe(0)
  })
})
