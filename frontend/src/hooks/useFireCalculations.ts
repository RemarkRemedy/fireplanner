import { useMemo } from 'react'
import type { FireMetrics } from '@/lib/types'
import { calculateAllFireMetrics } from '@/lib/calculations/fire'
import { computeCashReserveOffset } from '@/lib/calculations/cashReserve'
import { calculatePortfolioReturn, getEffectiveReturns } from '@/lib/calculations/portfolio'
import { generateIncomeProjection } from '@/lib/calculations/income'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { usePropertyStore } from '@/stores/usePropertyStore'
import { buildProjectionParams } from '@/hooks/useIncomeProjection'

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
  const profile = useProfileStore()
  const income = useIncomeStore()
  const allocation = useAllocationStore()
  const property = usePropertyStore()

  return useMemo(() => {
    const profileErrors = profile.validationErrors

    // If profile has validation errors, don't compute
    if (Object.keys(profileErrors).length > 0) {
      return { metrics: null, hasErrors: true, errors: profileErrors }
    }

    const cpfTotal = profile.cpfOA + profile.cpfSA + profile.cpfMA + profile.cpfRA

    // Try to get effective income from income projection
    let effectiveIncome = profile.annualIncome
    const projectionParams = buildProjectionParams(profile, income, property)
    if (projectionParams) {
      const projection = generateIncomeProjection(projectionParams)
      if (projection.length > 0) {
        effectiveIncome = projection[0].totalGross
      }
    }

    // Use portfolio expected return from allocation when user has opted in and allocation is valid
    let expectedReturn = profile.expectedReturn
    const allocationErrors = allocation.validationErrors
    const allocationHasErrors = Object.keys(allocationErrors).length > 0

    if (profile.usePortfolioReturn && !allocationHasErrors) {
      expectedReturn = calculatePortfolioReturn(allocation.currentWeights, getEffectiveReturns(allocation.returnOverrides))
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
      currentAge: profile.currentAge,
      retirementAge: profile.retirementAge,
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
      lifeExpectancy: profile.lifeExpectancy,
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
  }, [profile, income, allocation, property])
}
