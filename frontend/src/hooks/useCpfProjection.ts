import { useMemo } from 'react'
import { useIncomeProjection } from '@/hooks/useIncomeProjection'
import { useProfileStore } from '@/stores/useProfileStore'
import { useHouseholdStore } from '@/stores/useHouseholdStore'
import { calculateBrsFrsErs } from '@/lib/calculations/cpf'
import { RETIREMENT_SUM_BASE_YEAR, BRS_BASE, FRS_BASE, ERS_BASE } from '@/lib/data/cpfRates'
import { formatCurrency } from '@/lib/utils'
import type { IncomeProjectionRow, HouseholdIncomeProjectionRow } from '@/lib/types'

// Helper to extract CPF values from either single or household projection rows
function getCpfValue(row: IncomeProjectionRow | HouseholdIncomeProjectionRow, field: 'cpfOA' | 'cpfSA' | 'cpfMA' | 'cpfRA' | 'cpfEmployee' | 'cpfEmployer' | 'cpfLifePayout' | 'cpfOaHousingDeduction' | 'cpfOaShortfall' | 'cpfLifeAnnuityPremium' | 'cpfisOA' | 'cpfisSA' | 'cpfisReturn'): number {
  if ('cpfOA' in row) {
    // Single-person projection
    return row[field] ?? 0
  } else {
    // Household projection - map to total fields
    const householdField = field === 'cpfOA' ? 'totalCpfOA' :
                           field === 'cpfSA' ? 'totalCpfSA' :
                           field === 'cpfMA' ? 'totalCpfMA' :
                           field === 'cpfRA' ? 'totalCpfRA' :
                           field === 'cpfEmployee' ? 'totalCpfEmployee' :
                           field === 'cpfEmployer' ? 'totalCpfEmployer' :
                           field === 'cpfLifePayout' ? 'totalCpfLifePayout' :
                           field === 'cpfOaHousingDeduction' ? 'totalCpfOaHousingDeduction' :
                           field === 'cpfisOA' ? 'totalCpfisOA' :
                           field === 'cpfisSA' ? 'totalCpfisSA' :
                           field === 'cpfisReturn' ? 'totalCpfisReturn' : null
    if (householdField && householdField in row) {
      return (row as HouseholdIncomeProjectionRow)[householdField as keyof HouseholdIncomeProjectionRow] as number ?? 0
    }
    return 0
  }
}

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
 *
 * @param personId - Optional person ID for household mode. If provided, uses that person's projection.
 */
