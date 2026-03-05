/**
 * Action impact estimator for companion mode.
 *
 * Defines 5 "action levers" (save more, spend less, retire later, withdraw less, de-risk),
 * builds MC parameter overrides for each, and ranks results by improvement in p_success.
 *
 * Pure functions only — MC execution happens in the calling component.
 */

import type {
  MonteCarloResult,
  WithdrawalStrategyType,
  StrategyParamsMap,
  ProfileState,
  IncomeState,
  AllocationState,
  SimulationState,
  PropertyState,
} from '@/lib/types'
import { buildMonteCarloEngineParams } from '@/lib/simulation/monteCarloParams'
import { runMonteCarloWorker } from '@/lib/simulation/workerClient'
import type { MonteCarloEngineParams } from '@/lib/simulation/monteCarlo'
import { clamp01 } from './utils'

// ────────────────────────────────────────────────────────────
// Lever definitions
// ────────────────────────────────────────────────────────────

export interface ActionLever {
  id: string
  label: string
  shortLabel: string
  description: string
  applicableTo: 'all' | 'accumulator' | 'retiree'
}

export const ACTION_LEVERS: ActionLever[] = [
  {
    id: 'savings_rate_up_2pp',
    label: 'Save 2% more of income',
    shortLabel: '+2pp savings',
    description: 'Increase savings rate by 2 percentage points by reducing expenses',
    applicableTo: 'accumulator',
  },
  {
    id: 'expenses_down_10pct',
    label: 'Cut expenses by 10%',
    shortLabel: '-10% expenses',
    description: 'Reduce annual expenses by 10%',
    applicableTo: 'all',
  },
  {
    id: 'retire_2y_later',
    label: 'Retire 2 years later',
    shortLabel: '+2y retirement',
    description: 'Delay retirement age by 2 years',
    applicableTo: 'accumulator',
  },
  {
    id: 'withdrawal_down_10pct',
    label: 'Withdraw 10% less',
    shortLabel: '-10% withdrawal',
    description: 'Reduce withdrawal rate by 10%',
    applicableTo: 'retiree',
  },
  {
    id: 'derisk_10pp',
    label: 'De-risk allocation',
    shortLabel: '-10pp equities',
    description: 'Shift 10 percentage points from equities to bonds/cash',
    applicableTo: 'all',
  },
]

// ────────────────────────────────────────────────────────────
// Metrics extraction
// ────────────────────────────────────────────────────────────

export interface ActionImpactMetrics {
  p_success: number
  fail_prob_0_5y: number
  fail_prob_6_10y: number
}

export function extractImpactMetrics(result: MonteCarloResult): ActionImpactMetrics {
  const nSims = result.n_simulations || 1
  const counts5y = result.failure_distribution.counts_5y
  return {
    p_success: clamp01(result.success_rate),
    fail_prob_0_5y: clamp01((counts5y[0] ?? 0) / nSims),
    fail_prob_6_10y: clamp01((counts5y[1] ?? 0) / nSims),
  }
}

// ────────────────────────────────────────────────────────────
// Lever overrides
// ────────────────────────────────────────────────────────────

export interface LeverContext {
  annualExpenses: number
  retirementAge: number
  lifeExpectancy: number
  annualIncome: number
  currentWeights: number[]
  selectedStrategy: WithdrawalStrategyType
  strategyParams: StrategyParamsMap
}

interface LeverOverrides {
  profileOverrides?: Partial<Pick<ProfileState, 'annualExpenses' | 'retirementAge'>>
  allocationWeights?: number[]
  simulationOverrides?: Partial<Pick<SimulationState, 'strategyParams'>>
}

export function buildLeverOverrides(lever: ActionLever, ctx: LeverContext): LeverOverrides {
  switch (lever.id) {
    case 'savings_rate_up_2pp': {
      // Reduce expenses to increase savings rate by 2pp
      const reduction = 0.02 * Math.max(ctx.annualIncome, 1)
      return {
        profileOverrides: {
          annualExpenses: Math.max(0, ctx.annualExpenses - reduction),
        },
      }
    }

    case 'expenses_down_10pct':
      return {
        profileOverrides: {
          annualExpenses: ctx.annualExpenses * 0.9,
        },
      }

    case 'retire_2y_later':
      return {
        profileOverrides: {
          retirementAge: Math.min(ctx.retirementAge + 2, ctx.lifeExpectancy - 1),
        },
      }

    case 'withdrawal_down_10pct':
      return {
        simulationOverrides: {
          strategyParams: buildReducedWithdrawalParams(ctx.selectedStrategy, ctx.strategyParams, 0.9),
        },
      }

    case 'derisk_10pp':
      return {
        allocationWeights: buildDeriskedWeights(ctx.currentWeights, 0.10),
      }

    default:
      return {}
  }
}

