import { useMemo } from 'react'
import { calculateAllFireMetrics, projectPortfolioAtRetirement } from '@/lib/calculations/fire'
import { calculatePortfolioReturn, getEffectiveReturns } from '@/lib/calculations/portfolio'
import { generateIncomeProjection } from '@/lib/calculations/income'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { usePropertyStore } from '@/stores/usePropertyStore'
import { getEffectiveExpenses } from '@/lib/calculations/expenses'
import { buildProjectionParams } from '@/hooks/useIncomeProjection'

export interface WhatIfOverrides {
  annualExpenses?: number
  annualIncome?: number
  swr?: number
  expectedReturn?: number
  retirementAge?: number
  liquidNetWorth?: number
}

export interface WhatIfDeltas {
  fireNumber: number
  yearsToFire: number
  fireAge: number
  portfolioAtRetirement: number
}

export interface WhatIfMetricsResult {
  baseMetrics: {
    fireNumber: number
    yearsToFire: number
    fireAge: number
    portfolioAtRetirement: number
  } | null
  overrideMetrics: {
    fireNumber: number
    yearsToFire: number
    fireAge: number
    portfolioAtRetirement: number
  } | null
  deltas: WhatIfDeltas | null
  hasData: boolean
}

export function getBaseInputs(
  profile: ReturnType<typeof useProfileStore.getState>,
  income: ReturnType<typeof useIncomeStore.getState>,
  allocation: ReturnType<typeof useAllocationStore.getState>,
  property: ReturnType<typeof usePropertyStore.getState>,
) {
  const cpfTotal = profile.cpfOA + profile.cpfSA + profile.cpfMA + profile.cpfRA

  // Effective income from income projection
  let effectiveIncome = profile.annualIncome
  const projectionParams = buildProjectionParams(profile, income, property)
  if (projectionParams) {
    const projection = generateIncomeProjection(projectionParams)
    if (projection.length > 0) {
      effectiveIncome = projection[0].totalGross
    }
  }

  // Portfolio expected return
  let expectedReturn = profile.expectedReturn
  const allocationHasErrors = Object.keys(allocation.validationErrors).length > 0
  if (profile.usePortfolioReturn && !allocationHasErrors) {
    expectedReturn = calculatePortfolioReturn(allocation.currentWeights, getEffectiveReturns(allocation.returnOverrides))
  }

  const ownershipPct = property.ownershipPercent ?? 1
  const propertyEquity = property.ownsProperty
    ? Math.max(0, property.existingPropertyValue - property.existingMortgageBalance) * ownershipPct
    : 0

  return {
    currentAge: profile.currentAge,
    retirementAge: profile.retirementAge,
    annualIncome: effectiveIncome,
    annualExpenses: profile.annualExpenses,
    expenseAdjustments: profile.expenseAdjustments,
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
  }
}

export type WhatIfBaseInputs = ReturnType<typeof getBaseInputs>

export function computeMetrics(inputs: WhatIfBaseInputs) {
  const metrics = calculateAllFireMetrics(inputs)
  const netRealReturn = inputs.expectedReturn - inputs.inflation - inputs.expenseRatio
  const currentExpenses = getEffectiveExpenses(inputs.currentAge, inputs.annualExpenses, inputs.expenseAdjustments ?? [], inputs.lifeExpectancy)
  const annualSavings = inputs.annualIncome - currentExpenses
  const yearsToRetirement = Math.max(0, inputs.retirementAge - inputs.currentAge)

  const portfolioAtRetirement = projectPortfolioAtRetirement({
    currentNW: inputs.liquidNetWorth + inputs.cpfTotal,
    annualSavings,
    netRealReturn,
    yearsToRetirement,
  })

  return {
    fireNumber: metrics.fireNumber,
    yearsToFire: metrics.yearsToFire,
    fireAge: metrics.fireAge,
    portfolioAtRetirement,
  }
}

/**
 * Hook for What-If slider analysis. Takes temporary overrides and computes
 * base vs. overridden FIRE metrics + deltas. All computation is instant
 * (no Web Worker needed).
 */
export function useWhatIfMetrics(overrides: WhatIfOverrides): WhatIfMetricsResult {
  const profile = useProfileStore()
  const income = useIncomeStore()
  const allocation = useAllocationStore()
  const property = usePropertyStore()

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- Granular deps intentional for perf
  return useMemo(() => {
    const profileErrors = profile.validationErrors
    if (Object.keys(profileErrors).length > 0) {
      return { baseMetrics: null, overrideMetrics: null, deltas: null, hasData: false }
    }

    const baseInputs = getBaseInputs(profile, income, allocation, property)
    const baseMetrics = computeMetrics(baseInputs)

    // Apply overrides
    const hasOverrides = Object.values(overrides).some((v) => v !== undefined)
    if (!hasOverrides) {
      return { baseMetrics, overrideMetrics: baseMetrics, deltas: null, hasData: true }
    }

    const overriddenInputs = {
      ...baseInputs,
      ...(overrides.annualExpenses !== undefined && { annualExpenses: overrides.annualExpenses }),
      ...(overrides.annualIncome !== undefined && { annualIncome: overrides.annualIncome }),
      ...(overrides.swr !== undefined && { swr: overrides.swr }),
      ...(overrides.expectedReturn !== undefined && { expectedReturn: overrides.expectedReturn }),
      ...(overrides.retirementAge !== undefined && { retirementAge: overrides.retirementAge }),
      ...(overrides.liquidNetWorth !== undefined && { liquidNetWorth: overrides.liquidNetWorth }),
    }

    const overrideMetrics = computeMetrics(overriddenInputs)

    const deltas: WhatIfDeltas = {
      fireNumber: overrideMetrics.fireNumber - baseMetrics.fireNumber,
      yearsToFire: isFinite(overrideMetrics.yearsToFire) && isFinite(baseMetrics.yearsToFire)
        ? overrideMetrics.yearsToFire - baseMetrics.yearsToFire
        : NaN,
      fireAge: isFinite(overrideMetrics.fireAge) && isFinite(baseMetrics.fireAge)
        ? overrideMetrics.fireAge - baseMetrics.fireAge
        : NaN,
      portfolioAtRetirement: overrideMetrics.portfolioAtRetirement - baseMetrics.portfolioAtRetirement,
    }

    return { baseMetrics, overrideMetrics, deltas, hasData: true }
  }, [
    profile, income, allocation, property,
    overrides.annualExpenses, overrides.annualIncome, overrides.swr,
    overrides.expectedReturn, overrides.retirementAge, overrides.liquidNetWorth,
  ])
}
