import { useMemo } from 'react'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { useNormalizedLegacyAnalysisContext } from '@/hooks/useIncomeProjection'
import {
  optimizeTaxContributions,
  type TaxOptimizationInput,
  type TaxOptimizationResult,
} from '@/lib/calculations/taxOptimizer'
import { getCpfRatesForAge } from '@/lib/data/cpfRates'
import { OW_CEILING_ANNUAL } from '@/lib/data/cpfRates'
import type { IncomeProjectionRow } from '@/lib/types'

export interface TaxOptimizationHookResult {
  result: TaxOptimizationResult
  adultName: string
  isReady: boolean
}

/**
 * Derived hook that computes tax optimization recommendations for a specific adult.
 * Per-adult scoping: each adult's income, CPF, SRS, and reliefs are used independently.
 */
export function useTaxOptimization(adultId?: string): TaxOptimizationHookResult | null {
  const plan = useHouseholdPlanStore((s) => s.plan)
  const normalized = useNormalizedLegacyAnalysisContext()

  return useMemo(() => {
    const targetId = adultId ?? plan.adults[0]?.id
    const adult = plan.adults.find((a) => a.id === targetId)
    if (!adult) return null

    // Get income projection for CPF employee data
    const adultProjection = normalized?.compiledPlan?.incomeByAdultId?.[targetId]
    const row0: IncomeProjectionRow | undefined = adultProjection?.[0]

    const grossIncome = row0 ? row0.totalGross : adult.annualIncome

    // CPF employee contribution: use projection if available, else estimate from rates
    let cpfEmployeeContribution: number
    if (row0) {
      cpfEmployeeContribution = row0.cpfEmployee
    } else {
      // Estimate from CPF rates and OW ceiling
      const rates = getCpfRatesForAge(adult.currentAge, adult.residencyStatus, adult.prMonths)
      const cappedIncome = Math.min(grossIncome, OW_CEILING_ANNUAL)
      cpfEmployeeContribution = cappedIncome * rates.employeeRate
    }

    // SRS contribution from adult's SRS config
    const currentSrsContribution = adult.srs.annualContribution

    // RSTU: SA + RA voluntary top-ups (these are the cash top-ups that qualify for RSTU relief)
    const currentRstuTopUp = adult.cpf.annualTopUps.sa

    // Personal reliefs from tax profile
    const personalReliefs = adult.taxProfile.personalReliefs

    // Not ready if no income data at all
    const isReady = grossIncome > 0

    const input: TaxOptimizationInput = {
      grossIncome,
      cpfEmployeeContribution,
      currentSrsContribution,
      currentRstuTopUp,
      personalReliefs,
      residencyStatus: adult.residencyStatus,
      age: adult.currentAge,
    }

    const result = optimizeTaxContributions(input)

    return {
      result,
      adultName: adult.displayName,
      isReady,
    }
  }, [plan, adultId, normalized])
}
