import { useMemo } from 'react'
import { useNormalizedLegacyAnalysisContext } from '@/hooks/useIncomeProjection'
import type { FireMetrics, ProjectionRow, ProjectionSummary } from '@/lib/types'
import { generateProjection, type ProjectionParams } from '@/lib/calculations/projection'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { useIncomeProjection } from '@/hooks/useIncomeProjection'
import { buildHouseholdRuntimeLegacyInputs } from '@/lib/household/runtimeLegacyInputs'
import { buildFullProjectionParams } from '@/lib/calculations/projectionParams'

interface ProjectionResult {
  fireMetrics: FireMetrics | null
  rows: ProjectionRow[] | null
  summary: ProjectionSummary | null
  params: ProjectionParams | null
  hasErrors: boolean
  errors: Record<string, string>
}

/**
 * Derived hook: reads profile, income, allocation, and simulation stores,
 * computes the full year-by-year projection combining income engine,
 * portfolio growth, and withdrawal strategy.
 *
 * Returns null rows/summary when upstream validation fails.
 */
export function useProjection(): ProjectionResult {
  const plan = useHouseholdPlanStore((state) => state.plan)
  const allocation = useAllocationStore()
  const simulation = useSimulationStore()
  const normalized = useNormalizedLegacyAnalysisContext()
  const { profile, income, property, healthcareCashOutlayByYear } = useMemo(
    () => buildHouseholdRuntimeLegacyInputs(plan, normalized.compiledPlan),
    [normalized.compiledPlan, plan]
  )
  const { projection: incomeProjection, hasErrors: incomeHasErrors, errors: incomeErrors } = useIncomeProjection()

  return useMemo(() => {
    if (incomeHasErrors || !incomeProjection) {
      return { fireMetrics: null, rows: null, summary: null, params: null, hasErrors: true, errors: incomeErrors }
    }

    const { params, fireMetrics } = buildFullProjectionParams({
      profile,
      income,
      property,
      allocation,
      simulation,
      ages: {
        currentAge: normalized.currentAge,
        retirementAge: normalized.retirementAge,
        lifeExpectancy: normalized.lifeExpectancy,
      },
      incomeProjection,
      healthcareCashOutlayByYear,
    })

    const { rows, summary } = generateProjection(params)

    return { fireMetrics, rows, summary, params, hasErrors: false, errors: {} }
  }, [
    incomeProjection,
    incomeHasErrors,
    incomeErrors,
    profile,
    income,
    property,
    allocation.currentWeights,
    allocation.targetWeights,
    allocation.returnOverrides,
    allocation.glidePathConfig,
    allocation.validationErrors,
    simulation.selectedStrategy,
    simulation.strategyParams,
    simulation.withdrawalBasis,
    normalized.currentAge,
    normalized.lifeExpectancy,
    normalized.retirementAge,
  ])
}
