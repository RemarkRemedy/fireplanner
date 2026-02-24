import type { TaxResult } from '@/lib/types'
import { TAX_BRACKETS, SRS_ANNUAL_CAP, SRS_ANNUAL_CAP_FOREIGNER } from '@/lib/data/taxBrackets'
import { RSTU_TAX_RELIEF_CAP } from '@/lib/data/cpfRates'

/**
 * Calculate Singapore progressive income tax for a given chargeable income.
 * Walks the bracket table using cumulative tax amounts for efficiency.
 */
export function calculateProgressiveTax(chargeableIncome: number): TaxResult {
  if (chargeableIncome <= 0) {
    return { chargeableIncome: 0, taxPayable: 0, effectiveRate: 0, marginalRate: 0 }
  }

  let taxPayable = 0
  let marginalRate = 0

  for (let i = 0; i < TAX_BRACKETS.length; i++) {
    const bracket = TAX_BRACKETS[i]
    if (chargeableIncome <= bracket.from) break

    if (chargeableIncome <= bracket.to) {
      // Income falls within this bracket
      taxPayable = bracket.cumulativeTax + (chargeableIncome - bracket.from) * bracket.rate
      marginalRate = bracket.rate
      break
    }

    // If this is the last bracket (Infinity upper bound), compute here
    if (i === TAX_BRACKETS.length - 1) {
      taxPayable = bracket.cumulativeTax + (chargeableIncome - bracket.from) * bracket.rate
      marginalRate = bracket.rate
    }
  }

  const effectiveRate = chargeableIncome > 0 ? taxPayable / chargeableIncome : 0

  return {
    chargeableIncome,
    taxPayable,
    effectiveRate,
    marginalRate,
  }
}

/**
 * Calculate chargeable income after deductions.
 * Chargeable Income = Total Income - CPF Employee - SRS Contribution - RSTU Relief - Personal Reliefs
 * RSTU (Retirement Sum Top-Up) cash top-up to SA/RA grants tax relief up to $8,000/yr.
 */
export function calculateChargeableIncome(
  totalIncome: number,
  cpfEmployee: number,
  srsContribution: number,
  personalReliefs: number,
  residencyStatus: 'citizen' | 'pr' | 'foreigner' = 'citizen',
  cpfCashTopUpSA: number = 0
): number {
  const srsDeduction = calculateSrsDeduction(srsContribution, residencyStatus)
  const rstuDeduction = Math.min(cpfCashTopUpSA, RSTU_TAX_RELIEF_CAP)
  return Math.max(0, totalIncome - cpfEmployee - srsDeduction - rstuDeduction - personalReliefs)
}

/**
 * Calculate effective tax rate = tax / gross income.
 */
export function calculateEffectiveTaxRate(taxPayable: number, grossIncome: number): number {
  if (grossIncome <= 0) return 0
  return taxPayable / grossIncome
}

/**
 * SRS deduction is capped at the annual maximum.
 * $15,300 for citizens/PR, $35,700 for foreigners.
 */
export function calculateSrsDeduction(
  srsContribution: number,
  residencyStatus: 'citizen' | 'pr' | 'foreigner' = 'citizen'
): number {
  const cap = residencyStatus === 'foreigner' ? SRS_ANNUAL_CAP_FOREIGNER : SRS_ANNUAL_CAP
  return Math.min(Math.max(0, srsContribution), cap)
}

/**
 * Calculate household tax by summing individual tax liabilities.
 * Singapore does not have joint filing — each person is taxed separately.
 */
export function calculateHouseholdTax(params: {
  persons: Array<{
    totalIncome: number
    cpfEmployee: number
    srsContribution: number
    personalReliefs: number
    residencyStatus: 'citizen' | 'pr' | 'foreigner'
  }>
}): {
  totalTaxPayable: number
  individualTaxResults: TaxResult[]
} {
  const individualTaxResults: TaxResult[] = []
  let totalTaxPayable = 0

  for (const person of params.persons) {
    const chargeableIncome = calculateChargeableIncome(
      person.totalIncome,
      person.cpfEmployee,
      person.srsContribution,
      person.personalReliefs,
      person.residencyStatus
    )
    const taxResult = calculateProgressiveTax(chargeableIncome)
    individualTaxResults.push(taxResult)
    totalTaxPayable += taxResult.taxPayable
  }

  return {
    totalTaxPayable,
    individualTaxResults,
  }
}
