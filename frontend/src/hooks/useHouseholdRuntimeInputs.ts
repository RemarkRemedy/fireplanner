import { useMemo } from 'react'
import { useNormalizedLegacyAnalysisContext } from '@/hooks/useIncomeProjection'
import { buildHouseholdRuntimeLegacyInputs } from '@/lib/household/runtimeLegacyInputs'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'

export function useHouseholdRuntimeInputs() {
  const plan = useHouseholdPlanStore((state) => state.plan)
  const householdPlanRevision = useHouseholdPlanStore((state) => state.householdPlanRevision)
  const hasValidationErrors = useHouseholdPlanStore((state) => state.hasValidationErrors)
  const normalized = useNormalizedLegacyAnalysisContext()

  const legacyInputs = useMemo(
    () => buildHouseholdRuntimeLegacyInputs(plan, normalized.compiledPlan),
    [normalized.compiledPlan, plan],
  )

  return {
    ...legacyInputs,
    normalized,
    householdPlanRevision,
    hasValidationErrors,
  }
}
