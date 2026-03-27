/**
 * SG-specific calculation functions for goal calculator V1.5.
 *
 * Pure functions that encapsulate Singapore regulatory rules:
 * CPF OA accumulation, housing grants, loan qualification (MSR/TDSR),
 * income tax, HDB sale proceeds, and peer benchmarks.
 *
 * All SG-specific constants are imported from lib/data/.
 */

import { getCpfRatesForAge, OW_CEILING_MONTHLY, OA_INTEREST_RATE } from '@/lib/data/cpfRates'
import { calculateProgressiveTax } from '@/lib/calculations/tax'
import { earnedIncomeReliefForAge } from '@/lib/data/taxBrackets'
import {
  EHG_FAMILY_TABLE,
  EHG_SINGLE_TABLE,
  FAMILY_GRANT,
  CPF_LIFE_ESTIMATES,
  PEER_BENCHMARKS,
  MORTGAGE_RATES,
  LTV_RATIOS,
} from '@/lib/data/goal-defaults'

// ============================================================
// Local constants (calculation assumptions, not regulatory data)
// ============================================================

/** Default tenure for HDB loans in months. */
const DEFAULT_LOAN_TENURE_MONTHS = 300 // 25 years

// LTV_RATIOS imported from '@/lib/data/goal-defaults'

/** HDB resale appreciation rate assumption. */
const HDB_APPRECIATION_RATE = 0.03

/** Selling costs as fraction of sale price (agent commission + legal fees). */
const SELLING_COST_RATE = 0.025

/** Emergency fund floor multiplier (months of expenses). */
const EMERGENCY_FUND_MONTHS = 3

// ============================================================
// Types
// ============================================================

export interface LoanQualification {
  qualified: boolean
  maxLoan: number
  monthlyPayment: number
}

export interface IncomeTaxEstimate {
  annualTax: number
  monthlySetAside: number
}

export interface IncomeCeilingCheck {
  yearsToExceed: number | null
  alreadyExceeds: boolean
}

// ============================================================
// 1. deriveCpfOaMonthly
// ============================================================

/**
 * Derive the monthly CPF Ordinary Account contribution from gross income.
 *
 * Applies OW ceiling cap: contribution is based on min(gross, OW_CEILING_MONTHLY).
 * Uses the total OA allocation rate (employer + employee) for the given age.
 */
export function deriveCpfOaMonthly(grossIncome: number, age: number): number {
  if (grossIncome <= 0) return 0
  const rates = getCpfRatesForAge(age)
  const cappedIncome = Math.min(grossIncome, OW_CEILING_MONTHLY)
  return cappedIncome * rates.oaRate
}

// ============================================================
// 2. accumulateCpfOa
// ============================================================

/**
 * Accumulate CPF OA balance over a number of months using FV annuity formula.
 *
 * Assumes constant monthly contributions at the current gross income level.
 * FV = monthlyOA * [((1 + r/12)^months - 1) / (r/12)]
 * where r = OA_INTEREST_RATE (annual).
 */
export function accumulateCpfOa(grossIncome: number, age: number, months: number): number {
  if (months <= 0 || grossIncome <= 0) return 0
  const monthlyOA = deriveCpfOaMonthly(grossIncome, age)
  const monthlyRate = OA_INTEREST_RATE / 12
  if (monthlyRate < 1e-10) {
    return monthlyOA * months
  }
  return monthlyOA * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
}

// ============================================================
// 3. estimateHousingGrant
// ============================================================

/**
 * Estimate total housing grants for a BTO, resale HDB, or EC purchase.
 *
 * BTO/HDB (tenure = 'new'): Enhanced Housing Grant (EHG) by income bracket.
 *   - 16 brackets from $0 to $9,000. Income > $9K = $0.
 *   - Family vs single columns.
 *
 * Resale HDB (tenure = 'resale'): Family Grant by flat size.
 *   - 4-room or smaller: $80K, 5-room or larger: $50K.
 *   - Singles get $0 for resale family grant.
 *   - Also adds EHG on top (resale applicants are eligible too).
 *
 * EC (propertyType = 'ec'): Family Grant only — NOT eligible for EHG.
 *   - Singles: $0 (not eligible for Family Grant).
 *   - Couples, flat ≤ 4-room: $80K, flat ≥ 5-room: $50K.
 *   - The tenure parameter is ignored for EC (EC is always new from developer).
 */
