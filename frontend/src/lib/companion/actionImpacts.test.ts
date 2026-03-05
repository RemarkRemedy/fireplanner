import { describe, it, expect, vi } from 'vitest'
import {
  ACTION_LEVERS,
  extractImpactMetrics,
  buildLeverOverrides,
  computeActionImpacts,
  runActionImpactAnalysis,
  type ActionImpactMetrics,
  type LeverContext,
} from './actionImpacts'
import type { MonteCarloResult, StrategyParamsMap } from '@/lib/types'
import { runMonteCarloWorker } from '@/lib/simulation/workerClient'

vi.mock('@/lib/simulation/workerClient', () => ({
  runMonteCarloWorker: vi.fn(),
}))
vi.mock('@/lib/simulation/monteCarloParams', () => ({
  buildMonteCarloEngineParams: vi.fn(() => ({})),
}))

// ── Fixtures ──────────────────────────────────────────────

const SAMPLE_RESULT: MonteCarloResult = {
  success_rate: 0.91,
  percentile_bands: {
    years: [0], ages: [30], p5: [100_000], p10: [100_000],
    p25: [100_000], p50: [100_000], p75: [100_000], p90: [100_000], p95: [100_000],
  },
  terminal_stats: { median: 100_000, mean: 120_000, worst: 5_000, best: 400_000, p5: 10_000, p95: 300_000 },
  safe_swr: { confidence_95: 0.03, confidence_90: 0.035, confidence_85: 0.04, confidence_50: 0.047 },
  failure_distribution: {
    buckets: ['Year 1-5', 'Year 6-10'],
    counts: [30, 70],
    total_failures: 100,
    counts_5y: [30, 70],
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

const BASE_CTX: LeverContext = {
  annualExpenses: 50_000,
  retirementAge: 55,
  lifeExpectancy: 90,
  annualIncome: 100_000,
  currentWeights: [0.3, 0.1, 0.1, 0.2, 0.1, 0, 0.2, 0],
  selectedStrategy: 'constant_dollar',
  strategyParams: STRATEGY_PARAMS,
  withdrawalBasis: 'rate',
}

// ── Tests ─────────────────────────────────────────────────

describe('ACTION_LEVERS', () => {
  it('defines exactly 5 levers', () => {
    expect(ACTION_LEVERS).toHaveLength(5)
  })

  it('has unique ids', () => {
    const ids = ACTION_LEVERS.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('covers all lifecycle types', () => {
    const types = new Set(ACTION_LEVERS.map((l) => l.applicableTo))
    expect(types).toContain('all')
    expect(types).toContain('accumulator')
    expect(types).toContain('retiree')
  })
})

describe('extractImpactMetrics', () => {
  it('extracts p_success and failure probabilities', () => {
    const metrics = extractImpactMetrics(SAMPLE_RESULT)
    expect(metrics.p_success).toBeCloseTo(0.91, 4)
    expect(metrics.fail_prob_0_5y).toBeCloseTo(0.003, 4) // 30/10000
    expect(metrics.fail_prob_6_10y).toBeCloseTo(0.007, 4) // 70/10000
  })

  it('handles zero simulations gracefully', () => {
    const result = { ...SAMPLE_RESULT, n_simulations: 0 }
    const metrics = extractImpactMetrics(result)
    // Division by zero should be clamped to 1 (max)
    expect(metrics.fail_prob_0_5y).toBeLessThanOrEqual(1)
    expect(metrics.fail_prob_6_10y).toBeLessThanOrEqual(1)
  })

  it('clamps values to [0, 1]', () => {
    const result = { ...SAMPLE_RESULT, success_rate: 1.5 }
    const metrics = extractImpactMetrics(result)
    expect(metrics.p_success).toBeLessThanOrEqual(1)
  })
})

describe('buildLeverOverrides', () => {
  const savingsLever = ACTION_LEVERS.find((l) => l.id === 'savings_rate_up_2pp')!
  const expenseLever = ACTION_LEVERS.find((l) => l.id === 'expenses_down_10pct')!
  const retireLever = ACTION_LEVERS.find((l) => l.id === 'retire_2y_later')!
  const withdrawalLever = ACTION_LEVERS.find((l) => l.id === 'withdrawal_down_10pct')!
  const deriskLever = ACTION_LEVERS.find((l) => l.id === 'derisk_10pp')!

  it('savings_rate_up_2pp reduces expenses by 2% of income', () => {
    const overrides = buildLeverOverrides(savingsLever, BASE_CTX)
    // 0.02 * 100_000 = 2_000 reduction
    expect(overrides.profileOverrides?.annualExpenses).toBeCloseTo(48_000)
  })

  it('expenses_down_10pct reduces expenses by 10%', () => {
    const overrides = buildLeverOverrides(expenseLever, BASE_CTX)
    expect(overrides.profileOverrides?.annualExpenses).toBeCloseTo(45_000)
  })

  it('retire_2y_later increases retirement age by 2', () => {
    const overrides = buildLeverOverrides(retireLever, BASE_CTX)
    expect(overrides.profileOverrides?.retirementAge).toBe(57)
  })

  it('retire_2y_later caps at lifeExpectancy - 1', () => {
    const ctx = { ...BASE_CTX, retirementAge: 89, lifeExpectancy: 90 }
    const overrides = buildLeverOverrides(retireLever, ctx)
    expect(overrides.profileOverrides?.retirementAge).toBe(89)
  })

  it('withdrawal_down_10pct scales constant_dollar swr by 0.9', () => {
    const overrides = buildLeverOverrides(withdrawalLever, BASE_CTX)
    const modified = overrides.simulationOverrides?.strategyParams
    expect(modified?.constant_dollar.swr).toBeCloseTo(0.036)
  })

  it('withdrawal_down_10pct scales guardrails initialRate by 0.9', () => {
    const ctx = { ...BASE_CTX, selectedStrategy: 'guardrails' as const }
    const overrides = buildLeverOverrides(withdrawalLever, ctx)
    const modified = overrides.simulationOverrides?.strategyParams
    expect(modified?.guardrails.initialRate).toBeCloseTo(0.036)
  })

  it('derisk_10pp shifts 10pp from equities to bonds/cash', () => {
    const overrides = buildLeverOverrides(deriskLever, BASE_CTX)
    const weights = overrides.allocationWeights!
    // Original equities: 0.3 + 0.1 + 0.1 + 0.1 = 0.6
    // After: should be 0.5 total equities
    const newEquity = weights[0] + weights[1] + weights[2] + weights[4]
    expect(newEquity).toBeCloseTo(0.5, 4)
    // Bonds and cash each get +0.05
    expect(weights[3]).toBeCloseTo(0.25, 4) // was 0.2
    expect(weights[6]).toBeCloseTo(0.25, 4) // was 0.2
  })

  it('derisk_10pp handles low equity allocation', () => {
    const ctx = { ...BASE_CTX, currentWeights: [0.03, 0, 0, 0.5, 0, 0, 0.47, 0] }
    const overrides = buildLeverOverrides(deriskLever, ctx)
    const weights = overrides.allocationWeights!
    // Only 3% equity, can't shift 10pp — shifts all 3%
    expect(weights[0]).toBeCloseTo(0, 4)
    const totalEquity = weights[0] + weights[1] + weights[2] + weights[4]
    expect(totalEquity).toBeCloseTo(0, 4)
  })
})

describe('computeActionImpacts', () => {
  const baseMetrics: ActionImpactMetrics = {
    p_success: 0.85,
    fail_prob_0_5y: 0.02,
    fail_prob_6_10y: 0.03,
  }

  it('ranks by delta_p_success descending', () => {
    const impacts = computeActionImpacts(baseMetrics, [
      { lever: ACTION_LEVERS[0], metrics: { p_success: 0.87, fail_prob_0_5y: 0.02, fail_prob_6_10y: 0.03 } },
      { lever: ACTION_LEVERS[1], metrics: { p_success: 0.92, fail_prob_0_5y: 0.01, fail_prob_6_10y: 0.02 } },
      { lever: ACTION_LEVERS[2], metrics: { p_success: 0.90, fail_prob_0_5y: 0.015, fail_prob_6_10y: 0.025 } },
    ])

    expect(impacts[0].lever.id).toBe(ACTION_LEVERS[1].id) // +7pp
    expect(impacts[1].lever.id).toBe(ACTION_LEVERS[2].id) // +5pp
    expect(impacts[2].lever.id).toBe(ACTION_LEVERS[0].id) // +2pp
  })

  it('uses fail_prob_0_5y as tiebreaker', () => {
    const impacts = computeActionImpacts(baseMetrics, [
      { lever: ACTION_LEVERS[0], metrics: { p_success: 0.90, fail_prob_0_5y: 0.01, fail_prob_6_10y: 0.03 } },
      { lever: ACTION_LEVERS[1], metrics: { p_success: 0.90, fail_prob_0_5y: 0.005, fail_prob_6_10y: 0.03 } },
    ])

    // Same delta_p_success, but lever 1 has lower fail_prob_0_5y
    expect(impacts[0].lever.id).toBe(ACTION_LEVERS[1].id)
  })

  it('computes deltas correctly', () => {
    const impacts = computeActionImpacts(baseMetrics, [
      { lever: ACTION_LEVERS[0], metrics: { p_success: 0.90, fail_prob_0_5y: 0.01, fail_prob_6_10y: 0.025 } },
    ])

    expect(impacts[0].delta_p_success).toBeCloseTo(0.05)
    expect(impacts[0].delta_fail_prob_0_5y).toBeCloseTo(-0.01)
    expect(impacts[0].delta_fail_prob_6_10y).toBeCloseTo(-0.005)
  })

  it('generates rationale text', () => {
    const impacts = computeActionImpacts(baseMetrics, [
      { lever: ACTION_LEVERS[0], metrics: { p_success: 0.90, fail_prob_0_5y: 0.01, fail_prob_6_10y: 0.03 } },
    ])

    expect(impacts[0].rationale).toContain('improves')
    expect(impacts[0].rationale).toContain('5.0pp')
  })

  it('handles negligible impacts', () => {
    const impacts = computeActionImpacts(baseMetrics, [
      { lever: ACTION_LEVERS[0], metrics: { p_success: 0.8501, fail_prob_0_5y: 0.0201, fail_prob_6_10y: 0.03 } },
    ])

    expect(impacts[0].rationale).toContain('negligible')
  })

  it('handles empty lever results', () => {
    const impacts = computeActionImpacts(baseMetrics, [])
    expect(impacts).toHaveLength(0)
  })

  it('handles negative deltas (lever worsens outcome)', () => {
    const impacts = computeActionImpacts(baseMetrics, [
      { lever: ACTION_LEVERS[0], metrics: { p_success: 0.80, fail_prob_0_5y: 0.03, fail_prob_6_10y: 0.04 } },
    ])

    expect(impacts[0].delta_p_success).toBeCloseTo(-0.05)
    expect(impacts[0].rationale).toContain('reduces')
  })
})

describe('deterministic output bounds', () => {
  it('extractImpactMetrics always returns values in [0, 1]', () => {
    const edgeCases = [
      { ...SAMPLE_RESULT, success_rate: -0.5 },
      { ...SAMPLE_RESULT, success_rate: 2.0 },
      { ...SAMPLE_RESULT, n_simulations: 1 },
      { ...SAMPLE_RESULT, failure_distribution: { ...SAMPLE_RESULT.failure_distribution, counts_5y: [10000, 10000] as [number, number] } },
    ]

    for (const result of edgeCases) {
      const metrics = extractImpactMetrics(result)
      expect(metrics.p_success).toBeGreaterThanOrEqual(0)
      expect(metrics.p_success).toBeLessThanOrEqual(1)
      expect(metrics.fail_prob_0_5y).toBeGreaterThanOrEqual(0)
      expect(metrics.fail_prob_0_5y).toBeLessThanOrEqual(1)
      expect(metrics.fail_prob_6_10y).toBeGreaterThanOrEqual(0)
      expect(metrics.fail_prob_6_10y).toBeLessThanOrEqual(1)
    }
  })

  it('buildLeverOverrides never produces negative expenses', () => {
    const ctx = { ...BASE_CTX, annualExpenses: 100, annualIncome: 1_000_000 }
    const lever = ACTION_LEVERS.find((l) => l.id === 'savings_rate_up_2pp')!
    const overrides = buildLeverOverrides(lever, ctx)
    // 2% of 1M = 20K reduction from 100 => clamped to 0
    expect(overrides.profileOverrides?.annualExpenses).toBeGreaterThanOrEqual(0)
  })

  it('buildLeverOverrides withdrawal scaling preserves non-negative rates', () => {
    const withdrawalLever = ACTION_LEVERS.find((l) => l.id === 'withdrawal_down_10pct')!
    const ctx = { ...BASE_CTX, selectedStrategy: 'constant_dollar' as const }
    const overrides = buildLeverOverrides(withdrawalLever, ctx)
    const swr = overrides.simulationOverrides?.strategyParams?.constant_dollar.swr ?? 0
    expect(swr).toBeGreaterThanOrEqual(0)
  })

  it('buildLeverOverrides de-risk weights sum to exactly 1 after renormalization', () => {
    const deriskLever = ACTION_LEVERS.find((l) => l.id === 'derisk_10pp')!
    const overrides = buildLeverOverrides(deriskLever, BASE_CTX)
    const weights = overrides.allocationWeights!
    const sum = weights.reduce((a, b) => a + b, 0)
    expect(Math.abs(sum - 1.0)).toBeLessThan(1e-10)
  })

  it('withdrawal_down_10pct returns unmodified params for vpw (no primary rate)', () => {
    const withdrawalLever = ACTION_LEVERS.find((l) => l.id === 'withdrawal_down_10pct')!
    const ctx = { ...BASE_CTX, selectedStrategy: 'vpw' as const }
    const overrides = buildLeverOverrides(withdrawalLever, ctx)
    const modified = overrides.simulationOverrides?.strategyParams
    expect(modified?.vpw).toEqual(STRATEGY_PARAMS.vpw)
  })
})

describe('runActionImpactAnalysis', () => {
  const mockedRunMC = vi.mocked(runMonteCarloWorker)

  const MOCK_PROFILE = {
    currentAge: 30, retirementAge: 55, lifeExpectancy: 90,
    annualExpenses: 50_000, annualIncome: 100_000,
    liquidNetWorth: 100_000, cpfOA: 0, cpfSA: 0, cpfMA: 0, cpfRA: 0,
  } as never
  const MOCK_INCOME = {} as never
  const MOCK_ALLOCATION = { currentWeights: BASE_CTX.currentWeights } as never
  const MOCK_SIMULATION = {
    selectedStrategy: 'constant_dollar',
    strategyParams: STRATEGY_PARAMS,
    withdrawalBasis: 'rate',
  } as never
  const MOCK_PROPERTY = {} as never

  function makeMockResult(successRate: number): MonteCarloResult {
    return {
      ...SAMPLE_RESULT,
      success_rate: successRate,
    }
  }

  it('calls onProgress for each completed lever', async () => {
    mockedRunMC.mockResolvedValue(makeMockResult(0.92))
    const progress: Array<[number, number]> = []

    await runActionImpactAnalysis({
      profile: MOCK_PROFILE,
      income: MOCK_INCOME,
      allocation: MOCK_ALLOCATION,
      simulation: MOCK_SIMULATION,
      property: MOCK_PROPERTY,
      initialPortfolio: 500_000,
      allocationWeights: BASE_CTX.currentWeights,
      baseResult: SAMPLE_RESULT,
      isRetiree: false,
      annualIncome: 100_000,
      onProgress: (completed, total) => progress.push([completed, total]),
    })

    expect(progress.length).toBeGreaterThan(0)
    // Each progress call should have incrementing completed
    for (let i = 1; i < progress.length; i++) {
      expect(progress[i][0]).toBe(progress[i - 1][0] + 1)
    }
  })

  it('stops on abort and returns partial results', async () => {
    let callCount = 0
    mockedRunMC.mockImplementation(async () => {
      callCount++
      if (callCount >= 2) {
        // Simulate abort after 1st lever
        throw new DOMException('Aborted', 'AbortError')
      }
      return makeMockResult(0.93)
    })

    const controller = new AbortController()
    const output = await runActionImpactAnalysis({
      profile: MOCK_PROFILE,
      income: MOCK_INCOME,
      allocation: MOCK_ALLOCATION,
      simulation: MOCK_SIMULATION,
      property: MOCK_PROPERTY,
      initialPortfolio: 500_000,
      allocationWeights: BASE_CTX.currentWeights,
      baseResult: SAMPLE_RESULT,
      isRetiree: false,
      annualIncome: 100_000,
      signal: controller.signal,
    })

    // Should have partial results (1 lever completed before abort)
    expect(output.completedLevers).toBe(1)
    expect(output.impacts.length).toBe(1)
  })

  it('filters out withdrawal_down_10pct when withdrawalBasis is expenses', async () => {
    mockedRunMC.mockResolvedValue(makeMockResult(0.90))

    const output = await runActionImpactAnalysis({
      profile: MOCK_PROFILE,
      income: MOCK_INCOME,
      allocation: MOCK_ALLOCATION,
      simulation: {
        selectedStrategy: 'constant_dollar',
        strategyParams: STRATEGY_PARAMS,
        withdrawalBasis: 'expenses',
      } as never,
      property: MOCK_PROPERTY,
      initialPortfolio: 500_000,
      allocationWeights: BASE_CTX.currentWeights,
      baseResult: SAMPLE_RESULT,
      isRetiree: true, // retiree so withdrawal_down_10pct would normally apply
      annualIncome: 100_000,
    })

    const leverIds = output.impacts.map((i) => i.lever.id)
    expect(leverIds).not.toContain('withdrawal_down_10pct')
  })
})
