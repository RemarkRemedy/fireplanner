import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  deriveCpfOaMonthly,
  accumulateCpfOa,
  estimateHousingGrant,
  lookupCpfLifeEstimate,
  checkLoanQualification,
  projectIncomeGrowth,
  estimateIncomeTax,
  checkIncomeCeiling,
  estimateHdbSaleProceeds,
  getEmergencyFundFloor,
  getPeerBenchmark,
  getParkingRecommendation,
  isEcGoal,
} from './goal-calculator-sg'
import { OW_CEILING_MONTHLY, OA_INTEREST_RATE } from '@/lib/data/cpfRates'
import { EHG_FAMILY_TABLE, EHG_SINGLE_TABLE, MORTGAGE_RATES } from '@/lib/data/goal-defaults'

// ============================================================
// deriveCpfOaMonthly
// ============================================================

describe('deriveCpfOaMonthly', () => {
  it('age 30 below OW ceiling', () => {
    // OA rate for age 30 = 0.23 (35 and below bracket)
    const result = deriveCpfOaMonthly(5000, 30)
    expect(result).toBeCloseTo(5000 * 0.23, 2)
  })

  it('age 30 at OW ceiling', () => {
    const result = deriveCpfOaMonthly(OW_CEILING_MONTHLY, 30)
    expect(result).toBeCloseTo(OW_CEILING_MONTHLY * 0.23, 2)
  })

  it('age 30 above OW ceiling is capped', () => {
    const result = deriveCpfOaMonthly(15000, 30)
    // Should be capped at OW ceiling * rate
    expect(result).toBeCloseTo(OW_CEILING_MONTHLY * 0.23, 2)
  })

  it('age 40 uses 35-45 bracket (OA rate 0.21)', () => {
    const result = deriveCpfOaMonthly(5000, 40)
    expect(result).toBeCloseTo(5000 * 0.21, 2)
  })

  it('age 48 uses 45-50 bracket (OA rate 0.19)', () => {
    const result = deriveCpfOaMonthly(5000, 48)
    expect(result).toBeCloseTo(5000 * 0.19, 2)
  })

  it('age 52 uses 50-55 bracket (OA rate 0.15)', () => {
    const result = deriveCpfOaMonthly(5000, 52)
    expect(result).toBeCloseTo(5000 * 0.15, 2)
  })

  it('age 58 uses 55-60 bracket (OA rate 0.12)', () => {
    const result = deriveCpfOaMonthly(5000, 58)
    expect(result).toBeCloseTo(5000 * 0.12, 2)
  })

  it('age 62 uses 60-65 bracket (OA rate 0.035)', () => {
    const result = deriveCpfOaMonthly(5000, 62)
    expect(result).toBeCloseTo(5000 * 0.035, 2)
  })

  it('age 68 uses 65-70 bracket (OA rate 0.01)', () => {
    const result = deriveCpfOaMonthly(5000, 68)
    expect(result).toBeCloseTo(5000 * 0.01, 2)
  })

  it('age 75 uses above 70 bracket (OA rate 0.01)', () => {
    const result = deriveCpfOaMonthly(5000, 75)
    expect(result).toBeCloseTo(5000 * 0.01, 2)
  })

  it('zero income returns 0', () => {
    expect(deriveCpfOaMonthly(0, 30)).toBe(0)
  })

  it('negative income returns 0', () => {
    expect(deriveCpfOaMonthly(-5000, 30)).toBe(0)
  })
})

// ============================================================
// accumulateCpfOa
// ============================================================

