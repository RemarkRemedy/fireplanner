import { useMemo } from 'react'
import type { FireMetrics, CpfHousingMode } from '@/lib/types'
import { calculateAllFireMetrics } from '@/lib/calculations/fire'
import { computeCashReserveOffset } from '@/lib/calculations/cashReserve'
import { calculatePortfolioReturn } from '@/lib/calculations/portfolio'
import { generateIncomeProjection } from '@/lib/calculations/income'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { usePropertyStore } from '@/stores/usePropertyStore'
import { useHouseholdStore } from '@/stores/useHouseholdStore'
import { useIncomeProjection } from '@/hooks/useIncomeProjection'
import { ASSET_CLASSES } from '@/lib/data/historicalReturns'

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
  const household = useHouseholdStore()
  const { projection: incomeProjection, hasErrors: projectionHasErrors, isHousehold } = useIncomeProjection()

  return useMemo(() => {
    const profileErrors = profile.validationErrors

    // If profile has validation errors, don't compute
    if (Object.keys(profileErrors).length > 0) {
      return { metrics: null, hasErrors: true, errors: profileErrors }
    }

    // If income projection has errors, don't compute
    if (projectionHasErrors) {
      return { metrics: null, hasErrors: true, errors: {} }
    }

    // Calculate CPF total and effective income based on mode
    let cpfTotal = 0
    let effectiveIncome = profile.annualIncome

    if (isHousehold && household.householdMode && incomeProjection && incomeProjection.length > 0) {
      // HOUSEHOLD MODE: Use aggregated data from household projection
      const firstRow = incomeProjection[0] as import('@/lib/types').HouseholdIncomeProjectionRow
      cpfTotal = firstRow.totalCpfOA + firstRow.totalCpfSA + firstRow.totalCpfMA + firstRow.totalCpfRA
      effectiveIncome = firstRow.totalGross
    } else {
      // SINGLE-PERSON MODE: Use profile store CPF
      cpfTotal = profile.cpfOA + profile.cpfSA + profile.cpfMA + profile.cpfRA

      // Try to get effective income from income projection
      if (incomeProjection && incomeProjection.length > 0) {
        const firstRow = incomeProjection[0] as import('@/lib/types').IncomeProjectionRow
        effectiveIncome = firstRow.totalGross
      }
    }

    // Use portfolio expected return from allocation when user has opted in and allocation is valid
    let expectedReturn = profile.expectedReturn
    const allocationErrors = allocation.validationErrors
    const allocationHasErrors = Object.keys(allocationErrors).length > 0

    if (profile.usePortfolioReturn && !allocationHasErrors) {
      const effectiveReturns = ASSET_CLASSES.map((ac, i) =>
        allocation.returnOverrides[i] ?? ac.expectedReturn
      )
      expectedReturn = calculatePortfolioReturn(allocation.currentWeights, effectiveReturns)
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
  }, [
    household.householdMode,
    household.persons,
    incomeProjection,
    projectionHasErrors,
    isHousehold,
    profile.currentAge,
    profile.retirementAge,
    profile.lifeExpectancy,
    profile.annualIncome,
    profile.annualExpenses,
    profile.liquidNetWorth,
    profile.cpfOA,
    profile.cpfSA,
    profile.cpfMA,
    profile.cpfRA,
    profile.swr,
    profile.expectedReturn,
    profile.usePortfolioReturn,
    profile.inflation,
    profile.expenseRatio,
    profile.fireType,
    profile.fireNumberBasis,
    profile.retirementSpendingAdjustment,
    profile.srsAnnualContribution,
    profile.cpfLifeStartAge,
    profile.cpfLifePlan,
    profile.cpfRetirementSum,
    profile.cpfTopUpOA,
    profile.cpfTopUpSA,
    profile.cpfTopUpMA,
    property.mortgageCpfMonthly,
    property.existingMortgageRemainingYears,
    profile.validationErrors,
    allocation.currentWeights,
    allocation.returnOverrides,
    allocation.validationErrors,
    property.ownsProperty,
    property.existingPropertyValue,
    property.existingMortgageBalance,
    property.ownershipPercent,
    profile.parentSupportEnabled,
    profile.parentSupport,
    profile.healthcareConfig,
    profile.cashReserveEnabled,
    profile.cashReserveMode,
    profile.cashReserveFixedAmount,
    profile.cashReserveMonths,
    profile.cashReserveReturn,
    profile.lockedAssets,
    profile.expenseAdjustments,
  ])
}
