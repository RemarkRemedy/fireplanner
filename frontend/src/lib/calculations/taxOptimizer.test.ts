import { describe, it, expect } from 'vitest'
import { optimizeTaxContributions, type TaxOptimizationInput } from './taxOptimizer'
import { SRS_ANNUAL_CAP, SRS_ANNUAL_CAP_FOREIGNER } from '@/lib/data/taxBrackets'
import { RSTU_TAX_RELIEF_CAP } from '@/lib/data/cpfRates'
import { calculateChargeableIncome, calculateProgressiveTax } from './tax'

function makeInput(overrides: Partial<TaxOptimizationInput> = {}): TaxOptimizationInput {
  return {
    grossIncome: 120_000,
    cpfEmployeeContribution: 20_000,
    currentSrsContribution: 0,
    currentRstuTopUp: 0,
    personalReliefs: 1_000, // earned income relief under 55
    residencyStatus: 'citizen',
    age: 35,
    ...overrides,
  }
}

describe('optimizeTaxContributions', () => {
  it('recommends max SRS + max RSTU for $120K income with no current contributions', () => {
    const input = makeInput()
    const result = optimizeTaxContributions(input)

    // Should recommend maxing both
    expect(result.recommendedSrs).toBe(SRS_ANNUAL_CAP)
    expect(result.recommendedRstu).toBe(RSTU_TAX_RELIEF_CAP)

    // Verify current tax using existing tax functions
    const currentChargeable = calculateChargeableIncome(
      120_000, 20_000, 0, 1_000, 'citizen', 0
    )
    const currentTax = calculateProgressiveTax(currentChargeable).taxPayable
    expect(result.currentTax).toBeCloseTo(currentTax, 2)

    // Verify optimized tax
    const optimizedChargeable = calculateChargeableIncome(
      120_000, 20_000, SRS_ANNUAL_CAP, 1_000, 'citizen', RSTU_TAX_RELIEF_CAP
    )
    const optimizedTax = calculateProgressiveTax(optimizedChargeable).taxPayable
    expect(result.optimizedTax).toBeCloseTo(optimizedTax, 2)

    // Tax savings should be positive
    expect(result.taxSavings).toBeCloseTo(currentTax - optimizedTax, 2)
    expect(result.taxSavings).toBeGreaterThan(0)

    // Breakdown should be coherent
    expect(result.breakdown.srs.current).toBe(0)
    expect(result.breakdown.srs.recommended).toBe(SRS_ANNUAL_CAP)
    expect(result.breakdown.rstu.current).toBe(0)
    expect(result.breakdown.rstu.recommended).toBe(RSTU_TAX_RELIEF_CAP)
    expect(result.breakdown.chargeableIncome.current).toBe(currentChargeable)
    expect(result.breakdown.chargeableIncome.optimized).toBe(optimizedChargeable)
  })

  it('handles $60K income with low marginal rate', () => {
    const input = makeInput({ grossIncome: 60_000, cpfEmployeeContribution: 12_000 })
    const result = optimizeTaxContributions(input)

    // Still recommends maxing (any marginal rate > 0 is beneficial)
    expect(result.recommendedSrs).toBe(SRS_ANNUAL_CAP)
    expect(result.recommendedRstu).toBe(RSTU_TAX_RELIEF_CAP)

    // But savings are smaller
    expect(result.taxSavings).toBeGreaterThan(0)
    // $60K gross - $12K CPF - $1K reliefs = $47K chargeable → marginal rate 7%
    // After maxing: $47K - $15.3K SRS - $8K RSTU = $23.7K → marginal rate 2%
    // Savings should be meaningful but much less than $120K scenario
  })

  it('returns zero additional savings when already maxed', () => {
    const input = makeInput({
      currentSrsContribution: SRS_ANNUAL_CAP,
      currentRstuTopUp: RSTU_TAX_RELIEF_CAP,
    })
    const result = optimizeTaxContributions(input)

    expect(result.recommendedSrs).toBe(SRS_ANNUAL_CAP)
    expect(result.recommendedRstu).toBe(RSTU_TAX_RELIEF_CAP)
    expect(result.taxSavings).toBe(0)
    expect(result.breakdown.srs.savingsFromMax).toBe(0)
    expect(result.breakdown.rstu.savingsFromMax).toBe(0)
  })

  it('uses foreigner SRS cap for non-citizen/PR', () => {
    const input = makeInput({
      residencyStatus: 'foreigner',
      cpfEmployeeContribution: 0, // foreigners have no CPF
    })
    const result = optimizeTaxContributions(input)

    expect(result.recommendedSrs).toBe(SRS_ANNUAL_CAP_FOREIGNER)
    expect(result.taxSavings).toBeGreaterThan(0)
  })

  it('handles zero income gracefully', () => {
    const input = makeInput({ grossIncome: 0, cpfEmployeeContribution: 0 })
    const result = optimizeTaxContributions(input)

    expect(result.currentTax).toBe(0)
    expect(result.optimizedTax).toBe(0)
    expect(result.taxSavings).toBe(0)
    expect(result.recommendedSrs).toBe(0)
    expect(result.recommendedRstu).toBe(0)
  })

  it('does not recommend contributions that would exceed income', () => {
    // Very low income: $10K gross, $2K CPF → $8K available
    // SRS cap $15.3K > available, should cap at what makes sense
    const input = makeInput({ grossIncome: 10_000, cpfEmployeeContribution: 2_000 })
    const result = optimizeTaxContributions(input)

    // With $10K gross - $2K CPF - $1K reliefs = $7K chargeable
    // In the 0-$20K bracket → 0% tax → no benefit from SRS/RSTU
    expect(result.taxSavings).toBe(0)
    expect(result.recommendedSrs).toBe(0)
    expect(result.recommendedRstu).toBe(0)
  })

  it('computes per-deduction savings independently', () => {
    const input = makeInput()
    const result = optimizeTaxContributions(input)

    // SRS savings + RSTU savings should approximately equal total savings
    // (Not exactly equal due to progressive brackets — the combined effect
    // may differ from sum of individual effects)
    // Total savings from maxing both simultaneously
    expect(result.taxSavings).toBeGreaterThan(0)
    // Individual savings computed independently should each be positive
    expect(result.breakdown.srs.savingsFromMax).toBeGreaterThan(0)
    expect(result.breakdown.rstu.savingsFromMax).toBeGreaterThan(0)
  })

  it('returns the post-optimization marginal rate', () => {
    const input = makeInput()
    const result = optimizeTaxContributions(input)

    // After optimization, marginal rate should correspond to the optimized chargeable income bracket
    const optimizedChargeable = result.breakdown.chargeableIncome.optimized
    const expectedResult = calculateProgressiveTax(optimizedChargeable)
    expect(result.marginalRate).toBe(expectedResult.marginalRate)
  })

  it('handles partially contributed SRS', () => {
    const input = makeInput({ currentSrsContribution: 5_000 })
    const result = optimizeTaxContributions(input)

    expect(result.recommendedSrs).toBe(SRS_ANNUAL_CAP)
    expect(result.breakdown.srs.current).toBe(5_000)
    expect(result.breakdown.srs.savingsFromMax).toBeGreaterThan(0)
  })
})
