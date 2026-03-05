import type { MonteCarloResult } from '@/lib/types'
import type { MonteCarloEngineParams } from './monteCarlo'

export type StressScenarioId = 'base' | 'market-crash' | 'inflation-spike' | 'longevity-risk'

export interface StressScenarioDefinition {
  id: StressScenarioId
  label: string
  description: string
}

export interface StressScenarioRun {
  scenarioId: StressScenarioId
  label: string
  params: MonteCarloEngineParams
}

export interface StressScenarioComparisonRow {
  scenarioId: StressScenarioId
  label: string
  successRate: number
  medianTerminalWealth: number
  failureAge: number | null
}

export const STRESS_SCENARIOS: StressScenarioDefinition[] = [
  {
    id: 'base',
    label: 'Base case',
    description: 'Current assumptions with no additional stress overlay.',
  },
  {
    id: 'market-crash',
    label: 'Market crash',
    description: 'Forces the first 3 years to -30%, -10%, +5%.',
  },
  {
    id: 'inflation-spike',
    label: 'Inflation spike',
    description: 'Forces inflation to 6% for the first 5 years.',
  },
  {
    id: 'longevity-risk',
    label: 'Longevity',
    description: 'Extends life expectancy by 10 years.',
  },
]

function cloneParams(params: MonteCarloEngineParams): MonteCarloEngineParams {
  return {
    ...params,
    annualSavings: [...params.annualSavings],
    postRetirementIncome: [...params.postRetirementIncome],
    strategyParams: { ...params.strategyParams },
    portfolioAdjustments: params.portfolioAdjustments ? [...params.portfolioAdjustments] : undefined,
    yearlyWeights: params.yearlyWeights ? params.yearlyWeights.map((weights) => [...weights]) : undefined,
    forcedPortfolioReturns: params.forcedPortfolioReturns ? [...params.forcedPortfolioReturns] : undefined,
    yearlyInflationRates: params.yearlyInflationRates ? [...params.yearlyInflationRates] : undefined,
  }
}

function extendYearlyWeights(
  yearlyWeights: number[][] | undefined,
  targetTotalYears: number
): number[][] | undefined {
  if (!yearlyWeights || yearlyWeights.length === 0) return yearlyWeights
  if (yearlyWeights.length >= targetTotalYears) return yearlyWeights

  const next = yearlyWeights.map((weights) => [...weights])
  const last = [...next[next.length - 1]]
  while (next.length < targetTotalYears) {
    next.push([...last])
  }
  return next
}

export function applyStressScenario(
  params: MonteCarloEngineParams,
  scenarioId: StressScenarioId
): MonteCarloEngineParams {
  if (scenarioId === 'base') return cloneParams(params)

  const next = cloneParams(params)

  if (scenarioId === 'market-crash') {
    const forced = next.forcedPortfolioReturns ? [...next.forcedPortfolioReturns] : []
    forced[0] = -0.30
    forced[1] = -0.10
    forced[2] = 0.05
    next.forcedPortfolioReturns = forced
    return next
  }

  if (scenarioId === 'inflation-spike') {
    const yearlyInflationRates = next.yearlyInflationRates ? [...next.yearlyInflationRates] : []
    for (let year = 0; year < 5; year += 1) {
      yearlyInflationRates[year] = 0.06
    }
    next.yearlyInflationRates = yearlyInflationRates

    // Keep first-retirement-year spending consistent when retirement is near-term.
    const yearsUntilRetirement = Math.max(0, next.retirementAge - next.currentAge)
    const impactedYears = Math.min(5, yearsUntilRetirement)
    if (impactedYears > 0 && next.annualExpensesAtRetirement != null) {
      const baseFactor = Math.pow(1 + next.inflation, impactedYears)
      const spikeFactor = Math.pow(1 + 0.06, impactedYears)
      if (baseFactor > 0) {
        next.annualExpensesAtRetirement = next.annualExpensesAtRetirement * (spikeFactor / baseFactor)
      }
    }
    return next
  }

  if (scenarioId === 'longevity-risk') {
    const extendedLifeExpectancy = next.lifeExpectancy + 10
    next.lifeExpectancy = extendedLifeExpectancy
    const totalYears = Math.max(1, extendedLifeExpectancy - next.currentAge)
    next.yearlyWeights = extendYearlyWeights(next.yearlyWeights, totalYears)
    return next
  }

  return next
}

export function buildStressScenarioRunPlan(
  baseParams: MonteCarloEngineParams,
  selectedScenarioIds: StressScenarioId[]
): StressScenarioRun[] {
  const selected = new Set<StressScenarioId>(
    selectedScenarioIds.length > 0 ? selectedScenarioIds : ['base']
  )

  return STRESS_SCENARIOS
    .filter((scenario) => selected.has(scenario.id))
    .map((scenario) => ({
      scenarioId: scenario.id,
      label: scenario.label,
      params: applyStressScenario(baseParams, scenario.id),
    }))
}

function deriveFailureAge(result: MonteCarloResult, retirementAge: number): number | null {
  if (result.failure_distribution.total_failures === 0) return null

  for (let i = 0; i < result.failure_distribution.counts.length; i += 1) {
    if (result.failure_distribution.counts[i] <= 0) continue
    const bucket = result.failure_distribution.buckets[i] ?? ''
    const match = bucket.match(/Year\s+(\d+)-/i)
    const startYear = match ? Number(match[1]) : i * 10 + 1
    return Math.round(retirementAge + Math.max(0, startYear - 1))
  }

  return null
}

export function buildStressScenarioComparisonRow(
  scenarioId: StressScenarioId,
  result: MonteCarloResult,
  retirementAge: number
): StressScenarioComparisonRow {
  const scenario = STRESS_SCENARIOS.find((item) => item.id === scenarioId)

  return {
    scenarioId,
    label: scenario?.label ?? scenarioId,
    successRate: result.success_rate,
    medianTerminalWealth: result.terminal_stats.median,
    failureAge: deriveFailureAge(result, retirementAge),
  }
}
