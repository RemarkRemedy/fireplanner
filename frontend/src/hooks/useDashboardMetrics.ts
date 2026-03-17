import { useMemo } from 'react'
import { useProjection } from '@/hooks/useProjection'
import { useHouseholdRuntimeInputs } from '@/hooks/useHouseholdRuntimeInputs'
import { useFireCalculations } from '@/hooks/useFireCalculations'
import { useAdjustedFireNumber } from '@/hooks/useAdjustedFireNumber'
import { useProfileStore } from '@/stores/useProfileStore'
import { useUIStore } from '@/stores/useUIStore'
import { calculateBlendedFireNumber } from '@/lib/calculations/expenseSwr'

interface DashboardMetrics {
  fireNumber: number | null
  progress: number | null
  yearsToFire: number | null
  fireAge: number | null
  coastFireNumber: number | null
  baristaFireIncome: number | null
  savingsRate: number | null
  totalNetWorth: number | null
  portfolioDepletedAge: number | null
  lifeExpectancy: number
  projectionFireNumber: number | null
  deviationPct: number | null
  showProjectionNumber: boolean
  deviationFactors: string[]
  /** When useBlendedFireNumber is on and items exist, the blended FIRE number */
  blendedFireNumber: number | null
}

/**
 * Derived hook: computes dashboard headline numbers from profile + FIRE calculations.
 * Prefers projection's simulated FIRE age over NPER estimate when available.
 * When the blended per-expense SWR toggle is on and items exist, overrides the primary FIRE number.
 * No state stored — purely computed from other stores.
 */
export function useDashboardMetrics(): DashboardMetrics {
  const { metrics } = useFireCalculations()
  const { summary: projSummary } = useProjection()
  const { profile } = useHouseholdRuntimeInputs()
  const adjusted = useAdjustedFireNumber()

  const useBlended = useUIStore((s) => s.useBlendedFireNumber)
  const expenseItems = useProfileStore((s) => s.retirementExpenseItems)
  const expectedReturn = useProfileStore((s) => s.expectedReturn)
  const inflation = useProfileStore((s) => s.inflation)
  const expenseRatio = useProfileStore((s) => s.expenseRatio)
  const retirementAge = useProfileStore((s) => s.retirementAge)

  return useMemo(() => {
    if (!metrics) {
      return {
        fireNumber: null,
        progress: null,
        yearsToFire: null,
        fireAge: null,
        coastFireNumber: null,
        baristaFireIncome: null,
        savingsRate: null,
        totalNetWorth: null,
        portfolioDepletedAge: null,
        lifeExpectancy: profile.lifeExpectancy,
        projectionFireNumber: null,
        deviationPct: null,
        showProjectionNumber: false,
        deviationFactors: [],
        blendedFireNumber: null,
      }
    }

    // Compute blended FIRE number from per-expense items
    const hasBlendedItems = useBlended && expenseItems.length > 0
    const netRealReturn = expectedReturn - inflation - expenseRatio
    const blendedFireNumber = hasBlendedItems
      ? calculateBlendedFireNumber(expenseItems, retirementAge, profile.lifeExpectancy, netRealReturn)
      : null

    // When blended is active, override the primary FIRE number
    const effectiveFireNumber = blendedFireNumber ?? metrics.fireNumber

    // Recalculate progress using the effective FIRE number
    const totalNetWorth = profile.liquidNetWorth + profile.cpfOA + profile.cpfSA + profile.cpfMA + profile.cpfRA
    const effectiveProgress = effectiveFireNumber > 0
      ? Math.min(1, totalNetWorth / effectiveFireNumber)
      : metrics.progress

    // Prefer projection's simulated FIRE age over NPER estimate
    const projFireAge = projSummary?.fireAchievedAge ?? null
    const fireAge = projFireAge ?? metrics.fireAge
    const yearsToFire = projFireAge !== null
      ? Math.max(0, projFireAge - profile.currentAge)
      : metrics.yearsToFire

    return {
      fireNumber: effectiveFireNumber,
      progress: blendedFireNumber != null ? effectiveProgress : metrics.progress,
      yearsToFire,
      fireAge,
      coastFireNumber: metrics.coastFireNumber,
      baristaFireIncome: metrics.baristaFireIncome,
      savingsRate: metrics.savingsRate,
      totalNetWorth,
      portfolioDepletedAge: projSummary?.portfolioDepletedAge ?? null,
      lifeExpectancy: profile.lifeExpectancy,
      projectionFireNumber: adjusted.projectionFireNumber,
      deviationPct: adjusted.deviationPct,
      showProjectionNumber: adjusted.showProjectionNumber,
      deviationFactors: adjusted.deviationFactors,
      blendedFireNumber,
    }
  }, [metrics, projSummary, adjusted, profile.currentAge, profile.lifeExpectancy, profile.liquidNetWorth, profile.cpfOA, profile.cpfSA, profile.cpfMA, profile.cpfRA, useBlended, expenseItems, expectedReturn, inflation, expenseRatio, retirementAge])
}
