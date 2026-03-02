import { FRS_BASE, BRS_GROWTH_RATE, RETIREMENT_SUM_BASE_YEAR } from '@/lib/data/cpfRates'

export interface CpfAutoFallbackInput {
  shortfall: number
  cpfOA: number
  cpfSA: number
  cpfRA: number
  cpfisOA: number
  cpfisSA: number
  age: number
  currentYear: number
  includeSA: boolean
}

export interface CpfAutoFallbackResult {
  oaWithdrawal: number
  saWithdrawal: number
  totalWithdrawal: number
}

function getFrsForAgeAndYear(age: number, year: number): number {
  const yearsUntil55 = Math.max(0, 55 - age)
  const yearsSinceBase = Math.max(0, year - RETIREMENT_SUM_BASE_YEAR)
  const totalGrowthYears = yearsUntil55 + yearsSinceBase
  return FRS_BASE * Math.pow(1 + BRS_GROWTH_RATE, totalGrowthYears)
}

export function computeCpfAutoFallback(input: CpfAutoFallbackInput): CpfAutoFallbackResult {
  const zero: CpfAutoFallbackResult = { oaWithdrawal: 0, saWithdrawal: 0, totalWithdrawal: 0 }

  if (input.age < 55 || input.shortfall <= 0) return zero

  const frs = getFrsForAgeAndYear(input.age, input.currentYear)
  const raGapToFRS = Math.max(0, frs - input.cpfRA)

  const uninvestedOA = Math.max(0, input.cpfOA - input.cpfisOA)
  const uninvestedSA = Math.max(0, input.cpfSA - input.cpfisSA)

  const withdrawableOA = Math.max(0, uninvestedOA - raGapToFRS)
  const oaWithdrawal = Math.min(input.shortfall, withdrawableOA)

  let saWithdrawal = 0
  if (input.includeSA) {
    const remainingShortfall = input.shortfall - oaWithdrawal
    if (remainingShortfall > 0) {
      const withdrawableSA = uninvestedSA
      saWithdrawal = Math.min(remainingShortfall, withdrawableSA)
    }
  }

  const totalWithdrawal = oaWithdrawal + saWithdrawal
  return { oaWithdrawal, saWithdrawal, totalWithdrawal }
}
