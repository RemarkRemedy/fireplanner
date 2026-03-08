import { useMemo } from 'react'
import type { FireMetrics } from '@/lib/types'
import { calculateAllFireMetrics } from '@/lib/calculations/fire'
import { useNormalizedLegacyAnalysisContext } from '@/hooks/useIncomeProjection'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { usePropertyStore } from '@/stores/usePropertyStore'
import { getBaseInputs } from '@/hooks/useWhatIfMetrics'

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
  const normalized = useNormalizedLegacyAnalysisContext()

  return useMemo(() => {
    const profileErrors = profile.validationErrors

    // If profile has validation errors, don't compute
    if (Object.keys(profileErrors).length > 0) {
      return { metrics: null, hasErrors: true, errors: profileErrors }
    }

    const metrics = calculateAllFireMetrics(
      getBaseInputs(profile, income, allocation, property, {
        currentAge: normalized.currentAge,
        retirementAge: normalized.retirementAge,
        lifeExpectancy: normalized.lifeExpectancy,
      })
    )

    return { metrics, hasErrors: false, errors: {} }
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization -- Uses shared base-input assembly across full store refs; whole refs avoid stale omissions
  }, [allocation, income, normalized.currentAge, normalized.lifeExpectancy, normalized.retirementAge, profile, property])
}
