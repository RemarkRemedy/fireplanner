import { useMemo } from 'react'
import { useIncomeProjection } from '@/hooks/useIncomeProjection'
import { useNormalizedLegacyAnalysisContext } from '@/hooks/useIncomeProjection'
import { useHouseholdRuntimeInputs } from '@/hooks/useHouseholdRuntimeInputs'
import { calculateBrsFrsErs } from '@/lib/calculations/cpf'
import { RETIREMENT_SUM_BASE_YEAR, BRS_BASE, FRS_BASE, ERS_BASE } from '@/lib/data/cpfRates'
import { formatCurrency } from '@/lib/utils'

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

    if (hasErrors || !projection || projection.length === 0) {
      return { rows: null, hasErrors: true }
    }

    const brsFrsErs = calculateBrsFrsErs(currentAge)
    let brsReached = false
    let frsReached = false
    let ersReached = false
    let cpfLifeStarted = false

    // Bequest tracking: cumulative payouts drawn from the annuity pool
    let annuityPremium = 0
    let payoutsFromAnnuity = 0
    let raFullyDepleted = false

    const rows: CpfProjectionRow[] = projection.map((row, i) => {
      const prevRow = i > 0 ? projection[i - 1] : null
      const prevTotal = prevRow
        ? prevRow.cpfOA + prevRow.cpfSA + prevRow.cpfMA + prevRow.cpfRA
        : 0
      const totalBalance = row.cpfOA + row.cpfSA + row.cpfMA + row.cpfRA
      // Retirement balance excludes MA — MediSave cannot fund BRS/FRS/ERS
      const retirementBalance = row.cpfOA + row.cpfSA + row.cpfRA
      const annualContribution = row.cpfEmployee + row.cpfEmployer
      // Interest approximation: balance change minus contributions, plus housing deductions
      const annualInterest = i > 0
        ? totalBalance - prevTotal - annualContribution + row.cpfOaHousingDeduction
        : 0

      let milestone: CpfProjectionRow['milestone'] = null

      if (!brsReached && retirementBalance >= brsFrsErs.brs) {
        milestone = 'brs'
        brsReached = true
      }
      if (!frsReached && retirementBalance >= brsFrsErs.frs) {
        milestone = 'frs'
        frsReached = true
      }
      if (!ersReached && retirementBalance >= brsFrsErs.ers) {
        milestone = 'ers'
        ersReached = true
      }
      if (!cpfLifeStarted && row.age === cpfLifeStartAge) {
        milestone = 'cpfLifeStart'
        cpfLifeStarted = true
      }
      if (row.age === 55 && row.cpfRA > 0 && milestone === null) {
        milestone = 'raCreated'
      }

      // Track annuity premium from the LIFE start row
      if (row.cpfLifeAnnuityPremium > 0) {
        annuityPremium = row.cpfLifeAnnuityPremium
      }

      // Compute bequest: what beneficiaries inherit if passing occurs at this age
      let bequest = 0
      if (row.age >= cpfLifeStartAge && annuityPremium > 0) {
        if (cpfLifePlan === 'basic') {
          if (row.cpfRA > 0) {
            // RA still has funds → payouts come from RA, annuity premium untouched
            bequest = row.cpfRA + annuityPremium
          } else {
            // RA depleted → payouts now come from annuity pool
            if (!raFullyDepleted) {
              raFullyDepleted = true
              payoutsFromAnnuity = 0
            }
            payoutsFromAnnuity += row.cpfLifePayout
            bequest = Math.max(0, annuityPremium - payoutsFromAnnuity)
          }
        } else {
          // Standard/Escalating: cpfRA = 0, ALL payouts from annuity pool
          payoutsFromAnnuity += row.cpfLifePayout
          bequest = Math.max(0, annuityPremium - payoutsFromAnnuity)
        }
      }

      // Build formula text for milestone rows
      let milestoneFormula: string | null = null
      if (milestone === 'frs') {
        const years = Math.max(0, 55 - currentAge) + Math.max(0, new Date().getFullYear() - RETIREMENT_SUM_BASE_YEAR)
        milestoneFormula = `FRS at 55: ${formatCurrency(FRS_BASE)} (${RETIREMENT_SUM_BASE_YEAR}) × 1.035^${years} = ${formatCurrency(brsFrsErs.frs)}`
      } else if (milestone === 'brs') {
        const years = Math.max(0, 55 - currentAge) + Math.max(0, new Date().getFullYear() - RETIREMENT_SUM_BASE_YEAR)
        milestoneFormula = `BRS at 55: ${formatCurrency(BRS_BASE)} (${RETIREMENT_SUM_BASE_YEAR}) × 1.035^${years} = ${formatCurrency(brsFrsErs.brs)}`
      } else if (milestone === 'ers') {
        const years = Math.max(0, 55 - currentAge) + Math.max(0, new Date().getFullYear() - RETIREMENT_SUM_BASE_YEAR)
        milestoneFormula = `ERS at 55: ${formatCurrency(ERS_BASE)} (${RETIREMENT_SUM_BASE_YEAR}) × 1.035^${years} = ${formatCurrency(brsFrsErs.ers)}`
      } else if (milestone === 'raCreated') {
        const prevSA = prevRow ? prevRow.cpfSA : 0
        milestoneFormula = `SA (${formatCurrency(prevSA)}) → RA. Target: FRS = ${formatCurrency(brsFrsErs.frs)}`
      } else if (milestone === 'cpfLifeStart') {
        milestoneFormula = `RA at ${row.age}: ${formatCurrency(totalBalance)}. ${cpfLifePlan.charAt(0).toUpperCase() + cpfLifePlan.slice(1)} plan. Payout: ${formatCurrency(row.cpfLifePayout / 12)}/mo (${formatCurrency(row.cpfLifePayout)}/yr)`
      }

      return {
        age: row.age,
        oaBalance: row.cpfOA,
        saBalance: row.cpfSA,
        maBalance: row.cpfMA,
        raBalance: row.cpfRA,
        totalBalance,
        annualContribution,
        annualInterest: Math.max(0, annualInterest),
        cpfLifePayout: row.cpfLifePayout,
        oaHousingDeduction: row.cpfOaHousingDeduction,
        oaShortfall: row.cpfOaShortfall,
        cpfisOA: row.cpfisOA,
        cpfisSA: row.cpfisSA,
        cpfisReturn: row.cpfisReturn,
        bequest,
        milestone,
        milestoneFormula,
      }
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
