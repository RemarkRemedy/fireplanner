import { useMemo } from 'react'
import type { FireMetrics } from '@/lib/types'
import { calculateAllFireMetrics } from '@/lib/calculations/fire'
import { computeCashReserveOffset } from '@/lib/calculations/cashReserve'
import { calculatePortfolioReturn, getEffectiveReturns } from '@/lib/calculations/portfolio'
import { generateIncomeProjection } from '@/lib/calculations/income'
import { useNormalizedLegacyAnalysisContext } from '@/hooks/useIncomeProjection'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { buildProjectionParams } from '@/hooks/useIncomeProjection'
import { buildHouseholdRuntimeLegacyInputs } from '@/lib/household/runtimeLegacyInputs'

interface FireCalculationsResult {
  metrics: FireMetrics | null
  hasErrors: boolean
  errors: Record<string, string>
}

/**
 * Derived hook: reads profile + income + allocation stores, checks validation, computes FIRE metrics.
 * When allocation has no validation errors, uses portfolio expected return from Markowitz
 * instead of profile.expectedReturn. Falls back to profile.expectedReturn when allocation has errors.
 * When income projection is available, uses row 0's totalGross as effective income.
 */
export function useFireCalculations(): FireCalculationsResult {
  const plan = useHouseholdPlanStore((state) => state.plan)
  const hasValidationErrors = useHouseholdPlanStore((state) => state.hasValidationErrors)
  // Allocation: only 3 fields used — subscribe via selectors instead of full store
  const allocationValidationErrors = useAllocationStore((s) => s.validationErrors)
  const allocationCurrentWeights = useAllocationStore((s) => s.currentWeights)
  const allocationReturnOverrides = useAllocationStore((s) => s.returnOverrides)
  const normalized = useNormalizedLegacyAnalysisContext()
  const { profile, income, property } = useMemo(
    () => buildHouseholdRuntimeLegacyInputs(plan, normalized.compiledPlan),
    [normalized.compiledPlan, plan]
  )

  return useMemo(() => {
    if (hasValidationErrors) {
      return { metrics: null, hasErrors: true, errors: {} }
    }

    const cpfTotal = profile.cpfOA + profile.cpfSA + profile.cpfMA + profile.cpfRA

    // Try to get effective income from income projection
    let effectiveIncome = profile.annualIncome
    const projectionParams = buildProjectionParams({
      ...profile,
      currentAge: normalized.currentAge,
      retirementAge: normalized.retirementAge,
      lifeExpectancy: normalized.lifeExpectancy,
    }, income, property)
    if (projectionParams) {
      const projection = generateIncomeProjection(projectionParams)
      if (projection.length > 0) {
        effectiveIncome = projection[0].totalGross
      }
    }

    // Use portfolio expected return from allocation when user has opted in and allocation is valid
    let expectedReturn = profile.expectedReturn
    const allocationHasErrors = Object.keys(allocationValidationErrors).length > 0

    if (profile.usePortfolioReturn && !allocationHasErrors) {
      expectedReturn = calculatePortfolioReturn(allocationCurrentWeights, getEffectiveReturns(allocationReturnOverrides))
    }

    // Compute property equity from existing property (scaled by ownership %)
    const ownershipPct = property.ownershipPercent ?? 1
    const propertyEquity = property.ownsProperty
      ? Math.max(0, property.existingPropertyValue - property.existingMortgageBalance) * ownershipPct
      : 0

    const cashReserveOffset = computeCashReserveOffset(
      profile.liquidNetWorth,
      profile.cashReserveEnabled,
      profile.cashReserveMode,
      profile.cashReserveFixedAmount,
      profile.cashReserveMonths,
      profile.annualExpenses,
    )

    const metrics = calculateAllFireMetrics({
      currentAge: normalized.currentAge,
      retirementAge: normalized.retirementAge,
      annualIncome: effectiveIncome,
      annualExpenses: profile.annualExpenses,
      liquidNetWorth: profile.liquidNetWorth,
      cpfTotal,
      swr: profile.swr,
      expectedReturn,
      inflation: profile.inflation,
      expenseRatio: profile.expenseRatio,
      fireType: profile.fireType,
      fireNumberBasis: profile.fireNumberBasis,
      cpfLifeStartAge: profile.cpfLifeStartAge,
      lifeExpectancy: normalized.lifeExpectancy,
      retirementSpendingAdjustment: profile.retirementSpendingAdjustment,
      propertyEquity,
      parentSupport: profile.parentSupport,
      parentSupportEnabled: profile.parentSupportEnabled,
      healthcareConfig: profile.healthcareConfig?.enabled ? profile.healthcareConfig : null,
      cashReserveOffset,
      lockedAssets: profile.lockedAssets,
      expenseAdjustments: profile.expenseAdjustments,
    })

    return { metrics, hasErrors: false, errors: {} }
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization -- Uses buildProjectionParams which reads many store fields; whole refs avoid stale omissions
  }, [hasValidationErrors, income, normalized.currentAge, normalized.lifeExpectancy, normalized.retirementAge, profile, property, allocationValidationErrors, allocationCurrentWeights, allocationReturnOverrides])
}
