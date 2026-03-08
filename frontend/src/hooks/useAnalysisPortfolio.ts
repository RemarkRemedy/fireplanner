import { useMemo } from 'react'
import { useNormalizedLegacyAnalysisContext } from '@/hooks/useIncomeProjection'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { usePropertyStore } from '@/stores/usePropertyStore'
import { projectPortfolioAtRetirement } from '@/lib/calculations/fire'
import { getEffectiveExpenses } from '@/lib/calculations/expenses'
import { formatCurrency } from '@/lib/utils'
import { getBaseInputs } from '@/hooks/useWhatIfMetrics'

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
  const income = useIncomeStore()
  const allocation = useAllocationStore()
  const property = usePropertyStore()
  const normalized = useNormalizedLegacyAnalysisContext()

  return useMemo(() => {
    const currentWeights = allocation.currentWeights
    const totalNW = profile.liquidNetWorth + profile.cpfOA + profile.cpfSA + profile.cpfMA + profile.cpfRA

    const baseInputs = getBaseInputs(profile, income, allocation, property, {
      currentAge: normalized.currentAge,
      retirementAge: normalized.retirementAge,
      lifeExpectancy: normalized.lifeExpectancy,
    })
    const netRealReturn = baseInputs.expectedReturn - baseInputs.inflation - baseInputs.expenseRatio
    const currentExpenses = getEffectiveExpenses(
      baseInputs.currentAge,
      baseInputs.annualExpenses,
      baseInputs.expenseAdjustments ?? [],
      baseInputs.lifeExpectancy,
    )
    const annualSavings = baseInputs.annualIncome - currentExpenses

    const projected = projectPortfolioAtRetirement({
      currentNW: totalNW,
      annualSavings,
      netRealReturn,
      yearsToRetirement: normalized.householdRetirementYearOffset,
    })

    return {
      initialPortfolio: totalNW,
      retirementPortfolio: projected,
      allocationWeights: currentWeights,
      portfolioLabel: `${formatCurrency(totalNW)} today → ~${formatCurrency(projected)} at age ${normalized.retirementAge}`,
    }
  }, [
    profile.liquidNetWorth,
    profile.cpfOA,
    profile.cpfSA,
    profile.cpfMA,
    profile.cpfRA,
    profile.annualExpenses,
    profile.expenseAdjustments,
    profile.annualIncome,
    profile.expectedReturn,
    profile.usePortfolioReturn,
    profile.inflation,
    profile.expenseRatio,
    profile.cashReserveEnabled,
    profile.cashReserveMode,
    profile.cashReserveFixedAmount,
    profile.cashReserveMonths,
    profile.lockedAssets,
    allocation.currentWeights,
    allocation.targetWeights,
    allocation.glidePathConfig,
    allocation.returnOverrides,
    allocation.validationErrors,
    income,
    property,
    normalized.currentAge,
    normalized.householdRetirementYearOffset,
    normalized.lifeExpectancy,
    normalized.retirementAge,
  ])
}