/**
 * Scale the primary withdrawal rate parameter for the selected strategy by `factor`.
 * Returns a full StrategyParamsMap with only the selected strategy modified.
 */
function buildReducedWithdrawalParams(
  strategy: WithdrawalStrategyType,
  params: StrategyParamsMap,
  factor: number,
): StrategyParamsMap {
  const modified = { ...params }

  switch (strategy) {
    case 'constant_dollar':
      modified.constant_dollar = { ...params.constant_dollar, swr: params.constant_dollar.swr * factor }
      break
    case 'guardrails':
      modified.guardrails = { ...params.guardrails, initialRate: params.guardrails.initialRate * factor }
      break
    case 'vanguard_dynamic':
      modified.vanguard_dynamic = { ...params.vanguard_dynamic, swr: params.vanguard_dynamic.swr * factor }
      break
    case 'cape_based':
      modified.cape_based = { ...params.cape_based, baseRate: params.cape_based.baseRate * factor }
      break
    case 'floor_ceiling':
      modified.floor_ceiling = {
        ...params.floor_ceiling,
        targetRate: params.floor_ceiling.targetRate * factor,
        floor: params.floor_ceiling.floor * factor,
        ceiling: params.floor_ceiling.ceiling * factor,
      }
      break
    case 'percent_of_portfolio':
      modified.percent_of_portfolio = { ...params.percent_of_portfolio, rate: params.percent_of_portfolio.rate * factor }
      break
    case 'sensible_withdrawals':
      modified.sensible_withdrawals = { ...params.sensible_withdrawals, baseRate: params.sensible_withdrawals.baseRate * factor }
      break
    case 'ninety_five_percent':
      modified.ninety_five_percent = { ...params.ninety_five_percent, swr: params.ninety_five_percent.swr * factor }
      break
    case 'endowment':
      modified.endowment = { ...params.endowment, swr: params.endowment.swr * factor }
      break
    // vpw, one_over_n, hebeler_autopilot: no primary rate to scale
    default:
      break
  }

  return modified
}

/**
 * Shift `shiftPp` percentage points from equities (indices 0-2, 4) to bonds+cash (3, 6),
 * proportional to current equity allocation. Weights are clamped to [0, 1] and renormalized.
 */
function buildDeriskedWeights(weights: number[], shiftPp: number): number[] {
  const result = [...weights]
  const equityIndices = [0, 1, 2, 4] // US, SG, Intl, REITs
  const totalEquity = equityIndices.reduce((sum, i) => sum + (result[i] ?? 0), 0)

  if (totalEquity <= 0) return result

  // Reduce each equity proportionally
  const effectiveShift = Math.min(shiftPp, totalEquity)
  for (const i of equityIndices) {
    const proportion = (result[i] ?? 0) / totalEquity
    result[i] = Math.max(0, (result[i] ?? 0) - effectiveShift * proportion)
  }

  // Add to bonds and cash equally
  const bondsIdx = 3
  const cashIdx = 6
  result[bondsIdx] = (result[bondsIdx] ?? 0) + effectiveShift * 0.5
  result[cashIdx] = (result[cashIdx] ?? 0) + effectiveShift * 0.5

  return result
}

// ────────────────────────────────────────────────────────────
// Impact ranking
// ────────────────────────────────────────────────────────────

export interface ActionImpactResult {
  lever: ActionLever
  metrics: ActionImpactMetrics
  delta_p_success: number
  delta_fail_prob_0_5y: number
  delta_fail_prob_6_10y: number
  rationale: string
}

export function computeActionImpacts(
  baseMetrics: ActionImpactMetrics,
  leverResults: Array<{ lever: ActionLever; metrics: ActionImpactMetrics }>,
): ActionImpactResult[] {
  return leverResults
    .map(({ lever, metrics }) => {
      const delta_p_success = metrics.p_success - baseMetrics.p_success
      const delta_fail_prob_0_5y = metrics.fail_prob_0_5y - baseMetrics.fail_prob_0_5y
      const delta_fail_prob_6_10y = metrics.fail_prob_6_10y - baseMetrics.fail_prob_6_10y

      return {
        lever,
        metrics,
        delta_p_success,
        delta_fail_prob_0_5y,
        delta_fail_prob_6_10y,
        rationale: generateRationale(lever, delta_p_success, delta_fail_prob_0_5y),
      }
    })
    .sort((a, b) => {
      // Primary: higher p_success improvement is better
      if (b.delta_p_success !== a.delta_p_success) return b.delta_p_success - a.delta_p_success
      // Secondary: greater reduction in early failure is better (more negative = better)
      if (a.delta_fail_prob_0_5y !== b.delta_fail_prob_0_5y) return a.delta_fail_prob_0_5y - b.delta_fail_prob_0_5y
      // Tertiary: greater reduction in 6-10y failure
      return a.delta_fail_prob_6_10y - b.delta_fail_prob_6_10y
    })
}

