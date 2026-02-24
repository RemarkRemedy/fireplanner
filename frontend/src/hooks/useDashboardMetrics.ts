import { useMemo } from 'react'
import { useFireCalculations } from '@/hooks/useFireCalculations'
import { useProjection } from '@/hooks/useProjection'
import { useProfileStore } from '@/stores/useProfileStore'
import { useAdjustedFireNumber } from '@/hooks/useAdjustedFireNumber'
import { useHouseholdStore } from '@/stores/useHouseholdStore'

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
  isHouseholdMode: boolean
}

/**
 * Derived hook: computes dashboard headline numbers from profile + FIRE calculations.
 * Prefers projection's simulated FIRE age over NPER estimate when available.
 * No state stored — purely computed from other stores.
 */
export function useDashboardMetrics(): DashboardMetrics {
  const { metrics } = useFireCalculations()
  const { summary: projSummary } = useProjection()
  const profile = useProfileStore()
  const adjusted = useAdjustedFireNumber()
  const household = useHouseholdStore()
  const isHouseholdMode = household.householdMode && household.persons.length > 0

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
        isHouseholdMode,
      }
    }

    // Prefer projection's simulated FIRE age over NPER estimate
    const projFireAge = projSummary?.fireAchievedAge ?? null
    const fireAge = projFireAge ?? metrics.fireAge
    const yearsToFire = projFireAge !== null
      ? Math.max(0, projFireAge - profile.currentAge)
      : metrics.yearsToFire

    // Calculate total net worth - aggregate household CPF and SRS in household mode
    const totalNetWorth = isHouseholdMode
      ? profile.liquidNetWorth +
        household.persons.reduce((sum, p) =>
          sum + p.cpf.cpfOA + p.cpf.cpfSA + p.cpf.cpfMA + p.cpf.cpfRA +
          (p.income.srsBalance || 0), 0)
      : profile.liquidNetWorth + profile.cpfOA + profile.cpfSA + profile.cpfMA + profile.cpfRA + (profile.srsBalance || 0)

    return {
      fireNumber: metrics.fireNumber,
      progress: metrics.progress,
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
      isHouseholdMode,
    }
  }, [
    metrics,
    projSummary,
    adjusted,
    profile.currentAge,
    profile.lifeExpectancy,
    profile.liquidNetWorth,
    profile.cpfOA,
    profile.cpfSA,
    profile.cpfMA,
    profile.cpfRA,
    profile.srsBalance,
    isHouseholdMode,
    household.persons,
  ])
}
