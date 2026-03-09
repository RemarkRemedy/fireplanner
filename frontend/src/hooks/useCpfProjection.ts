import { useMemo } from 'react'
import { useIncomeProjection } from '@/hooks/useIncomeProjection'
import { useNormalizedLegacyAnalysisContext } from '@/hooks/useIncomeProjection'
import { useHouseholdRuntimeInputs } from '@/hooks/useHouseholdRuntimeInputs'
import { buildCpfProjectionRows } from '@/lib/household/cpfProjectionRows'

export interface CpfProjectionRow {
  age: number
  oaBalance: number
  saBalance: number
  maBalance: number
  raBalance: number
  totalBalance: number
  annualContribution: number
  annualInterest: number
  cpfLifePayout: number
  oaHousingDeduction: number
  oaShortfall: number
  cpfisOA: number
  cpfisSA: number
  cpfisReturn: number
  bequest: number
  milestone: 'brs' | 'frs' | 'ers' | 'cpfLifeStart' | 'raCreated' | null
  milestoneFormula: string | null
}

/**
 * Derived hook: reads CPF data from income projection rows and
 * reshapes for CPF-specific table display. Annotates milestone years
 * when total CPF crosses BRS/FRS/ERS thresholds or CPF LIFE starts.
 */
export function useCpfProjection(): {
  rows: CpfProjectionRow[] | null
  hasErrors: boolean
} {
  const { projection, hasErrors } = useIncomeProjection()
  const normalized = useNormalizedLegacyAnalysisContext()
  const { profile } = useHouseholdRuntimeInputs()
  const cpfLifeStartAge = profile.cpfLifeStartAge
  const cpfLifePlan = profile.cpfLifePlan
  const currentAge = profile.currentAge
  const normalizedSlot = normalized.entry.selectors.cpf?.cpfByAdultId[normalized.referenceAdultId]

  return useMemo(() => {
    if (hasErrors) {
      return { rows: null, hasErrors: true }
    }

    if (normalizedSlot?.rows.length) {
      return {
        rows: normalizedSlot.rows.map((row) => ({
          age: row.age,
          oaBalance: row.oaBalance,
          saBalance: row.saBalance,
          maBalance: row.maBalance,
          raBalance: row.raBalance,
          totalBalance: row.totalBalance,
          annualContribution: row.annualContribution,
          annualInterest: row.annualInterest,
          cpfLifePayout: row.cpfLifePayout,
          oaHousingDeduction: row.oaHousingDeduction,
          oaShortfall: row.oaShortfall,
          cpfisOA: row.cpfisOA,
          cpfisSA: row.cpfisSA,
          cpfisReturn: row.cpfisReturn,
          bequest: row.bequest,
          milestone: row.milestone,
          milestoneFormula: row.milestoneFormula,
        })),
        hasErrors: false,
      }
    }

    if (!projection || projection.length === 0) {
      return { rows: null, hasErrors: true }
    }

    const rows: CpfProjectionRow[] = buildCpfProjectionRows({
      currentAge,
      cpfLifePlan,
      cpfLifeStartAge,
      projection,
    })

    return { rows, hasErrors: false }
  }, [
    currentAge,
    cpfLifePlan,
    cpfLifeStartAge,
    hasErrors,
    normalizedSlot,
    projection,
  ])
}