export function estimateHousingGrant(
  grossHouseholdIncome: number,
  flatType: string,
  tenure: 'new' | 'resale',
  isSingle: boolean,
  propertyType: 'hdb' | 'ec' = 'hdb',
): number {
  if (grossHouseholdIncome <= 0) return 0

  // EC: Family Grant only, no EHG
  if (propertyType === 'ec') {
    if (isSingle) return 0
    const isSmall = flatType === '3-room' || flatType === '4-room'
    return isSmall ? FAMILY_GRANT.fourRoomOrSmaller : FAMILY_GRANT.fiveRoomOrLarger
  }

  // EHG lookup (applicable to both BTO and resale HDB)
  // Singles: $250 steps up to $4,500 ceiling
  // Families: $500 steps up to $9,000 ceiling
  let ehg = 0
  const ehgTable = isSingle ? EHG_SINGLE_TABLE : EHG_FAMILY_TABLE
  const ehgCeiling = isSingle ? 4_500 : 9_000
  if (grossHouseholdIncome <= ehgCeiling) {
    const bracket = ehgTable.find((b) => grossHouseholdIncome <= b.maxIncome)
    if (bracket) {
      ehg = bracket.grant
    }
  }

  if (tenure === 'new') {
    return ehg
  }

  // Resale: Family Grant + EHG
  let familyGrant = 0
  if (!isSingle) {
    const isSmall = flatType === '3-room' || flatType === '4-room'
    familyGrant = isSmall ? FAMILY_GRANT.fourRoomOrSmaller : FAMILY_GRANT.fiveRoomOrLarger
  }

  return familyGrant + ehg
}

// ============================================================
// 4. lookupCpfLifeEstimate
// ============================================================

/**
 * Look up estimated CPF LIFE monthly payout by gross income band.
 *
 * Returns an indicative monthly payout assuming standard plan, FRS pledged,
 * payout starting at 65. This is a rough estimate for goal planning.
 */
export function lookupCpfLifeEstimate(grossIncome: number): number {
  if (grossIncome <= 0) return 0
  const band = CPF_LIFE_ESTIMATES.find(
    (b) => grossIncome >= b.minIncome && grossIncome < b.maxIncome,
  )
  return band?.estimatedPayout ?? 0
}

// ============================================================
// 5. checkLoanQualification
// ============================================================

/**
 * Check if a household qualifies for a property loan based on MSR/TDSR limits.
 *
 * HDB loans: MSR cap = 30% of gross monthly income.
 * Condo/Landed/EC (bank loans): TDSR cap = 55% of gross monthly income.
 *
 * Uses standard PMT formula for monthly mortgage payment.
 */
export function checkLoanQualification(
  grossHouseholdIncome: number,
  loanNeeded: number,
  annualRate: number,
  tenureYears: number,
  propertyType: 'hdb' | 'condo' | 'landed' | 'ec',
): LoanQualification {
  const clampedLoan = Math.max(0, loanNeeded)

  if (clampedLoan === 0) {
    return { qualified: true, maxLoan: 0, monthlyPayment: 0 }
  }

  // Determine servicing ratio cap
  const servicingRatio = propertyType === 'hdb' ? 0.30 : 0.55
  const maxMonthlyPayment = grossHouseholdIncome * servicingRatio

  // Monthly mortgage payment via PMT formula
  const monthlyRate = annualRate / 12
  const totalPayments = tenureYears * 12

  let monthlyPayment: number
  if (monthlyRate < 1e-10) {
    monthlyPayment = clampedLoan / totalPayments
  } else {
    // PMT = P * [r(1+r)^n] / [(1+r)^n - 1]
    const factor = Math.pow(1 + monthlyRate, totalPayments)
    monthlyPayment = clampedLoan * (monthlyRate * factor) / (factor - 1)
  }

  // Max loan the household can qualify for
  let maxLoan: number
  if (monthlyRate < 1e-10) {
    maxLoan = maxMonthlyPayment * totalPayments
  } else {
    const factor = Math.pow(1 + monthlyRate, totalPayments)
    maxLoan = maxMonthlyPayment * (factor - 1) / (monthlyRate * factor)
  }

  return {
    qualified: monthlyPayment <= maxMonthlyPayment,
    maxLoan,
    monthlyPayment,
  }
}

// ============================================================
// 6. projectIncomeGrowth
// ============================================================

/**
 * Project time-weighted average income over a growth period.
 *
 * Returns the average monthly income over the period, accounting for
 * annual growth. Formula: income * [(1+r)^n - 1] / (n * r) for r > 0.
 */
export function projectIncomeGrowth(
  currentMonthlyIncome: number,
  years: number,
  annualGrowthRate: number,
): number {
  if (years <= 0) return currentMonthlyIncome
  if (Math.abs(annualGrowthRate) < 1e-10) return currentMonthlyIncome
  return (
    currentMonthlyIncome *
    (Math.pow(1 + annualGrowthRate, years) - 1) /
    (years * annualGrowthRate)
  )
}

// ============================================================
// 7. estimateIncomeTax
// ============================================================

/**
 * Estimate Singapore income tax for a given gross annual income and age.
 *
 * Applies earned income relief (age-dependent) before computing progressive tax.
 * Returns annual tax and monthly set-aside amount.
 */
export function estimateIncomeTax(
  grossAnnualIncome: number,
  age: number,
): IncomeTaxEstimate {
  if (grossAnnualIncome <= 0) {
    return { annualTax: 0, monthlySetAside: 0 }
  }

  const relief = earnedIncomeReliefForAge(age)
  const chargeableIncome = Math.max(0, grossAnnualIncome - relief)
  const result = calculateProgressiveTax(chargeableIncome)

  return {
    annualTax: result.taxPayable,
    monthlySetAside: result.taxPayable / 12,
  }
}

// ============================================================
// 8. checkIncomeCeiling
// ============================================================

