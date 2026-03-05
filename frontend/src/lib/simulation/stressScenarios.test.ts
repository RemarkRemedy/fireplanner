import { describe, expect, it } from 'vitest'
import {
  applyStressScenario,
  buildStressScenarioComparisonRow,
  buildStressScenarioRunPlan,
  computeWorstYearDrawdown,
  type StressScenarioId,
} from './stressScenarios'
import type { MonteCarloEngineParams } from './monteCarlo'
import type { MonteCarloResult } from '@/lib/types'

const BASE_PARAMS: MonteCarloEngineParams = {
  initialPortfolio: 1_000_000,
  allocationWeights: [0.7, 0.1, 0.05, 0.1, 0.02, 0.01, 0.01, 0.01],
  expectedReturns: [0.08, 0.09, 0.07, 0.03, 0.06, 0.02, 0.01, 0.025],
  stdDevs: [0.16, 0.18, 0.15, 0.06, 0.12, 0.09, 0.01, 0.05],
  correlationMatrix: Array.from({ length: 8 }, (_, i) =>
    Array.from({ length: 8 }, (_, j) => (i === j ? 1 : 0.2))
  ),
  currentAge: 40,
  retirementAge: 65,
  lifeExpectancy: 90,
  annualSavings: Array.from({ length: 25 }, () => 30_000),
  postRetirementIncome: Array.from({ length: 25 }, () => 20_000),
  method: 'parametric',
  nSimulations: 1_000,
  withdrawalStrategy: 'constant_dollar',
  strategyParams: { swr: 0.04 },
  expenseRatio: 0.003,
  inflation: 0.025,
  withdrawalBasis: 'expenses',
}

const BASE_RESULT: MonteCarloResult = {
  success_rate: 0.81,
  percentile_bands: {
    years: [0],
    ages: [65],
    p5: [10],
    p10: [20],
    p25: [30],
    p50: [40],
    p75: [50],
    p90: [60],
    p95: [70],
  },
  terminal_stats: {
    median: 2_300_000,
    mean: 2_500_000,
    worst: 100_000,
    best: 7_000_000,
    p5: 300_000,
    p95: 6_000_000,
  },
  safe_swr: null,
  failure_distribution: {
    buckets: ['Year 1-10', 'Year 11-20'],
    counts: [0, 120],
    total_failures: 120,
    counts_5y: [0, 0],
  },
  withdrawal_bands: {
    years: [0],
    ages: [65],
    p5: [10_000],
    p10: [20_000],
    p25: [30_000],
    p50: [40_000],
    p75: [50_000],
    p90: [60_000],
    p95: [70_000],
  },
  n_simulations: 1_000,
  computation_time_ms: 10,
  cached: false,
}

describe('stressScenarios', () => {
  it('applies market crash forced return path', () => {
    const stressed = applyStressScenario(BASE_PARAMS, 'market-crash')
    expect(stressed.forcedPortfolioReturns?.slice(0, 3)).toEqual([-0.30, -0.10, 0.05])
  })

  it('applies inflation spike for first 5 years', () => {
    const stressed = applyStressScenario(BASE_PARAMS, 'inflation-spike')
    expect(stressed.yearlyInflationRates?.slice(0, 5)).toEqual([0.06, 0.06, 0.06, 0.06, 0.06])
  })

  it('extends longevity by 10 years', () => {
    const stressed = applyStressScenario(BASE_PARAMS, 'longevity-risk')
    expect(stressed.lifeExpectancy).toBe(BASE_PARAMS.lifeExpectancy + 10)
  })

  it('builds run plan for selected scenarios', () => {
    const selected: StressScenarioId[] = ['base', 'market-crash', 'longevity-risk']
    const runs = buildStressScenarioRunPlan(BASE_PARAMS, selected)
    expect(runs.map((run) => run.scenarioId)).toEqual(selected)
  })

  it('builds comparison row with failure age from earliest failure bucket', () => {
    const row = buildStressScenarioComparisonRow('base', BASE_RESULT, 70, 40)
    expect(row.successRate).toBe(0.81)
    expect(row.medianTerminalWealth).toBe(2_300_000)
    expect(row.failureAge).toBe(80)
    // BASE_RESULT p50 has only 1 element, decum slice has at most 1 element → null
    expect(row.worstYearDrawdown).toBeNull()
  })

  it('computes worstYearDrawdown from decumulation-only p50 slice', () => {
    const resultWithPath: MonteCarloResult = {
      ...BASE_RESULT,
      percentile_bands: {
        ...BASE_RESULT.percentile_bands,
        // 5 years: ages 40-44 accumulation, ages 45-49 decumulation
        p50: [100_000, 130_000, 160_000, 200_000, 250_000, 240_000, 220_000, 230_000, 210_000, 250_000],
      },
    }
    // retirementAge=45, currentAge=40 → decumStartIdx=5 → decumP50=[240k,220k,230k,210k,250k]
    const row = buildStressScenarioComparisonRow('base', resultWithPath, 45, 40)
    // decumP50 = [240k, 220k, 230k, 210k, 250k]
    // Year-over-year: -8.3%, +4.5%, -8.7%, +19.0%
    // Worst = (210k - 230k) / 230k = -0.0869...
    expect(row.worstYearDrawdown).toBeCloseTo((210_000 - 230_000) / 230_000, 10)
  })
})

describe('computeWorstYearDrawdown', () => {
  it('returns null for fewer than 2 values', () => {
    expect(computeWorstYearDrawdown([])).toBeNull()
    expect(computeWorstYearDrawdown([100])).toBeNull()
  })

  it('returns null when there are no declines', () => {
    expect(computeWorstYearDrawdown([100, 110, 120])).toBeNull()
  })

  it('finds the worst year-over-year decline', () => {
    // 100 → 80 = -20%, 80 → 90 = +12.5%, 90 → 70 = -22.2%
    const result = computeWorstYearDrawdown([100, 80, 90, 70])
    expect(result).toBeCloseTo((70 - 90) / 90, 10)
  })

  it('skips zero-value predecessors to avoid division by zero', () => {
    const result = computeWorstYearDrawdown([0, 100, 90])
    // First pair skipped (prev=0), second pair: (90-100)/100 = -0.10
    expect(result).toBeCloseTo(-0.10, 10)
  })
})