export function useCpfProjection(personId?: string): {
  rows: CpfProjectionRow[] | null
  hasErrors: boolean
} {
  const { projection, hasErrors, personProjections, isHousehold } = useIncomeProjection()
  const household = useHouseholdStore()
  const profileStore = useProfileStore()

  // In household mode, find the person's projection
  const effectiveProjection = useMemo(() => {
    if (isHousehold && personId && personProjections) {
      const personProj = personProjections.find(p => p.personId === personId)
      return personProj?.projection || null
    }
    // In single-person mode, use the main projection
    if (!isHousehold) {
      return projection as IncomeProjectionRow[] | null
    }
    // In household mode without personId, return null (shouldn't happen)
    return null
  }, [isHousehold, personId, personProjections, projection])

  // Get CPF settings for the selected person (or from profile store in single mode)
  const selectedPerson = household.householdMode && personId
    ? household.persons.find(p => p.profile.id === personId)
    : null
  const cpfLifeStartAge = selectedPerson?.cpf.cpfLifeStartAge || profileStore.cpfLifeStartAge
  const cpfLifePlan = selectedPerson?.cpf.cpfLifePlan || profileStore.cpfLifePlan
  const currentAge = selectedPerson?.profile.currentAge || profileStore.currentAge

  return useMemo(() => {
    if (hasErrors || !effectiveProjection || effectiveProjection.length === 0) {
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

    const rows: CpfProjectionRow[] = effectiveProjection.map((row, i) => {
      const prevRow = i > 0 ? effectiveProjection[i - 1] : null
      const prevTotal = prevRow
        ? getCpfValue(prevRow, 'cpfOA') + getCpfValue(prevRow, 'cpfSA') + getCpfValue(prevRow, 'cpfMA') + getCpfValue(prevRow, 'cpfRA')
        : 0
      const totalBalance = getCpfValue(row, 'cpfOA') + getCpfValue(row, 'cpfSA') + getCpfValue(row, 'cpfMA') + getCpfValue(row, 'cpfRA')
      // Retirement balance excludes MA — MediSave cannot fund BRS/FRS/ERS
      const retirementBalance = getCpfValue(row, 'cpfOA') + getCpfValue(row, 'cpfSA') + getCpfValue(row, 'cpfRA')
      const annualContribution = getCpfValue(row, 'cpfEmployee') + getCpfValue(row, 'cpfEmployer')
      // Interest approximation: balance change minus contributions, plus housing deductions
      const annualInterest = i > 0
        ? totalBalance - prevTotal - annualContribution + getCpfValue(row, 'cpfOaHousingDeduction')
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
      const cpfRA = getCpfValue(row, 'cpfRA')
      const cpfLifePayout = getCpfValue(row, 'cpfLifePayout')
      const cpfLifeAnnuityPremium = getCpfValue(row, 'cpfLifeAnnuityPremium')

      if (row.age === 55 && cpfRA > 0 && milestone === null) {
        milestone = 'raCreated'
      }

      // Track annuity premium from the LIFE start row
      if (cpfLifeAnnuityPremium > 0) {
        annuityPremium = cpfLifeAnnuityPremium
      }

      // Compute bequest: what beneficiaries inherit if passing occurs at this age
      let bequest = 0
      if (row.age >= cpfLifeStartAge && annuityPremium > 0) {
        if (cpfLifePlan === 'basic') {
          if (cpfRA > 0) {
            // RA still has funds → payouts come from RA, annuity premium untouched
            bequest = cpfRA + annuityPremium
          } else {
            // RA depleted → payouts now come from annuity pool
            if (!raFullyDepleted) {
              raFullyDepleted = true
              payoutsFromAnnuity = 0
            }
            payoutsFromAnnuity += cpfLifePayout
            bequest = Math.max(0, annuityPremium - payoutsFromAnnuity)
          }
        } else {
          // Standard/Escalating: cpfRA = 0, ALL payouts from annuity pool
          payoutsFromAnnuity += cpfLifePayout
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
        const prevSA = prevRow ? getCpfValue(prevRow, 'cpfSA') : 0
        milestoneFormula = `SA (${formatCurrency(prevSA)}) → RA. Target: FRS = ${formatCurrency(brsFrsErs.frs)}`
      } else if (milestone === 'cpfLifeStart') {
        milestoneFormula = `RA at ${row.age}: ${formatCurrency(totalBalance)}. ${cpfLifePlan.charAt(0).toUpperCase() + cpfLifePlan.slice(1)} plan. Payout: ${formatCurrency(cpfLifePayout / 12)}/mo (${formatCurrency(cpfLifePayout)}/yr)`
      }

      return {
        age: row.age,
        oaBalance: getCpfValue(row, 'cpfOA'),
        saBalance: getCpfValue(row, 'cpfSA'),
        maBalance: getCpfValue(row, 'cpfMA'),
        raBalance: cpfRA,
        totalBalance,
        annualContribution,
        annualInterest: Math.max(0, annualInterest),
        cpfLifePayout,
        oaHousingDeduction: getCpfValue(row, 'cpfOaHousingDeduction'),
        oaShortfall: getCpfValue(row, 'cpfOaShortfall'),
        cpfisOA: getCpfValue(row, 'cpfisOA'),
        cpfisSA: getCpfValue(row, 'cpfisSA'),
        cpfisReturn: getCpfValue(row, 'cpfisReturn'),
        bequest,
        milestone,
        milestoneFormula,
      }
    })

    return { rows, hasErrors: false }
  }, [effectiveProjection, hasErrors, currentAge, cpfLifeStartAge, cpfLifePlan])
}
