import { useMemo } from 'react'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { useNormalizedLegacyAnalysisContext } from '@/hooks/useIncomeProjection'
import { isHouseholdPlannerV1Enabled } from '@/lib/household/featureFlag'

/** One row in the per-adult nominal income chart (future dollars). */
export interface AdultIncomeRow {
  age: number
  gross: number
  net: number
  cpfContrib: number
}

/** One row in the per-adult CPF balance chart. */
export interface AdultCpfRow {
  age: number
  /** Non-invested OA balance */
  oa: number
  /** Non-invested SA balance */
  sa: number
  ma: number
  ra: number
  /** CPFIS-invested OA */
  cpfisOA: number
  /** CPFIS-invested SA */
  cpfisSA: number
}

export interface AdultBreakdown {
  id: string
  displayName: string
  currentAge: number
  retirementAge: number
  lifeExpectancy: number
  /** From plan's annualIncome field (today's dollars). */
  annualIncome: number
  /** Personal annual expenses only (shared household costs excluded). */
  annualExpenses: number
  liquidNetWorth: number
  cpfOA: number
  cpfSA: number
  cpfMA: number
  cpfRA: number
  cpfTotal: number
  cpfLifeMonthlyPayout: number
  totalNetWorth: number
  /** This adult's share of total household income at Year 0 (0-1). */
  incomeSharePct: number
  /** This adult's share of total household net worth (0-1). */
  netWorthSharePct: number
  /** Nominal (future-dollar) income rows for trajectory chart. Empty array if unavailable. */
  incomeRows: AdultIncomeRow[]
  /** CPF balance rows for CPF chart. Empty array if unavailable. */
  cpfRows: AdultCpfRow[]
}

export interface PerAdultBreakdownResult {
  adults: AdultBreakdown[]
  householdTotalIncome: number
  householdTotalNetWorth: number
}

export function usePerAdultBreakdown(): PerAdultBreakdownResult | null {
  const plan = useHouseholdPlanStore((s) => s.plan)
  const normalized = useNormalizedLegacyAnalysisContext()
  const isEnabled = isHouseholdPlannerV1Enabled()

  return useMemo(() => {
    if (!isEnabled || plan.adults.length < 2) return null

    // useNormalizedLegacyAnalysisContext() is non-nullable; compiledPlan is always present.
    const compiledPlan = normalized.compiledPlan

    const adults: AdultBreakdown[] = plan.adults.map((adult) => {
      const cpfOA = adult.cpf.balances.oa
      const cpfSA = adult.cpf.balances.sa
      const cpfMA = adult.cpf.balances.ma
      const cpfRA = adult.cpf.balances.ra
      const cpfTotal = cpfOA + cpfSA + cpfMA + cpfRA

      // Income rows: nominal projections from compiled plan.
      // Use row.age directly (matches IncomeProjectionRow.age field).
      const rawIncomeRows = compiledPlan.incomeByAdultId?.[adult.id] ?? []
      const incomeRows: AdultIncomeRow[] = rawIncomeRows.map((row) => ({
        age: row.age,
        gross: row.totalGross,
        net: row.totalNet,
        cpfContrib: (row.cpfEmployee ?? 0) + (row.cpfEmployer ?? 0),
      }))

      // CPF rows from compiled plan.
      const rawCpfRows = compiledPlan.cpfByAdultId?.[adult.id]?.rows ?? []
      const cpfRows: AdultCpfRow[] = rawCpfRows.map((row) => ({
        age: row.age,
        oa: row.oaBalance,
        sa: row.saBalance,
        ma: row.maBalance,
        ra: row.raBalance ?? 0,
        cpfisOA: row.cpfisOA ?? 0,
        cpfisSA: row.cpfisSA ?? 0,
      }))

      return {
        id: adult.id,
        displayName: adult.displayName,
        currentAge: adult.currentAge,
        retirementAge: adult.retirementAge,
        lifeExpectancy: adult.lifeExpectancy,
        // Use plan's annualIncome (today's dollars) for snapshot display.
        // Do NOT use row0.totalGross -- it can be 0 for already-retired adults.
        annualIncome: adult.annualIncome,
        annualExpenses: adult.annualExpenses, // personal-only; shared costs not included
        liquidNetWorth: adult.liquidNetWorth,
        cpfOA,
        cpfSA,
        cpfMA,
        cpfRA,
        cpfTotal,
        cpfLifeMonthlyPayout: adult.cpf.lifeActualMonthlyPayout,
        totalNetWorth: adult.liquidNetWorth + cpfTotal,
        incomeSharePct: 0, // filled below
        netWorthSharePct: 0, // filled below
        incomeRows,
        cpfRows,
      }
    })

    const householdTotalIncome = adults.reduce((sum, a) => sum + a.annualIncome, 0)
    const householdTotalNetWorth = adults.reduce((sum, a) => sum + a.totalNetWorth, 0)

    for (const adult of adults) {
      adult.incomeSharePct = householdTotalIncome > 0
        ? adult.annualIncome / householdTotalIncome
        : 1 / adults.length
      adult.netWorthSharePct = householdTotalNetWorth > 0
        ? adult.totalNetWorth / householdTotalNetWorth
        : 1 / adults.length
    }

    return { adults, householdTotalIncome, householdTotalNetWorth }
  }, [isEnabled, plan, normalized])
}
