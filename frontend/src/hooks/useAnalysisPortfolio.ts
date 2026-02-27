import { useMemo } from 'react'
import { useProfileStore } from '@/stores/useProfileStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { projectPortfolioAtRetirement } from '@/lib/calculations/fire'
import { calculatePortfolioReturn, interpolateGlidePath } from '@/lib/calculations/portfolio'
import { ASSET_CLASSES } from '@/lib/data/historicalReturns'
import { getEffectiveExpenses } from '@/lib/calculations/expenses'
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

    // Compute retirement-age weights (used for portfolio return calculation)
    const retirementWeights = getRetirementAgeWeights(
      allocation.glidePathConfig.enabled,
      allocation.glidePathConfig,
      currentWeights,
      allocation.targetWeights,
      profile.retirementAge,
    )

    // Compute deterministic projection for BT/SR
    let portfolioReturn = profile.expectedReturn
    const allocationValid = Object.keys(allocation.validationErrors).length === 0
    if (profile.usePortfolioReturn && allocationValid) {
      const effectiveReturns = ASSET_CLASSES.map((ac, i) =>
        allocation.returnOverrides[i] ?? ac.expectedReturn
      )
      portfolioReturn = calculatePortfolioReturn(retirementWeights, effectiveReturns)
    }
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

/**
 * Get allocation weights at retirement age.
 * If glide path is enabled and retirement age falls within range, interpolate.
 * Otherwise return current weights.
 */
function getRetirementAgeWeights(
  glidePathEnabled: boolean,
  glidePathConfig: { startAge: number; endAge: number; method: 'linear' | 'slowStart' | 'fastStart' },
  currentWeights: number[],
  targetWeights: number[],
  retirementAge: number,
): number[] {
  if (!glidePathEnabled) return currentWeights

  const { startAge, endAge, method } = glidePathConfig
  if (retirementAge < startAge) return currentWeights
  if (retirementAge >= endAge) return targetWeights

  const duration = endAge - startAge
  if (duration <= 0) return currentWeights

  const progress = (retirementAge - startAge) / duration
  return interpolateGlidePath(currentWeights, targetWeights, progress, method)
}
