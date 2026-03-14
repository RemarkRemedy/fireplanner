import type { ResidencyStatus } from '@/lib/types'
import {
  getCpfRatesForAge,
  OW_CEILING_ANNUAL,
  CPF_ESTIMATE_RETENTION_FACTOR,
  CPF_WORK_START_AGE,
  CPF_HEURISTIC_SPLIT,
} from '@/lib/data/cpfRates'

export interface CpfBalanceEstimate {
  total: number
  oa: number
  sa: number
  ma: number
  ra: number
}

/** Split a total CPF balance into OA/SA/MA/RA using heuristic age-based ratios. */
function splitByAge(total: number, age: number): CpfBalanceEstimate {
  const bracket =
    CPF_HEURISTIC_SPLIT.find((b) => age <= b.maxAge) ??
    CPF_HEURISTIC_SPLIT[CPF_HEURISTIC_SPLIT.length - 1]
  const oa = Math.round(total * bracket.oa)
  const sa = Math.round(total * bracket.sa)
  const ma = Math.round(total * bracket.ma)
  const ra = Math.round(total * bracket.ra)
  return { oa, sa, ma, ra, total: oa + sa + ma + ra }
}

/**
 * Estimate CPF balances for a person based on age, income, and residency.
 *
 * Sums annual contributions from CPF_WORK_START_AGE to currentAge,
 * applies a retention factor to account for housing/education withdrawals,
 * splits into OA/SA/MA/RA using the heuristic age-based split,
 * and optionally subtracts OA used for mortgage.
 *
 * This is a rough estimate for the setup wizard — not a precise projection.
 */
export function estimateCpfBalances(
  currentAge: number,
  grossAnnualIncome: number,
  residencyStatus: ResidencyStatus,
  prMonths?: number,
  oaMortgageUsed?: number,
): CpfBalanceEstimate {
  const startAge = CPF_WORK_START_AGE
  const yearsWorked = Math.max(0, currentAge - startAge)

  if (yearsWorked <= 0 || grossAnnualIncome <= 0) {
    return { total: 0, oa: 0, sa: 0, ma: 0, ra: 0 }
  }

  const cappedIncome = Math.min(grossAnnualIncome, OW_CEILING_ANNUAL)

  let totalContributions = 0
  for (let year = 0; year < yearsWorked; year++) {
    const ageAtYear = startAge + year
    const rates = getCpfRatesForAge(ageAtYear, residencyStatus, prMonths)
    totalContributions += cappedIncome * rates.totalRate
  }

  const retainedTotal = totalContributions * CPF_ESTIMATE_RETENTION_FACTOR

  const split = splitByAge(retainedTotal, currentAge)

  // Subtract OA mortgage usage, clamping to 0
  const mortgageDeduction = oaMortgageUsed ?? 0
  const adjustedOa = Math.max(0, split.oa - mortgageDeduction)

  return {
    oa: adjustedOa,
    sa: split.sa,
    ma: split.ma,
    ra: split.ra,
    total: adjustedOa + split.sa + split.ma + split.ra,
  }
}
