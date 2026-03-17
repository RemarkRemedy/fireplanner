/**
 * CPF/SRS Tax Optimisation Recommender
 *
 * Given a user's gross income, existing deductions, and personal reliefs,
 * recommends whether to max out SRS and/or RSTU (SA/RA cash top-up)
 * contributions to minimise tax payable.
 *
 * Key insight: SRS, RSTU, and CPF employee are INDEPENDENT line-item deductions.
 * They do NOT compete for a shared cap. The $80K relief cap only applies to
 * personal reliefs (earned income, spouse, parent, etc.).
 *
 * Sources: IRAS progressive tax brackets, CPF Board RSTU relief rules
 */

import type { ResidencyStatus } from '@/lib/types'
import { calculateChargeableIncome, calculateProgressiveTax } from './tax'
import { SRS_ANNUAL_CAP, SRS_ANNUAL_CAP_FOREIGNER } from '@/lib/data/taxBrackets'
import { RSTU_TAX_RELIEF_CAP } from '@/lib/data/cpfRates'

export interface TaxOptimizationInput {
  grossIncome: number
  cpfEmployeeContribution: number
  currentSrsContribution: number
  currentRstuTopUp: number
  personalReliefs: number
  residencyStatus: ResidencyStatus
  age: number
}

export interface TaxOptimizationResult {
  recommendedSrs: number
  recommendedRstu: number
  currentTax: number
  optimizedTax: number
  taxSavings: number
  marginalRate: number
  breakdown: {
    cpfEmployee: number
    srs: { current: number; recommended: number; savingsFromMax: number }
    rstu: { current: number; recommended: number; savingsFromMax: number }
    personalReliefs: number
    chargeableIncome: { current: number; optimized: number }
  }
}

/**
 * Compute tax for a given set of deductions using existing tax functions.
 */
function computeTax(
  grossIncome: number,
  cpfEmployee: number,
  srs: number,
  personalReliefs: number,
  residencyStatus: ResidencyStatus,
  rstuTopUp: number
): { tax: number; chargeable: number; marginalRate: number } {
  const chargeable = calculateChargeableIncome(
    grossIncome, cpfEmployee, srs, personalReliefs, residencyStatus, rstuTopUp
  )
  const result = calculateProgressiveTax(chargeable)
  return { tax: result.taxPayable, chargeable, marginalRate: result.marginalRate }
}

/**
 * Optimize tax deductions by recommending max SRS and RSTU contributions.
 *
 * Each deduction is independent — they don't share a cap.
 * Strategy: recommend maxing each deduction if it produces tax savings.
 */
export function optimizeTaxContributions(input: TaxOptimizationInput): TaxOptimizationResult {
  const {
    grossIncome,
    cpfEmployeeContribution,
    currentSrsContribution,
    currentRstuTopUp,
    personalReliefs,
    residencyStatus,
    age: _age,
  } = input

  const srsCap = residencyStatus === 'foreigner' ? SRS_ANNUAL_CAP_FOREIGNER : SRS_ANNUAL_CAP

  // 1. Current tax
  const current = computeTax(
    grossIncome, cpfEmployeeContribution, currentSrsContribution,
    personalReliefs, residencyStatus, currentRstuTopUp
  )

  // 2. Optimized tax (both maxed)
  const optimized = computeTax(
    grossIncome, cpfEmployeeContribution, srsCap,
    personalReliefs, residencyStatus, RSTU_TAX_RELIEF_CAP
  )

  // 3. Per-deduction savings (computed independently)
  // SRS savings: current RSTU kept, only SRS changes
  const withMaxSrsOnly = computeTax(
    grossIncome, cpfEmployeeContribution, srsCap,
    personalReliefs, residencyStatus, currentRstuTopUp
  )
  const srsSavings = current.tax - withMaxSrsOnly.tax

  // RSTU savings: current SRS kept, only RSTU changes
  const withMaxRstuOnly = computeTax(
    grossIncome, cpfEmployeeContribution, currentSrsContribution,
    personalReliefs, residencyStatus, RSTU_TAX_RELIEF_CAP
  )
  const rstuSavings = current.tax - withMaxRstuOnly.tax

  // 4. Determine recommendations
  // Only recommend maxing if it actually saves tax.
  // If already maxed (no savings possible), recommend keeping current level.
  // If income is too low for any tax benefit, recommend 0.
  const totalSavings = current.tax - optimized.tax

  let finalRecommendedSrs: number
  let finalRecommendedRstu: number

  if (current.tax === 0) {
    // No tax payable at all — no benefit from any deductions
    finalRecommendedSrs = 0
    finalRecommendedRstu = 0
  } else {
    // Recommend max if there are savings, otherwise keep current
    finalRecommendedSrs = srsSavings > 0 ? srsCap : currentSrsContribution
    finalRecommendedRstu = rstuSavings > 0 ? RSTU_TAX_RELIEF_CAP : currentRstuTopUp
  }

  return {
    recommendedSrs: finalRecommendedSrs,
    recommendedRstu: finalRecommendedRstu,
    currentTax: current.tax,
    optimizedTax: optimized.tax,
    taxSavings: totalSavings,
    marginalRate: optimized.marginalRate,
    breakdown: {
      cpfEmployee: cpfEmployeeContribution,
      srs: {
        current: currentSrsContribution,
        recommended: finalRecommendedSrs,
        savingsFromMax: Math.max(0, srsSavings),
      },
      rstu: {
        current: currentRstuTopUp,
        recommended: finalRecommendedRstu,
        savingsFromMax: Math.max(0, rstuSavings),
      },
      personalReliefs,
      chargeableIncome: {
        current: current.chargeable,
        optimized: optimized.chargeable,
      },
    },
  }
}
