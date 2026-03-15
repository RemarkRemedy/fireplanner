import { useMemo } from 'react'
import { calculateAllFireMetrics, projectPortfolioAtRetirement } from '@/lib/calculations/fire'
import { computeCashReserveOffset } from '@/lib/calculations/cashReserve'
import { calculatePortfolioReturn, getEffectiveReturns } from '@/lib/calculations/portfolio'
import { generateIncomeProjection } from '@/lib/calculations/income'
import { useNormalizedLegacyAnalysisContext } from '@/hooks/useIncomeProjection'
import type {
  AllocationState,
  FireMetrics,
  IncomeProjectionRow,
  IncomeState,
  ProfileState,
  PropertyState,
} from '@/lib/types'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { getEffectiveExpenses } from '@/lib/calculations/expenses'
import { buildProjectionParams } from '@/hooks/useIncomeProjection'
import { buildHouseholdRuntimeLegacyInputs } from '@/lib/household/runtimeLegacyInputs'

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

type TimingOverride = Pick<ProfileState, 'currentAge' | 'retirementAge' | 'lifeExpectancy'>

export function resolveEffectiveIncome(
  profile: Pick<ProfileState, 'annualIncome'>,
  projection: IncomeProjectionRow[] | null | undefined,
): number {
  return projection && projection.length > 0
    ? projection[0].totalGross
    : profile.annualIncome
}

export function buildBaseInputsFromEffectiveIncome(
  profile: ProfileState,
  allocation: Pick<AllocationState, 'currentWeights' | 'returnOverrides' | 'validationErrors'>,
  property: PropertyState,
  effectiveIncome: number,
  timingOverride?: TimingOverride,
  postRetirementIncome?: number,
) {
  const cpfTotal = profile.cpfOA + profile.cpfSA + profile.cpfMA + profile.cpfRA
  const currentAge = timingOverride?.currentAge ?? profile.currentAge
  const retirementAge = timingOverride?.retirementAge ?? profile.retirementAge
  const lifeExpectancy = timingOverride?.lifeExpectancy ?? profile.lifeExpectancy

  let expectedReturn = profile.expectedReturn
  const allocationHasErrors = Object.keys(allocation.validationErrors).length > 0
  if (profile.usePortfolioReturn && !allocationHasErrors) {
    expectedReturn = calculatePortfolioReturn(allocation.currentWeights, getEffectiveReturns(allocation.returnOverrides))
  }

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

  return {
    currentAge,
    retirementAge,
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
    lifeExpectancy,
    retirementSpendingAdjustment: profile.retirementSpendingAdjustment,
    propertyEquity,
    parentSupport: profile.parentSupport,
    parentSupportEnabled: profile.parentSupportEnabled,
    healthcareConfig: profile.healthcareConfig?.enabled ? profile.healthcareConfig : null,
    cashReserveOffset,
    lockedAssets: profile.lockedAssets,
    postRetirementIncome,
  }
}

export function getBaseInputs(
  profile: ProfileState,
  income: IncomeState,
  allocation: AllocationState,
  property: PropertyState,
  timingOverride?: TimingOverride,
) {
  const currentAge = timingOverride?.currentAge ?? profile.currentAge
  const retirementAge = timingOverride?.retirementAge ?? profile.retirementAge
  const lifeExpectancy = timingOverride?.lifeExpectancy ?? profile.lifeExpectancy

  const projectionParams = buildProjectionParams({
    ...profile,
    currentAge,
    retirementAge,
    lifeExpectancy,
  }, income, property)
  const projection = projectionParams
    ? generateIncomeProjection(projectionParams)
    : null

  // Extract passive post-retirement income from first retired row, deflated to today's dollars.
  // Excludes salary (employment income defeats the FIRE concept).
  let postRetirementIncome: number | undefined
  if (projection) {
    const firstRetiredRow = projection.find((r) => r.isRetired)
    if (firstRetiredRow) {
      const passiveNominal = firstRetiredRow.governmentIncome
        + firstRetiredRow.rentalIncome
        + firstRetiredRow.investmentIncome
        + firstRetiredRow.businessIncome
        + firstRetiredRow.srsWithdrawal
      const yearsToRetired = firstRetiredRow.age - currentAge
      postRetirementIncome = yearsToRetired > 0 && profile.inflation > 0
        ? passiveNominal / Math.pow(1 + profile.inflation, yearsToRetired)
        : passiveNominal
    }
  }

  return buildBaseInputsFromEffectiveIncome(
    profile,
    allocation,
    property,
    resolveEffectiveIncome(profile, projection),
    { currentAge, retirementAge, lifeExpectancy },
    postRetirementIncome,
  )
}

export type WhatIfBaseInputs = ReturnType<typeof buildBaseInputsFromEffectiveIncome>

export function computeMetricSnapshot(inputs: WhatIfBaseInputs): {
  fireMetrics: FireMetrics
  portfolioAtRetirement: number
} {
  const fireMetrics = calculateAllFireMetrics(inputs)
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

  return { fireMetrics, portfolioAtRetirement }
}

export function computeMetrics(inputs: WhatIfBaseInputs) {
  const { fireMetrics, portfolioAtRetirement } = computeMetricSnapshot(inputs)

  return {
    fireNumber: fireMetrics.fireNumber,
    yearsToFire: fireMetrics.yearsToFire,
    fireAge: fireMetrics.fireAge,
    portfolioAtRetirement,
  }
}

/**
 * Hook for What-If slider analysis. Takes temporary overrides and computes
 * base vs. overridden FIRE metrics + deltas. All computation is instant
 * (no Web Worker needed).
 */
export function useWhatIfMetrics(overrides: WhatIfOverrides): WhatIfMetricsResult {
  const plan = useHouseholdPlanStore((state) => state.plan)
  const hasValidationErrors = useHouseholdPlanStore((state) => state.hasValidationErrors)
  const allocation = useAllocationStore()
  const normalized = useNormalizedLegacyAnalysisContext()
  const { profile, income, property } = useMemo(
    () => buildHouseholdRuntimeLegacyInputs(plan, normalized.compiledPlan),
    [normalized.compiledPlan, plan]
  )

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- Granular deps intentional for perf
  return useMemo(() => {
    if (hasValidationErrors) {
      return { baseMetrics: null, overrideMetrics: null, deltas: null, hasData: false }
    }

    const baseInputs = getBaseInputs(profile, income, allocation, property, {
      currentAge: normalized.currentAge,
      retirementAge: normalized.retirementAge,
      lifeExpectancy: normalized.lifeExpectancy,
    })
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
    allocation, hasValidationErrors, income, normalized.currentAge, normalized.lifeExpectancy, normalized.retirementAge, profile, property,
    overrides.annualExpenses, overrides.annualIncome, overrides.swr,
    overrides.expectedReturn, overrides.retirementAge, overrides.liquidNetWorth,
  ])
}
