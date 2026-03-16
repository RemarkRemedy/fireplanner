// Singapore Progressive Income Tax Brackets — YA 2024+
// Source: IRAS (https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-residency-and-tax-rates/individual-income-tax-rates)
// Downloaded: 2024-12-01
// License: Public data
// Note: Brackets above $320K updated for YA 2024. Verify against IRAS annually.

import type { TaxBracket } from '@/lib/types'

export const TAX_BRACKETS: TaxBracket[] = [
  { from: 0, to: 20000, rate: 0, cumulativeTax: 0 },
  { from: 20000, to: 30000, rate: 0.02, cumulativeTax: 0 },
  { from: 30000, to: 40000, rate: 0.035, cumulativeTax: 200 },
  { from: 40000, to: 80000, rate: 0.07, cumulativeTax: 550 },
  { from: 80000, to: 120000, rate: 0.115, cumulativeTax: 3350 },
  { from: 120000, to: 160000, rate: 0.15, cumulativeTax: 7950 },
  { from: 160000, to: 200000, rate: 0.18, cumulativeTax: 13950 },
  { from: 200000, to: 240000, rate: 0.19, cumulativeTax: 21150 },
  { from: 240000, to: 280000, rate: 0.195, cumulativeTax: 28750 },
  { from: 280000, to: 320000, rate: 0.20, cumulativeTax: 36550 },
  { from: 320000, to: 360000, rate: 0.22, cumulativeTax: 44550 },
  { from: 360000, to: 420000, rate: 0.23, cumulativeTax: 53350 },
  { from: 420000, to: 500000, rate: 0.24, cumulativeTax: 67150 },
  { from: 500000, to: 1000000, rate: 0.23, cumulativeTax: 86350 },
  { from: 1000000, to: Infinity, rate: 0.24, cumulativeTax: 201350 },
]

// SRS deduction cap (Singapore Citizens / PR)
export const SRS_ANNUAL_CAP = 15300

// SRS deduction cap (Foreigners)
export const SRS_ANNUAL_CAP_FOREIGNER = 35700

/** SRS investment strategy → expected annual return mapping.
 * Used in nudge flow seed/apply for the SRS investment strategy selector.
 * App-specific assumptions; not from any regulatory source. */
export const SRS_STRATEGY_RETURNS: Record<string, number> = {
  cash: 0.005,   // savings account rate
  etf: 0.06,     // broad market ETFs
  stocks: 0.08,  // individual stocks (higher risk)
  mixed: 0.05,   // blended portfolio
} as const

// ============================================================
// Tax Relief Breakdown — YA 2025 (IRAS / PWC)
// ============================================================

export type NsmanStatus = 'none' | 'noDuty' | 'performedDuty'
export type ParentReliefType = 'none' | 'liveWith' | 'notLiveWith'

export interface ReliefBreakdown {
  earnedIncomeRelief: number         // auto-computed from age
  nsmanStatus: NsmanStatus
  nsmanKAH: boolean                  // +$2,000 if Key Appointment Holder
  spouseRelief: boolean              // $2,000 (spouse income <$4K)
  nChildren: number                  // $4,000 per child (QCR)
  parentReliefType: ParentReliefType
  nParents: number                   // × parent amount
  otherReliefs: number               // catch-all for WMCR, course fees, etc.
}

export const RELIEF_AMOUNTS = {
  earnedIncome: { under55: 1000, age55to59: 6000, age60plus: 8000 },
  nsman: { none: 0, noDuty: 1500, performedDuty: 3000, kahBonus: 2000 },
  nsmanWife: 750,
  spouse: 2000,
  childPerChild: 4000,
  parent: { liveWith: 9000, notLiveWith: 5500 },
  reliefCap: 80000,
} as const

/**
 * Compute the earned income relief based on age.
 */
export function earnedIncomeReliefForAge(age: number): number {
  if (age >= 60) return RELIEF_AMOUNTS.earnedIncome.age60plus
  if (age >= 55) return RELIEF_AMOUNTS.earnedIncome.age55to59
  return RELIEF_AMOUNTS.earnedIncome.under55
}

/**
 * Compute total personal reliefs from a detailed breakdown, capped at $80,000.
 */
export function computeTotalReliefs(breakdown: ReliefBreakdown, age: number): number {
  let total = 0

  // Earned income relief (auto from age)
  total += earnedIncomeReliefForAge(age)

  // NSman
  total += RELIEF_AMOUNTS.nsman[breakdown.nsmanStatus]
  if (breakdown.nsmanKAH && breakdown.nsmanStatus !== 'none') {
    total += RELIEF_AMOUNTS.nsman.kahBonus
  }

  // Spouse
  if (breakdown.spouseRelief) {
    total += RELIEF_AMOUNTS.spouse
  }

  // Children (QCR)
  total += breakdown.nChildren * RELIEF_AMOUNTS.childPerChild

  // Parent
  if (breakdown.parentReliefType !== 'none') {
    total += breakdown.nParents * RELIEF_AMOUNTS.parent[breakdown.parentReliefType]
  }

  // Other (WMCR, course fees, etc.)
  total += breakdown.otherReliefs

  // Cap at $80,000
  return Math.min(total, RELIEF_AMOUNTS.reliefCap)
}

/**
 * Returns a sensible default breakdown based on age.
 */
export function getDefaultBreakdown(age: number): ReliefBreakdown {
  return {
    earnedIncomeRelief: earnedIncomeReliefForAge(age),
    nsmanStatus: 'none',
    nsmanKAH: false,
    spouseRelief: false,
    nChildren: 0,
    parentReliefType: 'none',
    nParents: 0,
    otherReliefs: 0,
  }
}
