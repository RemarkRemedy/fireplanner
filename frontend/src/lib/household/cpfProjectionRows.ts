import { calculateBrsFrsErs } from '@/lib/calculations/cpf'
import {
  BRS_BASE,
  BRS_GROWTH_RATE,
  ERS_BASE,
  FRS_BASE,
  RETIREMENT_SUM_BASE_YEAR,
} from '@/lib/data/cpfRates'
import type {
  CpfLifePlan,
  IncomeProjectionRow,
} from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

export interface CpfProjectionDisplayRow {
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

export interface BuildCpfProjectionRowsInput {
  currentAge: number
  cpfLifePlan: CpfLifePlan
  cpfLifeStartAge: number
  projection: IncomeProjectionRow[]
}

export function buildCpfProjectionRows({
  currentAge,
  cpfLifePlan,
  cpfLifeStartAge,
  projection,
}: BuildCpfProjectionRowsInput): CpfProjectionDisplayRow[] {
  const brsFrsErs = calculateBrsFrsErs(currentAge)
  const growthFactor = (1 + BRS_GROWTH_RATE).toFixed(3)
  let brsReached = false
  let frsReached = false
  let ersReached = false
  let cpfLifeStarted = false
  let annuityPremium = 0
  let payoutsFromAnnuity = 0
  let raFullyDepleted = false

  return projection.map((row, index) => {
    const prevRow = index > 0 ? projection[index - 1] : null
    const prevTotal = prevRow
      ? prevRow.cpfOA + prevRow.cpfSA + prevRow.cpfMA + prevRow.cpfRA
      : 0
    const totalBalance = row.cpfOA + row.cpfSA + row.cpfMA + row.cpfRA
    const retirementBalance = row.cpfOA + row.cpfSA + row.cpfRA
    const annualContribution = row.cpfEmployee + row.cpfEmployer
    const annualInterest = index > 0
      ? totalBalance - prevTotal - annualContribution + row.cpfOaHousingDeduction
      : 0

    let milestone: CpfProjectionDisplayRow['milestone'] = null

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

    if (row.cpfLifeAnnuityPremium > 0) {
      annuityPremium = row.cpfLifeAnnuityPremium
    }

    let bequest = 0
    if (row.age >= cpfLifeStartAge && annuityPremium > 0) {
      if (cpfLifePlan === 'basic') {
        if (row.cpfRA > 0) {
          bequest = row.cpfRA + annuityPremium
        } else {
          if (!raFullyDepleted) {
            raFullyDepleted = true
            payoutsFromAnnuity = 0
          }
          payoutsFromAnnuity += row.cpfLifePayout
          bequest = Math.max(0, annuityPremium - payoutsFromAnnuity)
        }
      } else {
        payoutsFromAnnuity += row.cpfLifePayout
        bequest = Math.max(0, annuityPremium - payoutsFromAnnuity)
      }
    }

    let milestoneFormula: string | null = null
    if (milestone === 'frs') {
      const years = Math.max(0, 55 - currentAge) + Math.max(0, new Date().getFullYear() - RETIREMENT_SUM_BASE_YEAR)
      milestoneFormula = `FRS at 55: ${formatCurrency(FRS_BASE)} (${RETIREMENT_SUM_BASE_YEAR}) × ${growthFactor}^${years} = ${formatCurrency(brsFrsErs.frs)}`
    } else if (milestone === 'brs') {
      const years = Math.max(0, 55 - currentAge) + Math.max(0, new Date().getFullYear() - RETIREMENT_SUM_BASE_YEAR)
      milestoneFormula = `BRS at 55: ${formatCurrency(BRS_BASE)} (${RETIREMENT_SUM_BASE_YEAR}) × ${growthFactor}^${years} = ${formatCurrency(brsFrsErs.brs)}`
    } else if (milestone === 'ers') {
      const years = Math.max(0, 55 - currentAge) + Math.max(0, new Date().getFullYear() - RETIREMENT_SUM_BASE_YEAR)
      milestoneFormula = `ERS at 55: ${formatCurrency(ERS_BASE)} (${RETIREMENT_SUM_BASE_YEAR}) × ${growthFactor}^${years} = ${formatCurrency(brsFrsErs.ers)}`
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
}