function generateRationale(lever: ActionLever, deltaP: number, deltaFail05y: number): string {
  const pPts = Math.abs(deltaP * 100).toFixed(1)
  const direction = deltaP >= 0 ? 'improves' : 'reduces'

  if (Math.abs(deltaP) < 0.001 && Math.abs(deltaFail05y) < 0.001) {
    return `${lever.shortLabel}: negligible impact on success rate.`
  }

  let text = `${lever.shortLabel} ${direction} success by ${pPts}pp.`
  if (deltaFail05y < -0.005) {
    text += ` Also reduces early failure risk.`
  }
  return text
}

// ────────────────────────────────────────────────────────────
// Runner — orchestrates MC runs for all applicable levers
// ────────────────────────────────────────────────────────────

export interface ActionImpactRunnerInput {
  profile: ProfileState
  income: IncomeState
  allocation: AllocationState
  simulation: SimulationState
  property: PropertyState
  initialPortfolio: number
  allocationWeights: number[]
  baseResult: MonteCarloResult
  isRetiree: boolean
  annualIncome: number
  signal?: AbortSignal
  profileOverrides?: Partial<Pick<ProfileState, 'annualExpenses' | 'retirementAge'>>
  onProgress?: (completed: number, total: number, lever: ActionLever) => void
}

export interface ActionImpactRunnerOutput {
  impacts: ActionImpactResult[]
  baseMetrics: ActionImpactMetrics
  completedLevers: number
  totalLevers: number
}

export async function runActionImpactAnalysis(
  input: ActionImpactRunnerInput,
): Promise<ActionImpactRunnerOutput> {
  const {
    profile, income, allocation, simulation, property,
    initialPortfolio, allocationWeights,
    baseResult, isRetiree, annualIncome,
    signal, profileOverrides,
    onProgress,
  } = input

  const baseMetrics = extractImpactMetrics(baseResult)

  // Filter levers by lifecycle
  const applicableLevers = ACTION_LEVERS.filter((lever) => {
    if (lever.applicableTo === 'all') return true
    if (lever.applicableTo === 'accumulator') return !isRetiree
    if (lever.applicableTo === 'retiree') return isRetiree
    return false
  })

  const ctx: LeverContext = {
    annualExpenses: profileOverrides?.annualExpenses ?? profile.annualExpenses,
    retirementAge: profileOverrides?.retirementAge ?? profile.retirementAge,
    lifeExpectancy: profile.lifeExpectancy,
    annualIncome,
    currentWeights: allocationWeights,
    selectedStrategy: simulation.selectedStrategy,
    strategyParams: simulation.strategyParams,
  }

  const leverResults: Array<{ lever: ActionLever; metrics: ActionImpactMetrics }> = []
  let completed = 0

  for (const lever of applicableLevers) {
    if (signal?.aborted) break

    const overrides = buildLeverOverrides(lever, ctx)

    // Build MC params with lever-specific overrides
    const mergedProfileOverrides = {
      ...profileOverrides,
      ...overrides.profileOverrides,
    }
    const mergedSimulation = overrides.simulationOverrides
      ? { ...simulation, ...overrides.simulationOverrides }
      : simulation

    const params: MonteCarloEngineParams = buildMonteCarloEngineParams({
      profile,
      income,
      allocation,
      simulation: mergedSimulation,
      property,
      initialPortfolio,
      allocationWeights: overrides.allocationWeights ?? allocationWeights,
      profileOverrides: Object.keys(mergedProfileOverrides).length > 0
        ? mergedProfileOverrides
        : undefined,
    })

    const result = await runMonteCarloWorker(params, { signal })
    leverResults.push({ lever, metrics: extractImpactMetrics(result) })

    completed++
    onProgress?.(completed, applicableLevers.length, lever)
  }

  return {
    impacts: computeActionImpacts(baseMetrics, leverResults),
    baseMetrics,
    completedLevers: completed,
    totalLevers: applicableLevers.length,
  }
}
