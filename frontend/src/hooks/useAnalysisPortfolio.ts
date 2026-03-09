import { useMemo } from 'react'
import { useNormalizedLegacyAnalysisContext } from '@/hooks/useIncomeProjection'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { projectPortfolioAtRetirement } from '@/lib/calculations/fire'
import { getEffectiveExpenses } from '@/lib/calculations/expenses'
import { formatCurrency } from '@/lib/utils'
import { buildHouseholdRuntimeLegacyInputs } from '@/lib/household/runtimeLegacyInputs'
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
  const plan = useHouseholdPlanStore((state) => state.plan)
  const allocation = useAllocationStore()
  const normalized = useNormalizedLegacyAnalysisContext()
  const { profile, income, property } = useMemo(
    () => buildHouseholdRuntimeLegacyInputs(plan, normalized.compiledPlan),
    [normalized.compiledPlan, plan]
  )

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