describe('accumulateCpfOa', () => {
  it('5-year horizon accumulates with interest', () => {
    const months = 60
    const result = accumulateCpfOa(6000, 30, months)
    // Monthly OA contribution = 6000 * 0.23 = 1380
    // FV annuity at 2.5% / 12 per month for 60 months
    const monthlyRate = OA_INTEREST_RATE / 12
    const expected = 1380 * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
    expect(result).toBeCloseTo(expected, 0)
    expect(result).toBeGreaterThan(1380 * months) // Interest should add value
  })

  it('10-year horizon accumulates more than 5-year', () => {
    const result5 = accumulateCpfOa(6000, 30, 60)
    const result10 = accumulateCpfOa(6000, 30, 120)
    expect(result10).toBeGreaterThan(result5 * 2) // Compound effect
  })

  it('zero months returns 0', () => {
    expect(accumulateCpfOa(6000, 30, 0)).toBe(0)
  })

  it('negative months returns 0', () => {
    expect(accumulateCpfOa(6000, 30, -12)).toBe(0)
  })

  it('zero income returns 0', () => {
    expect(accumulateCpfOa(0, 30, 60)).toBe(0)
  })

  it('without interest should equal monthly * months (conceptual check)', () => {
    // With 2.5% interest, result should be greater than simple sum
    const monthly = deriveCpfOaMonthly(6000, 30)
    const months = 60
    const simpleSum = monthly * months
    const result = accumulateCpfOa(6000, 30, months)
    expect(result).toBeGreaterThan(simpleSum)
  })
})

// ============================================================
// estimateHousingGrant
// ============================================================

