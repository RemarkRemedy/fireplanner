import { useIncomeStore } from '@/stores/useIncomeStore'
import { useProfileStore } from '@/stores/useProfileStore'
import { useUIStore } from '@/stores/useUIStore'
import type { MonteCarloResult, StrategyParamsMap, WithdrawalStrategyType } from '@/lib/types'
import type { PlannerResultsPayload, PlannerSnapshot } from './companionClient'

const MONTHS_PER_YEAR = 12
const MIN_WR_DENOMINATOR = 0.0001

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

function normalizeStructuralMode(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

export interface CompanionScenarioOverrides {
  monthlyExpenseDelta?: number
  retirementAge?: number
}

export interface CompanionScenario {
  id: string
  name: string
  overrides: CompanionScenarioOverrides
  placeholder?: boolean
}

export function createCompanionScenarios(baseRetirementAge: number): CompanionScenario[] {
  return [
    { id: 'base', name: 'Base', overrides: {} },
    { id: 'cut-300', name: 'Cut $300/mo', overrides: { monthlyExpenseDelta: -300 } },
    { id: 'buy-hdb-earlier', name: 'Buy HDB earlier', overrides: {}, placeholder: true },
    { id: 'retire-5-earlier', name: 'Retire 5 years earlier', overrides: { retirementAge: Math.max(35, Math.round(baseRetirementAge - 5)) } },
    { id: 'conservative-spending', name: 'Conservative spending', overrides: { monthlyExpenseDelta: -500 } },
  ]
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
  const annualExpenses = Math.max(0, baseAnnualExpenses + monthlyDelta * MONTHS_PER_YEAR)
  const minRetirementAge = Math.max(35, Math.round(toFiniteNumber(input.minRetirementAge) ?? 35))
  const maxRetirementAgeRaw = toFiniteNumber(input.maxRetirementAge)
  const maxRetirementAge = maxRetirementAgeRaw == null
    ? Number.POSITIVE_INFINITY
    : Math.max(minRetirementAge, Math.round(maxRetirementAgeRaw))
  const rawRetirementAge = Math.round(toFiniteNumber(overrides.retirementAge) ?? baseRetirementAge)
  const retirementAge = Math.min(maxRetirementAge, Math.max(minRetirementAge, rawRetirementAge))
  return { annualExpenses, retirementAge }
}

export function applySnapshotToPlanner(snapshot: PlannerSnapshot): void {
  const profile = useProfileStore.getState()
  const income = useIncomeStore.getState()
  const ui = useUIStore.getState()

  const monthlyIncome = toFiniteNumber(snapshot.avgMonthlyIncome)
  const monthlyExpense = toFiniteNumber(snapshot.avgMonthlyExpense)
  const monthlySavings = toFiniteNumber(snapshot.avgMonthlySavings)
  const investableAssets = toFiniteNumber(snapshot.investableAssets)

  let resolvedMonthlyIncome = monthlyIncome
  let resolvedMonthlyExpense = monthlyExpense

  // Fill one side from savings when the other side is available.
  if (resolvedMonthlyIncome === null && resolvedMonthlyExpense !== null && monthlySavings !== null) {
    resolvedMonthlyIncome = resolvedMonthlyExpense + monthlySavings
  }
  if (resolvedMonthlyExpense === null && resolvedMonthlyIncome !== null && monthlySavings !== null) {
    resolvedMonthlyExpense = Math.max(0, resolvedMonthlyIncome - monthlySavings)
  }

  if (resolvedMonthlyIncome !== null) {
    const annualIncome = Math.max(0, resolvedMonthlyIncome * MONTHS_PER_YEAR)
    profile.setField('annualIncome', annualIncome)
    income.setField('annualSalary', annualIncome)
  }
  if (resolvedMonthlyExpense !== null) {
    profile.setField('annualExpenses', Math.max(0, resolvedMonthlyExpense * MONTHS_PER_YEAR))
  }
  if (investableAssets !== null) {
    profile.setField('liquidNetWorth', Math.max(0, investableAssets))
  }

  const structuralMode = normalizeStructuralMode(snapshot.structuralMode)
  if (structuralMode === 'simple' || structuralMode === 'advanced') {
    ui.setField('mode', structuralMode)
  }
  if (structuralMode === 'goal-first' || structuralMode === 'story-first' || structuralMode === 'already-fire') {
    ui.setField('sectionOrder', structuralMode)
  }
}

function toPercent(weight: number): number {
  return Math.round(Math.max(0, weight) * 100)
}

export function buildAllocationSummary(allocationWeights: number[]): string {
  const safe = (idx: number) => allocationWeights[idx] ?? 0

  const stocks = safe(0) + safe(1) + safe(2) + safe(4)
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

function deriveWRFromBand(
  result: MonteCarloResult,
  initialPortfolio: number,
  bandKey: 'p10' | 'p50' | 'p90'
): number | null {
  const value = result.withdrawal_bands?.[bandKey]?.[0]
  if (typeof value !== 'number' || !Number.isFinite(value) || initialPortfolio <= 0) return null
  return roundRate(clamp01(value / initialPortfolio))
}

function findFirstAgeIndex(ages: number[], targetAge: number): number {
  const idx = ages.findIndex((age) => age >= targetAge)
  return idx >= 0 ? idx : -1
}

function estimateFireMilestone(input: {
  result: MonteCarloResult
  currentAge: number
  retirementAge: number
  annualExpenses: number
  wrCritical50: number
}): { fireAge: number; portfolioAtFire: number } {
  const { result, currentAge, retirementAge, annualExpenses, wrCritical50 } = input
  const ages = result.percentile_bands.ages
  const medians = result.percentile_bands.p50

  if (ages.length === 0 || medians.length === 0) {
    return {
      fireAge: Math.round(retirementAge),
      portfolioAtFire: roundMoney(result.terminal_stats.median),
    }
  }

  const safeRate = Math.max(wrCritical50, MIN_WR_DENOMINATOR)
  const requiredPortfolio = annualExpenses <= 0 ? 0 : annualExpenses / safeRate

  const startIdx = findFirstAgeIndex(ages, currentAge)
  if (startIdx >= 0) {
    for (let i = startIdx; i < ages.length; i += 1) {
      if ((medians[i] ?? 0) >= requiredPortfolio) {
        return {
          fireAge: Math.round(ages[i]),
          portfolioAtFire: roundMoney(medians[i]),
        }
      }
    }
  }

  const retirementIdx = findFirstAgeIndex(ages, retirementAge)
  if (retirementIdx >= 0) {
    return {
      fireAge: Math.round(ages[retirementIdx]),
      portfolioAtFire: roundMoney(medians[retirementIdx] ?? result.terminal_stats.median),
    }
  }

  return {
    fireAge: Math.round(retirementAge),
    portfolioAtFire: roundMoney(result.terminal_stats.median),
  }
}

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
  const wrCritical10 = deriveWRFromBand(result, initialPortfolio, 'p10') ?? wrCritical50
  const wrCritical90 = deriveWRFromBand(result, initialPortfolio, 'p90') ?? wrCritical50
  const { fireAge, portfolioAtFire } = estimateFireMilestone({
    result,
    currentAge,
    retirementAge,
    annualExpenses,
    wrCritical50,
  })

  return {
    p_success: roundRate(clamp01(result.success_rate)),
    WR_critical_50: wrCritical50,
    horizonYears: Math.max(0, Math.round(lifeExpectancy - retirementAge)),
    allocationSummary: buildAllocationSummary(allocationWeights),
    fireAge,
    portfolioAtFire,
    wrCritical10,
    wrCritical90,
  }
}
