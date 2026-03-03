// CPF Contribution & Retirement Sum Rates — 2026
// Source: CPF Board (https://www.cpf.gov.sg/employer/employer-obligations/how-much-cpf-contributions-to-pay)
// Allocation: https://www.cpf.gov.sg/content/dam/web/employer/employer-obligations/documents/CPFAllocationRatesfromJanuary2026.pdf
// Downloaded: 2026-02-25
// License: Public data
// Note: Under-55 has 4 sub-brackets with different OA/SA/MA allocations
//       but the same employee/employer/total rates.
//       Post-55 saRate represents RA (Retirement Account) contributions.

import type { CpfRateEntry, ResidencyStatus } from '@/lib/types'

export const CPF_RATES: CpfRateEntry[] = [
  {
    ageGroup: '35 and below',
    minAge: 0,
    maxAge: 35,
    employeeRate: 0.20,
    employerRate: 0.17,
    totalRate: 0.37,
    oaRate: 0.23,
    saRate: 0.06,
    maRate: 0.08,
  },
  {
    ageGroup: '35-45',
    minAge: 35,
    maxAge: 45,
    employeeRate: 0.20,
    employerRate: 0.17,
    totalRate: 0.37,
    oaRate: 0.21,
    saRate: 0.07,
    maRate: 0.09,
  },
  {
    ageGroup: '45-50',
    minAge: 45,
    maxAge: 50,
    employeeRate: 0.20,
    employerRate: 0.17,
    totalRate: 0.37,
    oaRate: 0.19,
    saRate: 0.08,
    maRate: 0.10,
  },
  {
    ageGroup: '50-55',
    minAge: 50,
    maxAge: 55,
    employeeRate: 0.20,
    employerRate: 0.17,
    totalRate: 0.37,
    oaRate: 0.15,
    saRate: 0.115,
    maRate: 0.105,
  },
  {
    ageGroup: '55-60',
    minAge: 55,
    maxAge: 60,
    employeeRate: 0.18,
    employerRate: 0.16,
    totalRate: 0.34,
    oaRate: 0.12,
    saRate: 0.115, // RA
    maRate: 0.105,
  },
  {
    ageGroup: '60-65',
    minAge: 60,
    maxAge: 65,
    employeeRate: 0.125,
    employerRate: 0.125,
    totalRate: 0.25,
    oaRate: 0.035,
    saRate: 0.11, // RA
    maRate: 0.105,
  },
  {
    ageGroup: '65-70',
    minAge: 65,
    maxAge: 70,
    employeeRate: 0.075,
    employerRate: 0.09,
    totalRate: 0.165,
    oaRate: 0.01,
    saRate: 0.05, // RA
    maRate: 0.105,
  },
  {
    ageGroup: 'Above 70',
    minAge: 70,
    maxAge: Infinity,
    employeeRate: 0.05,
    employerRate: 0.075,
    totalRate: 0.125,
    oaRate: 0.01,
    saRate: 0.01, // RA
    maRate: 0.105,
  },
]

// Ordinary Wage (OW) ceiling: $8,000/month (from 1 Jan 2026)
// Source: https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-reliefs-rebates-and-deductions/tax-reliefs/central-provident-fund(cpf)-relief-for-employees
export const OW_CEILING_MONTHLY = 8000
export const OW_CEILING_ANNUAL = OW_CEILING_MONTHLY * 12 // $96,000

// Additional Wages (AW) ceiling
// Source: https://www.cpf.gov.sg/employer/employer-obligations/how-much-cpf-contributions-to-pay
// AW ceiling = $102,000 - Total OW subject to CPF for the year (from 1 Jan 2026)
export const AW_CEILING_TOTAL = 102000

// Interest rates
export const OA_INTEREST_RATE = 0.025 // 2.5%
export const SA_INTEREST_RATE = 0.04 // 4.0%
export const MA_INTEREST_RATE = 0.04 // 4.0%

// Extra interest on first $60K combined (up to $20K from OA)
export const EXTRA_INTEREST_RATE = 0.01 // 1% extra
export const EXTRA_INTEREST_COMBINED_CAP = 60000
export const EXTRA_INTEREST_OA_CAP = 20000

// Retirement Account (RA) — created at age 55
export const RA_INTEREST_RATE = 0.04 // 4.0%, same as SA
export const EXTRA_INTEREST_OA_CAP_55_PLUS = 30000 // raised from $20K post-55
export const EXTRA_INTEREST_RA_ADDITIONAL = 0.01 // extra 1% on first $30K of RA (total 2% extra)

// BRS/FRS/ERS — base year values for cohort turning 55 in RETIREMENT_SUM_BASE_YEAR
// Source: https://www.cpf.gov.sg/service/article/what-are-the-retirement-sums-basic-retirement-sum-brs-full-retirement-sum-frs-and-enhanced-retirement-sum-ers
// Downloaded: 2026-02-24
// Note: ERS changed from 3x to 4x BRS starting 2025
export const RETIREMENT_SUM_BASE_YEAR = 2026
export const BRS_BASE = 110200
export const FRS_BASE = 220400
export const ERS_BASE = 440800
export const BRS_GROWTH_RATE = 0.035 // 3.5% p.a.

// CPF Annual Limit — total mandatory + voluntary contributions cap per calendar year
// Source: https://www.cpf.gov.sg/member/growing-your-savings/saving-more-with-cpf/top-up-ordinary-special-and-medisave-savings
// As of: 2026
export const CPF_ANNUAL_LIMIT = 37740

