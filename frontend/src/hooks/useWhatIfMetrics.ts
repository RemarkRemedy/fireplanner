import { useMemo } from 'react'
import { generateIncomeProjection } from '@/lib/calculations/income'
import { resolveEffectiveIncome, computeBaseProjection, resolveEffectivePostRetirementIncome } from '@/lib/calculations/effectiveIncome'
import { useNormalizedLegacyAnalysisContext } from '@/hooks/useIncomeProjection'
import type {
  AllocationState,
  IncomeState,
  ProfileState,
  PropertyState,
} from '@/lib/types'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { buildProjectionParams } from '@/hooks/useIncomeProjection'
import { buildHouseholdRuntimeLegacyInputs } from '@/lib/household/runtimeLegacyInputs'
import {
  buildBaseInputsFromEffectiveIncome,
  computeMetricSnapshot,
  type WhatIfBaseInputs,
} from '@/lib/calculations/fireInputs'

export { resolveEffectiveIncome }
export { buildBaseInputsFromEffectiveIncome, computeMetricSnapshot, type WhatIfBaseInputs }

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
  const baseProjection = projectionParams ? computeBaseProjection(projectionParams) : null

  const postRetirementIncome = resolveEffectivePostRetirementIncome(
    projection ?? [],
    baseProjection,
    currentAge,
    profile.inflation,
  )

  return buildBaseInputsFromEffectiveIncome(
    profile,
    allocation,
    property,
    resolveEffectiveIncome(profile, projection, baseProjection),
    { currentAge, retirementAge, lifeExpectancy },
    postRetirementIncome,
  )
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
