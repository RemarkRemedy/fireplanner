import { describe, it, expect } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import addFormats from 'ajv-formats'
import type { MonteCarloResult, StrategyParamsMap, WithdrawalStrategyType } from '@/lib/types'
import { buildAllocationSummary, deriveWRCritical50, deriveWrSafe50, buildPlannerResultsPayload } from './resultsPayload'
import schema from '../../../docs/sgfireplanner-results-payload-v2.schema.json'

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
    buckets: ['Year 1-10'],
    counts: [100],
    total_failures: 100,
    counts_5y: [30, 70],
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

describe('buildAllocationSummary', () => {
  it('formats standard weights as Stocks/Bonds/Cash', () => {
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

describe('deriveWrSafe50', () => {
  it('prefers optimized confidence_50 when available', () => {
    const wr = deriveWrSafe50({
      result: SAMPLE_RESULT,
      initialPortfolio: 1_000_000,
      selectedStrategy: 'constant_dollar' as WithdrawalStrategyType,
      strategyParams: STRATEGY_PARAMS,
    })
    expect(wr.value).toBeCloseTo(0.047, 4)
    expect(wr.source).toBe('optimized_confidence_50')
  })

  it('falls back to withdrawal band proxy when no confidence_50', () => {
    const noConf50 = {
      ...SAMPLE_RESULT,
      safe_swr: { confidence_95: 0.03, confidence_90: 0.035, confidence_85: 0.04, confidence_50: NaN },
    }
    const wr = deriveWrSafe50({
      result: noConf50,
      initialPortfolio: 1_000_000,
      selectedStrategy: 'constant_dollar' as WithdrawalStrategyType,
      strategyParams: STRATEGY_PARAMS,
    })
    expect(wr.value).toBeCloseTo(0.04, 4) // 40_000 / 1_000_000
    expect(wr.source).toBe('withdrawal_band_proxy')
  })

  it('falls back to strategy proxy for constant_dollar when no bands', () => {
    const noBandsNoConf50 = {
      ...SAMPLE_RESULT,
      safe_swr: { ...SAMPLE_RESULT.safe_swr!, confidence_50: NaN },
      withdrawal_bands: undefined,
    }
    const wr = deriveWrSafe50({
      result: noBandsNoConf50 as MonteCarloResult,
      initialPortfolio: 1_000_000,
      selectedStrategy: 'constant_dollar' as WithdrawalStrategyType,
      strategyParams: STRATEGY_PARAMS,
    })
    expect(wr.value).toBeCloseTo(0.04, 4)
    expect(wr.source).toBe('strategy_proxy')
  })
})

describe('deriveWRCritical50 (legacy compat)', () => {
  it('returns the same value as deriveWrSafe50', () => {
    const args = {
      result: SAMPLE_RESULT,
      initialPortfolio: 1_000_000,
      selectedStrategy: 'constant_dollar' as WithdrawalStrategyType,
      strategyParams: STRATEGY_PARAMS,
    }
    expect(deriveWRCritical50(args)).toBe(deriveWrSafe50(args).value)
  })
})

describe('buildPlannerResultsPayload', () => {
  const BASE_INPUT = {
    result: SAMPLE_RESULT,
    initialPortfolio: 1_000_000,
    currentAge: 30,
    annualIncome: 100_000,
    annualExpenses: 50_000,
    expectedReturn: 0.07,
    inflation: 0.025,
    expenseRatio: 0.003,
    lifeExpectancy: 90,
    retirementAge: 55,
    allocationWeights: [0.3, 0.1, 0.1, 0.2, 0.1, 0, 0.2, 0],
    selectedStrategy: 'constant_dollar' as WithdrawalStrategyType,
    strategyParams: STRATEGY_PARAMS,
    mcMethod: 'parametric' as const,
    scenarioId: 'base',
    scenarioName: 'Base Plan',
  }

  it('produces all required v2 fields', () => {
    const payload = buildPlannerResultsPayload(BASE_INPUT)

    expect(payload.schema_version).toBe(2)
    expect(payload.p_success).toBeCloseTo(0.91, 4)
    expect(payload.wr_safe_50).toBeCloseTo(0.047, 4)
    expect(payload.wr_safe_95).toBeCloseTo(0.03, 4)
    expect(payload.wr_safe_90).toBeCloseTo(0.035, 4)
    expect(payload.wr_safe_85).toBeCloseTo(0.04, 4)
    expect(payload.horizon_years).toBe(35)
    expect(payload.allocation_summary).toBe('Stocks 60 / Bonds 20 / Cash 20')
    expect(payload.computed_at_utc).toBeTruthy()
    expect(payload.scenario_id).toBe('base')
    expect(payload.scenario_name).toBe('Base Plan')
    expect(payload.simulation_method).toBe('parametric')
    expect(payload.n_simulations).toBe(10_000)
    expect(payload.projected_fire_age_p50).toBeDefined()
    expect(payload.portfolio_at_fire_p50).toBeDefined()
    expect(payload.required_portfolio).toBe(1_428_571)
    expect(payload.required_portfolio_basis).toBe('wr_safe_90')
    expect(payload.required_savings_rate).toBeDefined()
    expect(payload.terminal_p5).toBe(10_000)
    expect(payload.terminal_p50).toBe(100_000)
    expect(payload.terminal_p95).toBe(300_000)
    expect(payload.wr_safe_50_source).toBe('optimized_confidence_50')
  })

  it('computes fail_prob_0_5y and fail_prob_6_10y from 5-year bins', () => {
    const payload = buildPlannerResultsPayload(BASE_INPUT)
    // counts_5y: [30, 70], n_simulations: 10_000
    expect(payload.fail_prob_0_5y).toBeCloseTo(0.003, 4) // 30/10000
    expect(payload.fail_prob_6_10y).toBeCloseTo(0.007, 4) // 70/10000
  })

  it('includes allocation_weights object', () => {
    const payload = buildPlannerResultsPayload(BASE_INPUT)
    expect(payload.allocation_weights).toEqual({
      usEquities: 0.3,
      sgEquities: 0.1,
      intlEquities: 0.1,
      bonds: 0.2,
      reits: 0.1,
      gold: 0,
      cash: 0.2,
      cpf: 0,
    })
  })

  it('preserves wr_safe ordering invariant', () => {
    const payload = buildPlannerResultsPayload(BASE_INPUT)
    expect(payload.wr_safe_95!).toBeLessThanOrEqual(payload.wr_safe_90!)
    expect(payload.wr_safe_90!).toBeLessThanOrEqual(payload.wr_safe_85!)
    expect(payload.wr_safe_85!).toBeLessThanOrEqual(payload.wr_safe_50)
  })

  it('handles zero expenses without dividing by zero', () => {
    const payload = buildPlannerResultsPayload({ ...BASE_INPUT, annualExpenses: 0 })
    expect(payload.projected_fire_age_p50).toBeDefined()
    expect(Number.isFinite(payload.p_success)).toBe(true)
    expect(payload.required_savings_rate).toBe(0)
  })

  it('clamps NaN success_rate to 0', () => {
    const badResult = { ...SAMPLE_RESULT, success_rate: NaN }
    const payload = buildPlannerResultsPayload({ ...BASE_INPUT, result: badResult })
    expect(payload.p_success).toBe(0)
  })

  it('computes required_savings_rate from deterministic accumulation assumptions', () => {
    const payload = buildPlannerResultsPayload({
      ...BASE_INPUT,
      initialPortfolio: 200_000,
    })
    expect(payload.required_savings_rate).toBeCloseTo(0.203145, 6)
  })

  it('emits no v1 alias keys', () => {
    const V1_ALIAS_KEYS = [
      'WR_critical_50',
      'WR_critical_90',
      'WR_critical_95',
      'horizonYears',
      'allocationSummary',
      'fire_age',
      'portfolio_at_fire',
    ]
    const payload = buildPlannerResultsPayload(BASE_INPUT)
    const serialized = JSON.parse(JSON.stringify(payload))
    const keys = Object.keys(serialized)
    for (const alias of V1_ALIAS_KEYS) {
      expect(keys).not.toContain(alias)
    }
  })

  it('always sets schema_version to exactly 2', () => {
    const payload = buildPlannerResultsPayload(BASE_INPUT)
    expect(payload.schema_version).toBe(2)
    expect(typeof payload.schema_version).toBe('number')
  })
})

describe('schema conformance', () => {
  it('validates against the canonical JSON Schema', () => {
    const ajv = new Ajv2020({ strict: false })
    addFormats(ajv)
    const validate = ajv.compile(schema)

    const payload = buildPlannerResultsPayload({
      result: SAMPLE_RESULT,
      initialPortfolio: 1_000_000,
      currentAge: 30,
      annualIncome: 100_000,
      annualExpenses: 50_000,
      expectedReturn: 0.07,
      inflation: 0.025,
      expenseRatio: 0.003,
      lifeExpectancy: 90,
      retirementAge: 55,
      allocationWeights: [0.35, 0.15, 0.10, 0.25, 0.05, 0.03, 0.05, 0.02],
      selectedStrategy: 'constant_dollar' as WithdrawalStrategyType,
      strategyParams: STRATEGY_PARAMS,
      mcMethod: 'parametric',
      scenarioId: 'base',
      scenarioName: 'Base Plan',
    })

    // Strip undefined keys (JSON.stringify does this naturally)
    const serialized = JSON.parse(JSON.stringify(payload))
    const valid = validate(serialized)
    if (!valid) {
      console.error('Schema validation errors:', validate.errors)
    }
    expect(valid).toBe(true)
  })
})
