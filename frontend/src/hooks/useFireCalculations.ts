import { useMemo } from 'react'
import type { FireMetrics } from '@/lib/types'
import { useNormalizedLegacyAnalysisContext } from '@/hooks/useIncomeProjection'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { buildHouseholdRuntimeLegacyInputs } from '@/lib/household/runtimeLegacyInputs'
import { computeMetricSnapshot, getBaseInputs } from '@/hooks/useWhatIfMetrics'

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
  const allocation = useAllocationStore()
  const normalized = useNormalizedLegacyAnalysisContext()
  const { profile, income, property } = useMemo(
    () => buildHouseholdRuntimeLegacyInputs(plan, normalized.compiledPlan),
    [normalized.compiledPlan, plan]
  )

  return useMemo(() => {
    if (hasValidationErrors) {
      return { metrics: null, hasErrors: true, errors: {} }
    }

    const { fireMetrics: metrics } = computeMetricSnapshot(
      getBaseInputs(profile, income, allocation, property, {
        currentAge: normalized.currentAge,
        retirementAge: normalized.retirementAge,
        lifeExpectancy: normalized.lifeExpectancy,
      })
    )

    return { metrics, hasErrors: false, errors: {} }
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization -- Uses shared base-input assembly across full store refs; whole refs avoid stale omissions
  }, [allocation, hasValidationErrors, income, normalized.currentAge, normalized.lifeExpectancy, normalized.retirementAge, profile, property])
}