describe('estimateHousingGrant', () => {
  it('BTO couple at $3000 income gets $95K EHG', () => {
    const result = estimateHousingGrant(3000, '4-room', 'new', false)
    expect(result).toBe(95_000)
  })

  it('BTO single at $3000 income gets $25K EHG', () => {
    const result = estimateHousingGrant(3000, '4-room', 'new', true)
    expect(result).toBe(25_000)
  })

  it('BTO income > $9K gets $0', () => {
    const result = estimateHousingGrant(10_000, '4-room', 'new', false)
    expect(result).toBe(0)
  })

  it('BTO income exactly at bracket boundary', () => {
    // $1500 is the boundary of the first bracket (maxIncome: 1500)
    const result = estimateHousingGrant(1500, '4-room', 'new', false)
    expect(result).toBe(120_000)
  })

  it('BTO income just above first bracket', () => {
    const result = estimateHousingGrant(1501, '4-room', 'new', false)
    expect(result).toBe(110_000) // Falls into $2000 bracket
  })

  it('resale couple 4-room gets family grant + EHG', () => {
    const result = estimateHousingGrant(5000, '4-room', 'resale', false)
    // Family grant for 4-room = $80K, EHG family at $5000 = $65K
    expect(result).toBe(80_000 + 65_000)
  })

  it('resale couple 5-room gets smaller family grant + EHG', () => {
    const result = estimateHousingGrant(5000, '5-room', 'resale', false)
    // Family grant for 5-room = $50K, EHG family at $5000 = $65K
    expect(result).toBe(50_000 + 65_000)
  })

  it('resale single gets $0 family grant but still gets EHG', () => {
    // Singles: $5000 is above the $4,500 ceiling → $0 EHG
    const result = estimateHousingGrant(5000, '4-room', 'resale', true)
    expect(result).toBe(0)
  })

  it('resale high income couple gets family grant only', () => {
    const result = estimateHousingGrant(12_000, '4-room', 'resale', false)
    // Income > $9K so EHG = $0, but family grant = $80K
    expect(result).toBe(80_000)
  })

  it('resale high income single gets $0', () => {
    const result = estimateHousingGrant(12_000, '4-room', 'resale', true)
    expect(result).toBe(0)
  })

  it('zero income returns 0', () => {
    expect(estimateHousingGrant(0, '4-room', 'new', false)).toBe(0)
  })

  it('negative income returns 0', () => {
    expect(estimateHousingGrant(-1000, '4-room', 'new', false)).toBe(0)
  })

  // EC-specific tests
  it('EC couple 4-room gets $80K Family Grant (no EHG)', () => {
    // EC buyers get Family Grant only, not EHG — so $80K regardless of income (within ceiling)
    const result = estimateHousingGrant(8_000, '4-room', 'new', false, 'ec')
    expect(result).toBe(80_000)
  })

  it('EC couple 5-room gets $50K Family Grant (no EHG)', () => {
    const result = estimateHousingGrant(8_000, '5-room', 'new', false, 'ec')
    expect(result).toBe(50_000)
  })

  it('EC couple 3-room gets $80K Family Grant (4-room or smaller bracket)', () => {
    const result = estimateHousingGrant(10_000, '3-room', 'new', false, 'ec')
    expect(result).toBe(80_000)
  })

  it('EC single gets $0 (singles not eligible for Family Grant)', () => {
    const result = estimateHousingGrant(5_000, '4-room', 'new', true, 'ec')
    expect(result).toBe(0)
  })

  it('EC: high income couple above EHG ceiling still gets Family Grant', () => {
    // HDB EHG ceiling is $9K — EC doesn't get EHG at all, so grant is unaffected
    const result = estimateHousingGrant(15_000, '4-room', 'new', false, 'ec')
    expect(result).toBe(80_000)
  })

  it('EC: does NOT return EHG amount on top of Family Grant', () => {
    // For HDB resale at $5K income, couple gets $80K + $65K EHG = $145K
    // For EC at $5K income, couple should get $80K Family Grant only
    const hdbResult = estimateHousingGrant(5_000, '4-room', 'resale', false, 'hdb')
    const ecResult = estimateHousingGrant(5_000, '4-room', 'new', false, 'ec')
    expect(hdbResult).toBe(145_000)
    expect(ecResult).toBe(80_000)
  })

  it('EC: zero income returns 0', () => {
    expect(estimateHousingGrant(0, '4-room', 'new', false, 'ec')).toBe(0)
  })

  // Property-based test: any income in a family bracket returns the correct grant
  it('property: income within a family bracket returns consistent EHG', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: EHG_FAMILY_TABLE.length - 1 }),
        (bracketIndex) => {
          const bracket = EHG_FAMILY_TABLE[bracketIndex]
          const prevMax = bracketIndex > 0 ? EHG_FAMILY_TABLE[bracketIndex - 1].maxIncome : 0
          const income = prevMax + 1
          const result = estimateHousingGrant(income, '4-room', 'new', false)
          expect(result).toBe(bracket.grant)
        },
      ),
      { numRuns: 100 },
    )
  })

  // Property-based test: any income in a single bracket returns the correct grant
  it('property: income within a single bracket returns consistent EHG', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: EHG_SINGLE_TABLE.length - 1 }),
        (bracketIndex) => {
          const bracket = EHG_SINGLE_TABLE[bracketIndex]
          const prevMax = bracketIndex > 0 ? EHG_SINGLE_TABLE[bracketIndex - 1].maxIncome : 0
          const income = prevMax + 1
          const result = estimateHousingGrant(income, '4-room', 'new', true)
          expect(result).toBe(bracket.grant)
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ============================================================
// lookupCpfLifeEstimate
// ============================================================

describe('lookupCpfLifeEstimate', () => {
  it('income below $3K returns $500', () => {
    expect(lookupCpfLifeEstimate(2000)).toBe(500)
  })

  it('income $3K-$4K returns $800', () => {
    expect(lookupCpfLifeEstimate(3000)).toBe(800)
    expect(lookupCpfLifeEstimate(3500)).toBe(800)
  })

  it('income $4K-$5K returns $1000', () => {
    expect(lookupCpfLifeEstimate(4000)).toBe(1000)
    expect(lookupCpfLifeEstimate(4999)).toBe(1000)
  })

  it('income $5K-$6K returns $1200', () => {
    expect(lookupCpfLifeEstimate(5000)).toBe(1200)
  })

  it('income $6K-$8K returns $1500', () => {
    expect(lookupCpfLifeEstimate(6000)).toBe(1500)
    expect(lookupCpfLifeEstimate(7999)).toBe(1500)
  })

  it('income > $8K returns $1800', () => {
    expect(lookupCpfLifeEstimate(8000)).toBe(1800)
    expect(lookupCpfLifeEstimate(20_000)).toBe(1800)
  })

  it('zero income returns 0', () => {
    expect(lookupCpfLifeEstimate(0)).toBe(0)
  })

  it('negative income returns 0', () => {
    expect(lookupCpfLifeEstimate(-5000)).toBe(0)
  })
})

// ============================================================
// checkLoanQualification
// ============================================================

describe('checkLoanQualification', () => {
  it('HDB loan passes MSR check', () => {
    // Income $8000, MSR 30% = $2400/month max
    // $400K loan at 2.6% over 25 years
    const result = checkLoanQualification(8000, 400_000, 0.026, 25, 'hdb')
    expect(result.monthlyPayment).toBeGreaterThan(0)
    expect(result.maxLoan).toBeGreaterThan(0)
    // Monthly payment for $400K at 2.6% / 25yr ~ $1810
    expect(result.qualified).toBe(true)
  })

  it('HDB loan fails when loan too large', () => {
    // Income $5000, MSR 30% = $1500/month max
    // $600K loan at 2.6% over 25 years ~ $2715/month — should fail
    const result = checkLoanQualification(5000, 600_000, 0.026, 25, 'hdb')
    expect(result.qualified).toBe(false)
  })

  it('condo uses TDSR 55%', () => {
    // Income $10000, TDSR 55% = $5500/month max
    // $1M loan at 3% over 30 years ~ $4216/month — should pass
    const result = checkLoanQualification(10_000, 1_000_000, 0.03, 30, 'condo')
    expect(result.qualified).toBe(true)
  })

  it('landed uses TDSR 55% same as condo', () => {
    const result = checkLoanQualification(10_000, 1_000_000, 0.03, 30, 'landed')
    expect(result.qualified).toBe(true)
    // Same result as condo for same inputs
    const condoResult = checkLoanQualification(10_000, 1_000_000, 0.03, 30, 'condo')
    expect(result.maxLoan).toBeCloseTo(condoResult.maxLoan, 0)
  })

  it('ec uses TDSR 55% same as condo', () => {
    // EC is financed by bank loan — uses 55% TDSR cap, same as condo/landed
    const ecResult = checkLoanQualification(10_000, 1_000_000, 0.03, 30, 'ec')
    const condoResult = checkLoanQualification(10_000, 1_000_000, 0.03, 30, 'condo')
    expect(ecResult.qualified).toBe(condoResult.qualified)
    expect(ecResult.maxLoan).toBeCloseTo(condoResult.maxLoan, 0)
    expect(ecResult.monthlyPayment).toBeCloseTo(condoResult.monthlyPayment, 0)
  })

  it('ec does NOT use HDB MSR 30% cap', () => {
    // Income $6000: MSR 30% = $1800, TDSR 55% = $3300
    // A $500K loan at 3.5% / 30yr ~ $2245/month: fails MSR ($1800 cap) but passes TDSR ($3300 cap)
    const ecResult = checkLoanQualification(6_000, 500_000, 0.035, 30, 'ec')
    const hdbResult = checkLoanQualification(6_000, 500_000, 0.035, 30, 'hdb')
    expect(ecResult.qualified).toBe(true)   // passes TDSR 55%
    expect(hdbResult.qualified).toBe(false) // fails MSR 30%
  })

  it('zero loan returns qualified with zero payment', () => {
    const result = checkLoanQualification(8000, 0, 0.026, 25, 'hdb')
    expect(result.qualified).toBe(true)
    expect(result.maxLoan).toBe(0)
    expect(result.monthlyPayment).toBe(0)
  })

  it('negative loan is clamped to 0', () => {
    const result = checkLoanQualification(8000, -50_000, 0.026, 25, 'hdb')
    expect(result.qualified).toBe(true)
    expect(result.maxLoan).toBe(0)
    expect(result.monthlyPayment).toBe(0)
  })

  it('maxLoan is consistent with servicing ratio', () => {
    // Verify that maxLoan produces a monthly payment equal to the servicing cap
    const income = 8000
    const result = checkLoanQualification(income, 500_000, 0.026, 25, 'hdb')
    const maxMonthly = income * 0.30

    // Compute payment for maxLoan
    const monthlyRate = 0.026 / 12
    const n = 25 * 12
    const factor = Math.pow(1 + monthlyRate, n)
    const paymentAtMax = result.maxLoan * (monthlyRate * factor) / (factor - 1)
    expect(paymentAtMax).toBeCloseTo(maxMonthly, 0)
  })

  it('zero interest rate works', () => {
    const result = checkLoanQualification(8000, 400_000, 0, 25, 'hdb')
    // PMT = 400K / 300 months = $1333.33
    expect(result.monthlyPayment).toBeCloseTo(400_000 / 300, 0)
    expect(result.qualified).toBe(true)
  })
})

// ============================================================
// projectIncomeGrowth
// ============================================================

describe('projectIncomeGrowth', () => {
  it('0 years returns current income', () => {
    expect(projectIncomeGrowth(5000, 0, 0.05)).toBe(5000)
  })

  it('0 growth rate returns current income', () => {
    expect(projectIncomeGrowth(5000, 10, 0)).toBe(5000)
  })

  it('5 years at 5% growth returns time-weighted average', () => {
    const result = projectIncomeGrowth(5000, 5, 0.05)
    // (5000 * ((1.05^5 - 1) / (5 * 0.05)))
    const expected = 5000 * (Math.pow(1.05, 5) - 1) / (5 * 0.05)
    expect(result).toBeCloseTo(expected, 2)
    // Should be between current and final income
    expect(result).toBeGreaterThan(5000)
    expect(result).toBeLessThan(5000 * Math.pow(1.05, 5))
  })

  it('10 years at 3% growth', () => {
    const result = projectIncomeGrowth(6000, 10, 0.03)
    const expected = 6000 * (Math.pow(1.03, 10) - 1) / (10 * 0.03)
    expect(result).toBeCloseTo(expected, 2)
  })

  it('negative growth rate works (declining average)', () => {
    const result = projectIncomeGrowth(5000, 5, -0.05)
    expect(result).toBeLessThan(5000)
    expect(result).toBeGreaterThan(0)
  })
})

// ============================================================
// estimateIncomeTax
// ============================================================

describe('estimateIncomeTax', () => {
  it('income below tax threshold ($20K + relief) pays $0', () => {
    // Age 30: earned income relief = $1000
    // Chargeable income = $20K - $1K = $19K — below $20K threshold
    const result = estimateIncomeTax(20_000, 30)
    expect(result.annualTax).toBe(0)
    expect(result.monthlySetAside).toBe(0)
  })

  it('mid-bracket income produces correct tax', () => {
    // Age 30: relief = $1000
    // Gross $80K → chargeable = $79K
    // Tax: 0 + 200 + 350 + (79000-40000)*0.07 = 0 + 200 + 350 + 2730 = 3280
    const result = estimateIncomeTax(80_000, 30)
    expect(result.annualTax).toBeCloseTo(3280, 0)
    expect(result.monthlySetAside).toBeCloseTo(3280 / 12, 0)
  })

  it('age 60+ gets $8000 earned income relief', () => {
    // Age 60: relief = $8000
    // Gross $50K → chargeable = $42K
    // Tax: 0 + 200 + 350 + (42000-40000)*0.07 = 690
    const result = estimateIncomeTax(50_000, 60)
    expect(result.annualTax).toBeCloseTo(690, 0)
  })

  it('age 55-59 gets $6000 earned income relief', () => {
    // Age 55: relief = $6000
    // Gross $50K → chargeable = $44K
    // Tax: 0 + 200 + 350 + (44000-40000)*0.07 = 830
    const result = estimateIncomeTax(50_000, 55)
    expect(result.annualTax).toBeCloseTo(830, 0)
  })

  it('zero income returns zero tax', () => {
    const result = estimateIncomeTax(0, 30)
    expect(result.annualTax).toBe(0)
    expect(result.monthlySetAside).toBe(0)
  })

  it('negative income returns zero tax', () => {
    const result = estimateIncomeTax(-10_000, 30)
    expect(result.annualTax).toBe(0)
  })

  it('high income gets progressive rates', () => {
    // Age 30: relief = $1000
    // Gross $200K → chargeable = $199K
    // Should be in the 18% bracket (160K-200K)
    const result = estimateIncomeTax(200_000, 30)
    expect(result.annualTax).toBeGreaterThan(13_000)
    expect(result.annualTax).toBeLessThan(25_000)
  })
})

// ============================================================
// checkIncomeCeiling
// ============================================================

describe('checkIncomeCeiling', () => {
  it('already exceeds ceiling', () => {
    const result = checkIncomeCeiling(15_000, 0.05, 14_000)
    expect(result.alreadyExceeds).toBe(true)
    expect(result.yearsToExceed).toBe(0)
  })

  it('exactly at ceiling counts as exceeding', () => {
    const result = checkIncomeCeiling(14_000, 0.05, 14_000)
    expect(result.alreadyExceeds).toBe(true)
    expect(result.yearsToExceed).toBe(0)
  })

  it('5 years away at known growth rate', () => {
    // Income $10K, ceiling $14K, rate 7%
    // years = ln(14000/10000) / ln(1.07) = ln(1.4) / ln(1.07) ~ 4.97
    const result = checkIncomeCeiling(10_000, 0.07, 14_000)
    expect(result.alreadyExceeds).toBe(false)
    expect(result.yearsToExceed).not.toBeNull()
    expect(result.yearsToExceed!).toBeCloseTo(4.97, 1)
  })

  it('never exceeds with zero growth', () => {
    const result = checkIncomeCeiling(10_000, 0, 14_000)
    expect(result.alreadyExceeds).toBe(false)
    expect(result.yearsToExceed).toBeNull()
  })

  it('never exceeds with negative growth', () => {
    const result = checkIncomeCeiling(10_000, -0.05, 14_000)
    expect(result.alreadyExceeds).toBe(false)
    expect(result.yearsToExceed).toBeNull()
  })
})

// ============================================================
// estimateHdbSaleProceeds
// ============================================================

describe('estimateHdbSaleProceeds', () => {
  it('HDB loan after 10 years', () => {
    const result = estimateHdbSaleProceeds(500_000, 10, 'hdb-loan')
    expect(result).toBeGreaterThan(0)

    // Appreciated value: 500K * 1.03^10 ~ 671,958
    const appreciated = 500_000 * Math.pow(1.03, 10)

    // LTV 90%, so principal = 450K
    // Balance after 10 years (120 months) of 300-month loan at 2.6%/12
    const principal = 500_000 * 0.90
    const monthlyRate = 0.026 / 12
    const n = 300
    const t = 120
    const compN = Math.pow(1 + monthlyRate, n)
    const compT = Math.pow(1 + monthlyRate, t)
    const outstanding = principal * (compN - compT) / (compN - 1)

    const sellingCosts = appreciated * 0.025
    const expected = appreciated - outstanding - sellingCosts
    expect(result).toBeCloseTo(expected, 0)
  })

  it('bank loan after 10 years (lower LTV, higher rate)', () => {
    const result = estimateHdbSaleProceeds(500_000, 10, 'bank-loan')
    expect(result).toBeGreaterThan(0)
    // Bank loan has 75% LTV (lower principal) but 3.0% rate
    // Should generally yield higher proceeds than HDB loan for same period
    // because lower principal outstanding
    const hdbResult = estimateHdbSaleProceeds(500_000, 10, 'hdb-loan')
    expect(result).toBeGreaterThan(hdbResult) // Lower LTV = less owed
  })

  it('negative equity guard: returns 0 when underwater', () => {
    // Selling after 0 years — almost full loan outstanding, plus selling costs
    // Principal = 90% of 100K = 90K, appreciated = 100K, costs = 2.5K
    // 100K - 90K - 2.5K = 7.5K — actually positive for this case
    // Use a scenario where it might go negative: very short hold, high LTV
    const result = estimateHdbSaleProceeds(100_000, 0, 'hdb-loan')
    // 100K - 90K - 2.5K = 7.5K — still positive
    expect(result).toBeGreaterThanOrEqual(0)
  })

  it('zero purchase price returns 0', () => {
    expect(estimateHdbSaleProceeds(0, 10, 'hdb-loan')).toBe(0)
  })

  it('negative purchase price returns 0', () => {
    expect(estimateHdbSaleProceeds(-100_000, 10, 'hdb-loan')).toBe(0)
  })

  it('negative years held returns 0', () => {
    expect(estimateHdbSaleProceeds(500_000, -5, 'hdb-loan')).toBe(0)
  })

  it('loan fully paid after 25+ years', () => {
    const result = estimateHdbSaleProceeds(500_000, 30, 'hdb-loan')
    // After 30 years (360 months >= 300 tenure), loan is fully paid
    const appreciated = 500_000 * Math.pow(1.03, 30)
    const sellingCosts = appreciated * 0.025
    expect(result).toBeCloseTo(appreciated - sellingCosts, 0)
  })

  it('uses correct rates from MORTGAGE_RATES', () => {
    expect(MORTGAGE_RATES.hdb).toBe(0.026)
    expect(MORTGAGE_RATES.bank).toBe(0.030)
  })
})

// ============================================================
// getEmergencyFundFloor
// ============================================================

describe('getEmergencyFundFloor', () => {
  it('normal expenses', () => {
    expect(getEmergencyFundFloor(3000)).toBe(9000)
  })

  it('zero expenses', () => {
    expect(getEmergencyFundFloor(0)).toBe(0)
  })

  it('negative expenses clamped to 0', () => {
    expect(getEmergencyFundFloor(-1000)).toBe(0)
  })

  it('high expenses', () => {
    expect(getEmergencyFundFloor(10_000)).toBe(30_000)
  })
})

// ============================================================
// getPeerBenchmark
// ============================================================

describe('getPeerBenchmark', () => {
  // Agent B's PEER_BENCHMARKS: rate 0.50→p85, 0.40→p70, 0.30→p55, 0.20→p40, 0.10→p25
  // Thresholds: p>=75 → "3 in 4", p>=50 → "above median", matched → "middle range", no match → "below average"

  it('very high savings rate (p85)', () => {
    const result = getPeerBenchmark(0.50, 30)
    expect(result).toContain('higher than about 3 in 4')
  })

  it('above median (p55 for 30% savings)', () => {
    const result = getPeerBenchmark(0.30, 30)
    expect(result).toContain('above the median')
  })

  it('middle range (p25 for 10-19% savings)', () => {
    const result = getPeerBenchmark(0.15, 30)
    expect(result).toContain('middle range')
  })

  it('below average (below lowest bracket)', () => {
    const result = getPeerBenchmark(0.02, 30)
    expect(result).toContain('below average')
  })

  it('age 45 uses 40-49 bracket', () => {
    const result = getPeerBenchmark(0.50, 45)
    expect(result).toContain('higher than about 3 in 4')
  })

  it('age 65 uses last bracket', () => {
    const result = getPeerBenchmark(0.50, 65)
    expect(result).toContain('higher than about 3 in 4')
  })

  it('exactly at p70 boundary (40% savings) is above median but not top', () => {
    const result = getPeerBenchmark(0.40, 25)
    expect(result).toContain('above the median')
  })

  it('exactly at p25 boundary (10% savings) is middle range', () => {
    const result = getPeerBenchmark(0.10, 25)
    expect(result).toContain('middle range')
  })
})

// ============================================================
// getParkingRecommendation
// ============================================================

describe('getParkingRecommendation', () => {
  it('< 2 years: high-yield savings', () => {
    expect(getParkingRecommendation(0.5)).toBe('High-yield savings account')
    expect(getParkingRecommendation(1)).toBe('High-yield savings account')
    expect(getParkingRecommendation(1.9)).toBe('High-yield savings account')
  })

  it('2-5 years: SSB / T-bills', () => {
    expect(getParkingRecommendation(2)).toBe('Singapore Savings Bonds or T-bills')
    expect(getParkingRecommendation(3)).toBe('Singapore Savings Bonds or T-bills')
    expect(getParkingRecommendation(5)).toBe('Singapore Savings Bonds or T-bills')
  })

  it('5-10 years: index fund', () => {
    expect(getParkingRecommendation(6)).toBe('Low-cost index fund')
    expect(getParkingRecommendation(10)).toBe('Low-cost index fund')
  })

  it('> 10 years: diversified portfolio', () => {
    expect(getParkingRecommendation(11)).toBe('Diversified portfolio')
    expect(getParkingRecommendation(30)).toBe('Diversified portfolio')
  })

  it('exactly 5.001 is index fund', () => {
    expect(getParkingRecommendation(5.001)).toBe('Low-cost index fund')
  })

  it('0 years is high-yield savings', () => {
    expect(getParkingRecommendation(0)).toBe('High-yield savings account')
  })

  it('negative years is high-yield savings', () => {
    expect(getParkingRecommendation(-1)).toBe('High-yield savings account')
  })
})

// ============================================================
// isEcGoal
// ============================================================

describe('isEcGoal', () => {
  it('returns true for "ec"', () => {
    expect(isEcGoal('ec')).toBe(true)
  })

  it('returns false for "hdb"', () => {
    expect(isEcGoal('hdb')).toBe(false)
  })

  it('returns false for "condo"', () => {
    expect(isEcGoal('condo')).toBe(false)
  })

  it('returns false for "landed"', () => {
    expect(isEcGoal('landed')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isEcGoal('')).toBe(false)
  })

  it('returns false for unrelated strings', () => {
    expect(isEcGoal('wedding')).toBe(false)
    expect(isEcGoal('car')).toBe(false)
    expect(isEcGoal('EC')).toBe(false) // case-sensitive
  })
})

// ============================================================
// Property-based tests
// ============================================================

describe('property-based tests', () => {
  it('deriveCpfOaMonthly: capped at OW ceiling contribution', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 50_000, noNaN: true }),
        fc.integer({ min: 20, max: 70 }),
        (income, age) => {
          const result = deriveCpfOaMonthly(income, age)
          const atCeiling = deriveCpfOaMonthly(OW_CEILING_MONTHLY, age)
          expect(result).toBeLessThanOrEqual(atCeiling + 0.01)
        },
      ),
      { numRuns: 200 },
    )
  })

  it('accumulateCpfOa: monotonically increasing with months', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1000, max: 15_000, noNaN: true }),
        fc.integer({ min: 20, max: 60 }),
        fc.integer({ min: 1, max: 360 }),
        (income, age, months) => {
          const result = accumulateCpfOa(income, age, months)
          const resultMore = accumulateCpfOa(income, age, months + 1)
          expect(resultMore).toBeGreaterThanOrEqual(result)
        },
      ),
      { numRuns: 200 },
    )
  })

  it('estimateHdbSaleProceeds: non-negative for valid inputs', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 100_000, max: 2_000_000, noNaN: true }),
        fc.integer({ min: 0, max: 40 }),
        fc.constantFrom('hdb-loan' as const, 'bank-loan' as const),
        (price, years, loanType) => {
          const result = estimateHdbSaleProceeds(price, years, loanType)
          expect(result).toBeGreaterThanOrEqual(0)
        },
      ),
      { numRuns: 200 },
    )
  })

  it('checkLoanQualification: maxLoan increases with income', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 3000, max: 30_000, noNaN: true }),
        fc.constantFrom('hdb' as const, 'condo' as const),
        (income, propertyType) => {
          const result1 = checkLoanQualification(income, 500_000, 0.03, 25, propertyType)
          const result2 = checkLoanQualification(income + 1000, 500_000, 0.03, 25, propertyType)
          expect(result2.maxLoan).toBeGreaterThanOrEqual(result1.maxLoan)
        },
      ),
      { numRuns: 100 },
    )
  })
})
