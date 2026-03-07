import { useMemo } from 'react'
import { useProfileStore } from '@/stores/useProfileStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { projectPortfolioAtRetirement } from '@/lib/calculations/fire'
import { getEffectiveExpenses } from '@/lib/calculations/expenses'
import { resolveDeterministicExpectedReturn } from '@/lib/analysis/deterministicAssumptions'
import { formatCurrency } from '@/lib/utils'

interface AnalysisPortfolioResult {
  initialPortfolio: number
  retirementPortfolio: number
  allocationWeights: number[]
  portfolioLabel: string
}

/**
 * Central hook for Stress Test / analysis pages. Returns the starting portfolio
 * and allocation weights using My Plan values (current NW, projected retirement
 * portfolio, current allocation weights).
 *
 * Always operates in My Plan mode — the fireTarget branch was removed as part
 * of the Explore + Stress Test redesign. The future Explore page will have its
 * own useExplorePortfolio hook with local state.
 */
export function useAnalysisPortfolio(): AnalysisPortfolioResult {
  const profile = useProfileStore()
  const allocation = useAllocationStore()

  return useMemo(() => {
    const currentWeights = allocation.currentWeights
    const totalNW = profile.liquidNetWorth + profile.cpfOA + profile.cpfSA + profile.cpfMA + profile.cpfRA

    // Compute deterministic projection for BT/SR
    const portfolioReturn = resolveDeterministicExpectedReturn(profile, allocation)
    const netRealReturn = portfolioReturn - profile.inflation - profile.expenseRatio
    const currentExpenses = getEffectiveExpenses(profile.currentAge, profile.annualExpenses, profile.expenseAdjustments, profile.lifeExpectancy)
    const annualSavings = profile.annualIncome - currentExpenses

    const projected = projectPortfolioAtRetirement({
      currentNW: totalNW,
      annualSavings,
      netRealReturn,
      yearsToRetirement: profile.retirementAge - profile.currentAge,
    })

    return {
      initialPortfolio: totalNW,
      retirementPortfolio: projected,
      allocationWeights: currentWeights,
      portfolioLabel: `${formatCurrency(totalNW)} today → ~${formatCurrency(projected)} at age ${profile.retirementAge}`,
    }
  }, [
    profile.liquidNetWorth,
    profile.cpfOA,
    profile.cpfSA,
    profile.cpfMA,
    profile.cpfRA,
    profile.currentAge,
    profile.retirementAge,
    profile.annualIncome,
    profile.annualExpenses,
    profile.expenseAdjustments,
    profile.lifeExpectancy,
    profile.expectedReturn,
    profile.usePortfolioReturn,
    profile.inflation,
    profile.expenseRatio,
    allocation.currentWeights,
    allocation.targetWeights,
    allocation.glidePathConfig,
    allocation.returnOverrides,
    allocation.validationErrors,
  ])
}