// Retirement Sum Top-Up (RSTU) — voluntary SA/RA cash top-up
// Tax relief: up to $8,000 for self, $8,000 for family members
// Source: https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-reliefs-rebates-and-deductions/tax-reliefs/central-provident-fund-(cpf)-cash-top-up-relief
// As of: 2026
export const RSTU_TAX_RELIEF_CAP = 8000
export const RSTU_FAMILY_TAX_RELIEF_CAP = 8000

// CPFIS (CPF Investment Scheme) retention limits
// Members must retain these minimum balances before investing the remainder
// Source: https://www.cpf.gov.sg/member/growing-your-savings/earning-higher-returns/investing-your-cpf-savings
export const CPFIS_OA_RETENTION = 20000
export const CPFIS_SA_RETENTION = 40000

// CPF LIFE payout rates (annual rate applied to retirement sum at 55)
export const CPF_LIFE_BASIC_RATE = 0.054 // ~5.4%
export const CPF_LIFE_STANDARD_RATE = 0.063 // ~6.3%
export const CPF_LIFE_ESCALATING_RATE = 0.048 // ~4.8% initial, increases 2%/yr
export const CPF_LIFE_ESCALATING_INCREASE = 0.02 // 2% annual increase for escalating plan
export const CPF_LIFE_START_AGE = 65 // Default; user can configure 65-75 via cpfLifeStartAge

// Basic Plan: only ~15% of RA goes to annuity premium (CPF says 10-20%)
// The remaining ~85% stays in RA for direct drawdown until ~age 90
export const CPF_LIFE_BASIC_PREMIUM_RATE = 0.15

// SPR Graduated Rates — Year 1 (0-12 months as SPR)
// Source: CPF Board 2026 contribution rate tables
// OA/SA/MA allocation derived from citizen ratios scaled to PR total
const CPF_PR_YEAR1_RATES: { maxAge: number; employeeRate: number; employerRate: number; totalRate: number }[] = [
  { maxAge: 60, employeeRate: 0.05, employerRate: 0.04, totalRate: 0.09 },
  { maxAge: Infinity, employeeRate: 0.05, employerRate: 0.035, totalRate: 0.085 },
]

// SPR Graduated Rates — Year 2 (13-24 months as SPR)
const CPF_PR_YEAR2_RATES: { maxAge: number; employeeRate: number; employerRate: number; totalRate: number }[] = [
  { maxAge: 55, employeeRate: 0.15, employerRate: 0.09, totalRate: 0.24 },
  { maxAge: 60, employeeRate: 0.125, employerRate: 0.06, totalRate: 0.185 },
  { maxAge: 65, employeeRate: 0.075, employerRate: 0.035, totalRate: 0.11 },
  { maxAge: Infinity, employeeRate: 0.05, employerRate: 0.035, totalRate: 0.085 },
]

// Foreigners: zero CPF contributions across all age brackets
const ZERO_RATE_ENTRY: CpfRateEntry = {
  ageGroup: 'Foreigner',
  minAge: 0,
  maxAge: Infinity,
  employeeRate: 0,
  employerRate: 0,
  totalRate: 0,
  oaRate: 0,
  saRate: 0,
  maRate: 0,
}

/**
 * Get CPF contribution rates for a given age and residency status.
 * Age boundaries: rates change when crossing into the next bracket.
 * e.g., age 55 uses "55 and below" rates, age 56 uses "55-60" rates.
 *
 * For PRs in Year 1 (prMonths < 12) and Year 2 (12 <= prMonths < 24),
 * graduated contribution rates apply. OA/SA/MA allocation follows the
 * same citizen ratios scaled to the lower PR total.
 * PR Year 3+ (prMonths >= 24) uses full citizen rates.
 * Foreigners get zero contributions.
 */
export function getCpfRatesForAge(
  age: number,
  residencyStatus: ResidencyStatus = 'citizen',
  prMonths: number = 24
): CpfRateEntry {
  // Foreigners: no CPF
  if (residencyStatus === 'foreigner') {
    return ZERO_RATE_ENTRY
  }

  // Get citizen entry (used for citizens and as allocation reference for PRs)
  const citizenEntry = CPF_RATES.find((r) => age <= r.maxAge) ?? CPF_RATES[CPF_RATES.length - 1]

  // Citizens and PR Year 3+: full rates
  if (residencyStatus === 'citizen' || prMonths >= 24) {
    return citizenEntry
  }

  // PR Year 1 or Year 2: graduated contribution rates with citizen allocation ratios
  const prTable = prMonths < 12 ? CPF_PR_YEAR1_RATES : CPF_PR_YEAR2_RATES
  const prEntry = prTable.find(r => age <= r.maxAge) ?? prTable[prTable.length - 1]

  // Scale citizen OA/SA/MA allocation to the lower PR total
  const scale = citizenEntry.totalRate > 0 ? prEntry.totalRate / citizenEntry.totalRate : 0

  return {
    ageGroup: citizenEntry.ageGroup,
    minAge: citizenEntry.minAge,
    maxAge: citizenEntry.maxAge,
    employeeRate: prEntry.employeeRate,
    employerRate: prEntry.employerRate,
    totalRate: prEntry.totalRate,
    oaRate: citizenEntry.oaRate * scale,
    saRate: citizenEntry.saRate * scale,
    maRate: citizenEntry.maRate * scale,
  }
}