/**
 * Check when household income will exceed a ceiling (e.g., HDB income ceiling).
 *
 * If income already >= ceiling, returns {yearsToExceed: 0, alreadyExceeds: true}.
 * If growth rate <= 0, ceiling will never be exceeded: {yearsToExceed: null, alreadyExceeds: false}.
 * Otherwise: years = ln(ceiling / income) / ln(1 + rate).
 */
export function checkIncomeCeiling(
  grossHouseholdIncome: number,
  annualGrowthRate: number,
  ceiling: number,
): IncomeCeilingCheck {
  if (grossHouseholdIncome >= ceiling) {
    return { yearsToExceed: 0, alreadyExceeds: true }
  }

  if (annualGrowthRate <= 0) {
    return { yearsToExceed: null, alreadyExceeds: false }
  }

  const years = Math.log(ceiling / grossHouseholdIncome) / Math.log(1 + annualGrowthRate)
  return { yearsToExceed: years, alreadyExceeds: false }
}

// ============================================================
// 9. estimateHdbSaleProceeds
// ============================================================

/**
 * Estimate net sale proceeds from selling an HDB flat after holding for some years.
 *
 * Appreciated value = purchasePrice * (1.03)^yearsHeld
 * Outstanding loan via amortization balance formula.
 * Selling costs = 2.5% of appreciated value (agent + legal).
 * Proceeds = max(0, appreciated - outstanding - sellingCosts).
 */
export function estimateHdbSaleProceeds(
  purchasePrice: number,
  yearsHeld: number,
  loanType: 'hdb-loan' | 'bank-loan',
): number {
  if (purchasePrice <= 0 || yearsHeld < 0) return 0

  const appreciated = purchasePrice * Math.pow(1 + HDB_APPRECIATION_RATE, yearsHeld)

  const rate = loanType === 'hdb-loan' ? MORTGAGE_RATES.hdb : MORTGAGE_RATES.bank
  const ltv = LTV_RATIOS[loanType]
  const principal = purchasePrice * ltv
  const monthlyRate = rate / 12
  const n = DEFAULT_LOAN_TENURE_MONTHS
  const t = yearsHeld * 12

  let outstanding: number
  if (t >= n) {
    outstanding = 0
  } else if (monthlyRate < 1e-10) {
    outstanding = principal * (1 - t / n)
  } else {
    // balance = P * [(1+r)^n - (1+r)^t] / [(1+r)^n - 1]
    const compoundN = Math.pow(1 + monthlyRate, n)
    const compoundT = Math.pow(1 + monthlyRate, t)
    outstanding = principal * (compoundN - compoundT) / (compoundN - 1)
  }

  const sellingCosts = appreciated * SELLING_COST_RATE

  return Math.max(0, appreciated - outstanding - sellingCosts)
}

// ============================================================
// 10. getEmergencyFundFloor
// ============================================================

/**
 * Minimum emergency fund: 3 months of expenses.
 */
export function getEmergencyFundFloor(monthlyExpenses: number): number {
  return Math.max(0, monthlyExpenses) * EMERGENCY_FUND_MONTHS
}

// ============================================================
// 11. getPeerBenchmark
// ============================================================

/**
 * Return a human-readable peer comparison string based on savings rate and age.
 *
 * Uses percentile thresholds from PEER_BENCHMARKS to describe how the user
 * compares to Singaporeans in the same age group.
 */
export function getPeerBenchmark(savingsRate: number, age: number): string {
  const bracket = PEER_BENCHMARKS.find((b) => age >= b.minAge && age <= b.maxAge)
    ?? PEER_BENCHMARKS[PEER_BENCHMARKS.length - 1]

  // Find the highest percentile the user meets or exceeds
  const matched = [...bracket.percentiles]
    .reverse()
    .find((p) => savingsRate >= p.rate)

  if (!matched) {
    return 'below average for Singaporeans your age'
  }
  if (matched.percentile >= 75) {
    return 'higher than about 3 in 4 Singaporeans your age'
  }
  if (matched.percentile >= 50) {
    return 'above the median for Singaporeans your age'
  }
  return 'in the middle range for Singaporeans your age'
}

// ============================================================
// 12. isEcGoal
// ============================================================

/**
 * Returns true if the goal kind string represents an Executive Condo (EC) goal.
 *
 * Kept as a pure function (no UI type imports) so it can be used in calculation
 * and data hooks without coupling to UI-layer types.
 */
export function isEcGoal(kind: string): boolean {
  return kind === 'ec'
}

// ============================================================
// 13. getParkingRecommendation
// ============================================================

/**
 * Suggest where to park savings based on the time horizon to goal.
 *
 * < 2 years: high-yield savings
 * 2-5 years: SSB / T-bills
 * 5-10 years: low-cost index fund
 * > 10 years: diversified portfolio
 */
export function getParkingRecommendation(yearsToGoal: number): string {
  if (yearsToGoal < 2) return 'High-yield savings account'
  if (yearsToGoal <= 5) return 'Singapore Savings Bonds or T-bills'
  if (yearsToGoal <= 10) return 'Low-cost index fund'
  return 'Diversified portfolio'
}
