import { useMemo } from 'react'
import type { WithdrawalStrategyType } from '@/lib/types'
import {
  runDeterministicComparison,
  type DeterministicComparisonResult,
} from '@/lib/calculations/withdrawal'
import { calculatePortfolioReturn } from '@/lib/calculations/portfolio'
import { useProfileStore } from '@/stores/useProfileStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useWithdrawalStore } from '@/stores/useWithdrawalStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { validateWithdrawalCrossStoreRules } from '@/lib/validation/rules'
import { ASSET_CLASSES } from '@/lib/data/historicalReturns'
import { getEffectiveExpenses } from '@/lib/calculations/expenses'

interface WithdrawalComparisonResult {
  results: DeterministicComparisonResult | null
  hasErrors: boolean
  errors: Record<string, string>
}

/**
 * Derived hook: reads profile + allocation + withdrawal stores,
 * checks validation, runs deterministic withdrawal comparison.
 *
 * @param opts.initialPortfolioOverride - If provided, use this as the
 *   retirement-age portfolio value instead of the simplified compound growth
 *   formula. Typically sourced from useProjection()'s liquidNW at retirement age.
 */
export function useWithdrawalComparison(opts?: { initialPortfolioOverride?: number }): WithdrawalComparisonResult {
  const profile = useProfileStore()
  const allocation = useAllocationStore()
  const withdrawal = useWithdrawalStore()
  const activeStrategy = useSimulationStore((s) => s.selectedStrategy)

  return useMemo(() => {
    const profileErrors = profile.validationErrors
    const withdrawalErrors = withdrawal.validationErrors
    const crossErrors = validateWithdrawalCrossStoreRules(
      {
        annualExpenses: profile.annualExpenses,
        retirementAge: profile.retirementAge,
        lifeExpectancy: profile.lifeExpectancy,
      },
      { strategyParams: withdrawal.strategyParams }
    )
    const allErrors = { ...profileErrors, ...withdrawalErrors, ...crossErrors }

    if (Object.keys(allErrors).length > 0) {
      return { results: null, hasErrors: true, errors: allErrors }
    }

    // Use portfolio expected return from allocation when user has opted in and allocation is valid
    let expectedReturn = profile.expectedReturn
    const allocationErrors = allocation.validationErrors
    if (profile.usePortfolioReturn && Object.keys(allocationErrors).length === 0) {
      const effectiveReturns = ASSET_CLASSES.map((ac, i) =>
        allocation.returnOverrides[i] ?? ac.expectedReturn
      )
      expectedReturn = calculatePortfolioReturn(allocation.currentWeights, effectiveReturns)
    }

    // Project everything to retirement age (nominal/future dollars).
    // All columns in the preview table must use the same dollar basis.
    const yearsToRetirement = Math.max(0, profile.retirementAge - profile.currentAge)
    const netReturn = expectedReturn - profile.expenseRatio

    // Prefer the projection-derived override (full income engine) over the
    // simplified compound growth formula when provided (e.g. from Explore page).
    const initialPortfolio = opts?.initialPortfolioOverride ?? profile.liquidNetWorth * (1 + netReturn) ** yearsToRetirement

    const effectiveRetirementBase = getEffectiveExpenses(profile.retirementAge, profile.annualExpenses, profile.expenseAdjustments, profile.lifeExpectancy)
    const retirementExpenses = effectiveRetirementBase
      * (profile.retirementSpendingAdjustment ?? 1)
      * (1 + profile.inflation) ** yearsToRetirement

    const results = runDeterministicComparison({
      initialPortfolio,
      annualExpenses: retirementExpenses,
      retirementAge: profile.retirementAge,
      lifeExpectancy: profile.lifeExpectancy,
      expectedReturn,
      inflation: profile.inflation,
      expenseRatio: profile.expenseRatio,
      swr: profile.swr,
      strategies: (withdrawal.selectedStrategies as string[]).includes(activeStrategy)
        ? withdrawal.selectedStrategies as string[]
        : [...withdrawal.selectedStrategies as string[], activeStrategy],
      strategyParams: withdrawal.strategyParams as unknown as Record<string, Record<string, number>>,
    })

    return { results, hasErrors: false, errors: {} }
  }, [
    profile.liquidNetWorth,
    profile.currentAge,
    profile.retirementAge,
    profile.lifeExpectancy,
    profile.annualExpenses,
    profile.retirementSpendingAdjustment,
    profile.expectedReturn,
    profile.usePortfolioReturn,
    profile.inflation,
    profile.expenseRatio,
    profile.swr,
    profile.validationErrors,
    allocation.currentWeights,
    allocation.returnOverrides,
    allocation.validationErrors,
    withdrawal.selectedStrategies,
    withdrawal.strategyParams,
    withdrawal.validationErrors,
    activeStrategy,
    opts?.initialPortfolioOverride,
    profile.expenseAdjustments,
  ])
}

const STRATEGY_LABELS: Record<WithdrawalStrategyType, string> = {
  constant_dollar: 'Constant Dollar (4% Rule)',
  vpw: 'Variable Percentage (VPW)',
  guardrails: 'Guardrails (Guyton-Klinger)',
  vanguard_dynamic: 'Vanguard Dynamic',
  cape_based: 'CAPE-Based',
  floor_ceiling: 'Floor & Ceiling',
  percent_of_portfolio: 'Percent of Portfolio',
  one_over_n: '1/N (Remaining Years)',
  sensible_withdrawals: 'Sensible Withdrawals',
  ninety_five_percent: '95% Rule',
  endowment: 'Endowment (Yale)',
  hebeler_autopilot: 'Hebeler Autopilot II',
}

export function getStrategyLabel(strategy: WithdrawalStrategyType): string {
  return STRATEGY_LABELS[strategy] ?? strategy
}
