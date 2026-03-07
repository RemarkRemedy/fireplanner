import type { MonteCarloResult, StrategyParamsMap, WithdrawalStrategyType, MonteCarloMethod } from '@/lib/types'
import { SCHEMA_VERSION, type PlannerResultsPayload, type AllocationWeights, type WrSafe50Source } from './types'
import { clamp01 } from './utils'

const MIN_WR_DENOMINATOR = 0.0001

function roundRate(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

function roundMoney(value: number): number {
  return Math.round(value)
}

function toPercent(weight: number): number {
  return Math.round(Math.max(0, weight) * 100)
}

// --- Allocation ---

export function buildAllocationSummary(allocationWeights: number[]): string {
  const safe = (idx: number) => allocationWeights[idx] ?? 0

  const stocks = safe(0) + safe(1) + safe(2) + safe(4) // US, SG, Intl, REITs
  const bonds = safe(3)
  const cash = safe(6)
  const gold = safe(5)
  const cpf = safe(7)

  const parts: Array<[string, number]> = [
    ['Stocks', stocks],
    ['Bonds', bonds],
    ['Cash', cash],
  ]
  if (gold >= 0.005) parts.push(['Gold', gold])
  if (cpf >= 0.005) parts.push(['CPF', cpf])

  return parts
    .map(([label, weight]) => `${label} ${toPercent(weight)}`)
    .join(' / ')
}

function buildAllocationWeightsObj(weights: number[]): AllocationWeights {
  const safe = (idx: number) => weights[idx] ?? 0
  return {
    usEquities: safe(0),
    sgEquities: safe(1),
    intlEquities: safe(2),
    bonds: safe(3),
    reits: safe(4),
    gold: safe(5),
    cash: safe(6),
    cpf: safe(7),
  }
}

// --- Withdrawal rate derivation ---

function deriveWRFromBand(
  result: MonteCarloResult,
  initialPortfolio: number,
  bandKey: 'p10' | 'p50' | 'p90',
): number | null {
  const value = result.withdrawal_bands?.[bandKey]?.[0]
  if (typeof value !== 'number' || !Number.isFinite(value) || initialPortfolio <= 0) return null
  return roundRate(clamp01(value / initialPortfolio))
}

interface WrSafe50Result {
  value: number
  source: WrSafe50Source
}

export function deriveWrSafe50(input: {
  result: MonteCarloResult
  initialPortfolio: number
  selectedStrategy: WithdrawalStrategyType
  strategyParams: StrategyParamsMap
}): WrSafe50Result {
  const { result, initialPortfolio, selectedStrategy, strategyParams } = input

  // Prefer true optimized confidence_50 from SWR optimizer
  if (result.safe_swr?.confidence_50 != null && Number.isFinite(result.safe_swr.confidence_50)) {
    return { value: roundRate(clamp01(result.safe_swr.confidence_50)), source: 'optimized_confidence_50' }
  }

  // Fallback: withdrawal band p50 proxy
  const fromBands = deriveWRFromBand(result, initialPortfolio, 'p50')
  if (fromBands !== null) {
    return { value: fromBands, source: 'withdrawal_band_proxy' }
  }

  // Fallback: strategy parameter proxy
  if (selectedStrategy === 'constant_dollar') {
    return { value: roundRate(clamp01(strategyParams.constant_dollar.swr)), source: 'strategy_proxy' }
  }
  if (result.safe_swr?.confidence_85 != null) {
    return { value: roundRate(clamp01(result.safe_swr.confidence_85)), source: 'strategy_proxy' }
  }

  return { value: 0, source: 'strategy_proxy' }
}

// Legacy export for backward compat in tests — delegates to deriveWrSafe50
export function deriveWRCritical50(input: {
  result: MonteCarloResult
  initialPortfolio: number
  selectedStrategy: WithdrawalStrategyType
  strategyParams: StrategyParamsMap
}): number {
  return deriveWrSafe50(input).value
}

// --- Results payload builder ---

export interface BuildPayloadInput {
  result: MonteCarloResult
  initialPortfolio: number
  currentAge: number
  annualIncome: number
  annualExpenses: number
  expectedReturn: number
  inflation: number
  expenseRatio: number
  lifeExpectancy: number
  retirementAge: number
  allocationWeights: number[]
  selectedStrategy: WithdrawalStrategyType
  strategyParams: StrategyParamsMap
  mcMethod?: MonteCarloMethod
  scenarioId?: string
  scenarioName?: string
}

export function buildPlannerResultsPayload(input: BuildPayloadInput): PlannerResultsPayload {
  const {
    result,
    initialPortfolio,
    currentAge,
    annualIncome,
    annualExpenses,
    expectedReturn,
    inflation,
    expenseRatio,
    lifeExpectancy,
    retirementAge,
    allocationWeights,
    selectedStrategy,
    strategyParams,
    mcMethod,
    scenarioId,
    scenarioName,
  } = input

  const wrSafe50 = deriveWrSafe50({ result, initialPortfolio, selectedStrategy, strategyParams })

  const wrSafe95 = result.safe_swr?.confidence_95 != null
    ? roundRate(clamp01(result.safe_swr.confidence_95))
    : wrSafe50.value
  const wrSafe90 = result.safe_swr?.confidence_90 != null
    ? roundRate(clamp01(result.safe_swr.confidence_90))
    : wrSafe50.value
  const wrSafe85 = result.safe_swr?.confidence_85 != null
    ? roundRate(clamp01(result.safe_swr.confidence_85))
    : wrSafe50.value
  const planningSafeRate = Math.max(wrSafe90, MIN_WR_DENOMINATOR)
  const requiredPortfolio = annualExpenses <= 0 ? 0 : annualExpenses / planningSafeRate

  const requiredSavingsRate = deriveRequiredSavingsRate({
    annualIncome,
    currentAge,
    expenseRatio,
    expectedReturn,
    inflation,
    initialPortfolio,
    requiredPortfolio,
    retirementAge,
  })

  // FIRE age: first age where median portfolio >= required
  let fireAge = Math.round(retirementAge)

  const ages = result.percentile_bands.ages
  const medians = result.percentile_bands.p50
  const startIdx = ages.findIndex((age) => age >= currentAge)
  if (startIdx >= 0) {
    for (let i = startIdx; i < ages.length; i += 1) {
      if ((medians[i] ?? 0) >= requiredPortfolio) {
        fireAge = Math.round(ages[i])
        break
      }
    }
  }

  // Portfolio at retirement
  const retirementIdx = ages.findIndex((age) => Math.round(age) >= Math.round(retirementAge))
  const portfolioAtFire = retirementIdx >= 0 && retirementIdx < medians.length
    ? roundMoney(medians[retirementIdx])
    : roundMoney(result.terminal_stats.median)

  const horizonYears = Math.max(1, Math.round(lifeExpectancy - retirementAge))

  // Failure probabilities from 5-year bins
  const nSims = result.n_simulations || 1
  const [fail04, fail59] = result.failure_distribution.counts_5y
  const failProb05y = roundRate(clamp01(fail04 / nSims))
  const failProb610y = roundRate(clamp01(fail59 / nSims))

  // Simulation method mapping
  const simulationMethod = mcMethod ?? undefined

  return {
    schema_version: SCHEMA_VERSION as 2,
    computed_at_utc: new Date().toISOString(),
    input_signature: undefined,
    scenario_id: scenarioId,
    scenario_name: scenarioName,
    simulation_method: simulationMethod,
    n_simulations: result.n_simulations,
    computation_time_ms: result.computation_time_ms,
    cached: result.cached,
    horizon_years: horizonYears,
    target_fire_age: Math.round(retirementAge),
    projected_fire_age_p50: fireAge,
    annual_expenses_target_real: roundMoney(annualExpenses),
    required_portfolio: roundMoney(requiredPortfolio),
    required_portfolio_basis: 'wr_safe_90',
    required_savings_rate: requiredSavingsRate,
    p_success: roundRate(clamp01(result.success_rate)),
    wr_safe_95: wrSafe95,
    wr_safe_90: wrSafe90,
    wr_safe_85: wrSafe85,
    wr_safe_50: wrSafe50.value,
    wr_safe_50_source: wrSafe50.source,
    fail_prob_0_5y: failProb05y,
    fail_prob_6_10y: failProb610y,
    terminal_p5: roundMoney(result.terminal_stats.p5),
    terminal_p50: roundMoney(result.terminal_stats.median),
    terminal_p95: roundMoney(result.terminal_stats.p95),
    portfolio_at_fire_p50: portfolioAtFire,
    allocation_summary: buildAllocationSummary(allocationWeights),
    allocation_weights: buildAllocationWeightsObj(allocationWeights),
  }
}

function deriveRequiredSavingsRate(input: {
  annualIncome: number
  currentAge: number
  expenseRatio: number
  expectedReturn: number
  inflation: number
  initialPortfolio: number
  requiredPortfolio: number
  retirementAge: number
}): number | undefined {
  const {
    annualIncome,
    currentAge,
    expenseRatio,
    expectedReturn,
    inflation,
    initialPortfolio,
    requiredPortfolio,
    retirementAge,
  } = input

  if (!Number.isFinite(annualIncome) || annualIncome === 0) {
    return requiredPortfolio <= initialPortfolio ? 0 : undefined
  }

  const yearsToTarget = Math.max(0, retirementAge - currentAge)
  if (requiredPortfolio <= initialPortfolio) return 0

  let requiredAnnualSavings: number
  if (yearsToTarget === 0) {
    requiredAnnualSavings = requiredPortfolio - initialPortfolio
  } else {
    const netRealReturn = expectedReturn - inflation - expenseRatio
    if (Math.abs(netRealReturn) < 1e-10) {
      requiredAnnualSavings = (requiredPortfolio - initialPortfolio) / yearsToTarget
    } else {
      const growthFactor = Math.pow(1 + netRealReturn, yearsToTarget)
      requiredAnnualSavings = (requiredPortfolio - initialPortfolio * growthFactor)
        * netRealReturn
        / (growthFactor - 1)
    }
  }

  return clampRequiredSavingsRate(requiredAnnualSavings / annualIncome)
}

function clampRequiredSavingsRate(value: number): number {
  return roundRate(Math.min(2, Math.max(-1, value)))
}
