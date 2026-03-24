import { buildSplitAdultPlanSlice } from '@/lib/household/planSlice'
import { buildHouseholdRuntimeLegacyInputs } from '@/lib/household/runtimeLegacyInputs'
import { buildProjectionParams, buildFullProjectionParams } from '@/lib/calculations/projectionParams'
import { generateIncomeProjection } from '@/lib/calculations/income'
import { computeBaseProjection } from '@/lib/calculations/effectiveIncome'
import type { HouseholdPlan } from '@/lib/household/types'
import type { AllocationState, SimulationState } from '@/lib/types'

/**
 * Compute a single adult's FIRE age from a multi-adult household plan.
 *
 * Pipeline:
 * 1. Slice the plan for one adult (shared items split 50/50)
 * 2. Convert to legacy runtime inputs
 * 3. Build income projection params
 * 4. Run income projection
 * 5. Build full projection params + FIRE metrics
 * 6. Return fireAge
 *
 * Pure function: no React hooks, no store reads.
 */
export function computePerAdultFireAge(
  plan: HouseholdPlan,
  adultId: string,
  allocation: Pick<AllocationState, 'currentWeights' | 'targetWeights' | 'returnOverrides' | 'glidePathConfig' | 'validationErrors'>,
  simulation: Pick<SimulationState, 'selectedStrategy' | 'strategyParams' | 'withdrawalBasis'>,
): number | null {
  const sliceResult = buildSplitAdultPlanSlice(plan, adultId, 0.5)
  if (!sliceResult) return null

  const { slice, adultAges } = sliceResult
  const { profile, income, property } = buildHouseholdRuntimeLegacyInputs(slice)

  const incomeParams = buildProjectionParams(
    { ...profile, ...adultAges },
    income,
    property,
  )
  if (!incomeParams) return null

  const incomeProjection = generateIncomeProjection(incomeParams)
  const baseIncomeProjection = computeBaseProjection(incomeParams) ?? undefined

  const { fireMetrics } = buildFullProjectionParams({
    profile,
    income,
    property,
    allocation,
    simulation,
    ages: adultAges,
    incomeProjection,
    baseIncomeProjection,
  })

  return fireMetrics.fireAge ?? null
}
