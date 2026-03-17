import { useMemo } from 'react'
import { useProjection } from '@/hooks/useProjection'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { useNormalizedLegacyAnalysisContext } from '@/hooks/useIncomeProjection'
import {
  projectNetEstate,
  type EstateProjectionResult,
  type EstateAdultInput,
  type EstateProjectionAtDeath,
} from '@/lib/calculations/estateProjection'

export interface UseEstateProjectionResult {
  estate: EstateProjectionResult | null
  deathAge: number | null
}

/**
 * Derived hook: computes the net estate at the reference adult's expected
 * death age using the deterministic projection output.
 *
 * Returns null when upstream projection has errors or no rows are available.
 */
export function useEstateProjection(): UseEstateProjectionResult {
  const { rows, hasErrors } = useProjection()
  const plan = useHouseholdPlanStore((state) => state.plan)
  const { lifeExpectancy } = useNormalizedLegacyAnalysisContext()

  return useMemo(() => {
    if (hasErrors || !rows || rows.length === 0) {
      return { estate: null, deathAge: null }
    }

    // Find the last projection row (death age)
    const deathRow = rows[rows.length - 1]
    if (!deathRow) {
      return { estate: null, deathAge: null }
    }

    const atDeath: EstateProjectionAtDeath = {
      liquidNW: deathRow.liquidNW,
      cpfOA: deathRow.cpfOA,
      cpfSA: deathRow.cpfSA,
      cpfMA: deathRow.cpfMA,
      cpfRA: deathRow.cpfRA,
      propertyValue: deathRow.propertyValue,
      mortgageBalance: deathRow.mortgageBalance,
      srsBalance: deathRow.srsBalance,
    }

    const adults: EstateAdultInput[] = plan.adults.map((adult) => ({
      funeralCosts: adult.funeralCosts,
      insuranceDeathCoverage: adult.insuranceDeathCoverage,
      nonMortgageDebtTotal: adult.nonMortgageDebtTotal,
    }))

    const estate = projectNetEstate({ atDeath, adults })

    return { estate, deathAge: lifeExpectancy }
  }, [rows, hasErrors, plan.adults, lifeExpectancy])
}
