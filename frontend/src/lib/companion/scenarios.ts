import type { MonteCarloResult, StrategyParamsMap, WithdrawalStrategyType } from '@/lib/types'
import { SCHEMA_VERSION, type PlannerResultsPayload } from './types'

const MIN_WR_DENOMINATOR = 0.0001

export interface CompanionScenarioOverrides {
  monthlyExpenseDelta?: number
  retirementAge?: number
}

export interface CompanionScenario {
  id: string
  name: string
  overrides: CompanionScenarioOverrides
}

export function createCompanionScenarios(baseRetirementAge: number): CompanionScenario[] {
  return [
    { id: 'base', name: 'Base', overrides: {} },
    { id: 'cut-300', name: 'Cut $300/mo', overrides: { monthlyExpenseDelta: -300 } },
    { id: 'boost-500', name: 'Boost Savings $500/mo', overrides: { monthlyExpenseDelta: -500 } },
    { id: 'retire-5-earlier', name: 'Retire 5 years earlier', overrides: { retirementAge: Math.max(35, Math.round(baseRetirementAge - 5)) } },
    { id: 'conservative-spending', name: 'Conservative spending', overrides: { monthlyExpenseDelta: -1000 } },
  ]
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number') return null
  if (!Number.isFinite(value)) return null
  return value
}

function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function roundRate(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

function roundMoney(value: number): number {
  return Math.round(value)
}

export function resolveScenarioInputs(input: {
  baseAnnualExpenses: number
  baseRetirementAge: number
  overrides: CompanionScenarioOverrides
  minRetirementAge?: number
  maxRetirementAge?: number
}): { annualExpenses: number; retirementAge: number } {
  const { baseAnnualExpenses, baseRetirementAge, overrides } = input
  const monthlyDelta = toFiniteNumber(overrides.monthlyExpenseDelta) ?? 0
  const annualExpenses = Math.max(0, baseAnnualExpenses + monthlyDelta * 12)
  const minRetirementAge = Math.max(35, Math.round(toFiniteNumber(input.minRetirementAge) ?? 35))
  const maxRetirementAgeRaw = toFiniteNumber(input.maxRetirementAge)
  const maxRetirementAge = maxRetirementAgeRaw == null
    ? Number.POSITIVE_INFINITY
    : Math.max(minRetirementAge, Math.round(maxRetirementAgeRaw))
  const rawRetirementAge = Math.round(toFiniteNumber(overrides.retirementAge) ?? baseRetirementAge)
  const retirementAge = Math.min(maxRetirementAge, Math.max(minRetirementAge, rawRetirementAge))
  return { annualExpenses, retirementAge }
}

// --- Allocation summary ---

function toPercent(weight: number): number {
  return Math.round(Math.max(0, weight) * 100)
}

export function buildAllocationSummary(allocationWeights: number[]): string {
  const safe = (idx: number) => allocationWeights[idx] ?? 0

  // Aggregate 8 asset classes into display groups
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

export function deriveWRCritical50(input: {
  result: MonteCarloResult
  initialPortfolio: number
  selectedStrategy: WithdrawalStrategyType
  strategyParams: StrategyParamsMap
}): number {
  const { result, initialPortfolio, selectedStrategy, strategyParams } = input
  const fromBands = deriveWRFromBand(result, initialPortfolio, 'p50')
  if (fromBands !== null) return fromBands

  if (selectedStrategy === 'constant_dollar') {
    return roundRate(clamp01(strategyParams.constant_dollar.swr))
  }

  if (result.safe_swr?.confidence_85 != null) {
    return roundRate(clamp01(result.safe_swr.confidence_85))
  }

  return 0
}

// --- Results payload builder ---

export function buildPlannerResultsPayload(input: {
  result: MonteCarloResult
  initialPortfolio: number
  currentAge: number
  annualExpenses: number
  lifeExpectancy: number
  retirementAge: number
  allocationWeights: number[]
  selectedStrategy: WithdrawalStrategyType
  strategyParams: StrategyParamsMap
}): PlannerResultsPayload {
  const {
    result,
    initialPortfolio,
    currentAge,
    annualExpenses,
    lifeExpectancy,
    retirementAge,
    allocationWeights,
    selectedStrategy,
    strategyParams,
  } = input

  const wrCritical50 = deriveWRCritical50({
    result,
    initialPortfolio,
    selectedStrategy,
    strategyParams,
  })

  // WR at p10/p90 from safe_swr confidence levels
  const wrCritical10 = result.safe_swr?.confidence_95 != null
    ? roundRate(clamp01(result.safe_swr.confidence_95))
    : wrCritical50
  const wrCritical90 = result.safe_swr?.confidence_85 != null
    ? roundRate(clamp01(result.safe_swr.confidence_85))
    : wrCritical50

  // FIRE age estimation: find first age where median portfolio >= required
  const safeRate = Math.max(wrCritical50, MIN_WR_DENOMINATOR)
  const requiredPortfolio = annualExpenses <= 0 ? 0 : annualExpenses / safeRate
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

  // Portfolio at retirement: median portfolio at retirement age index
  const retirementIdx = Math.max(0, Math.round(retirementAge - currentAge))
  const portfolioAtFire = retirementIdx < medians.length
    ? roundMoney(medians[retirementIdx])
    : roundMoney(result.terminal_stats.median)

  return {
    schemaVersion: SCHEMA_VERSION,
    p_success: roundRate(clamp01(result.success_rate)),
    WR_critical_50: wrCritical50,
    horizonYears: Math.max(0, Math.round(lifeExpectancy - retirementAge)),
    allocationSummary: buildAllocationSummary(allocationWeights),
    fire_age: fireAge,
    portfolio_at_fire: portfolioAtFire,
    wr_critical_10: wrCritical10,
    wr_critical_90: wrCritical90,
  }
}
