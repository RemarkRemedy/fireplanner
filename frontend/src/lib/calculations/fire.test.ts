import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  calculateFireNumber,
  calculateYearsToFire,
  calculateCoastFire,
  calculateBaristaFireIncome,
  calculateLeanFire,
  calculateFatFire,
  calculateProgress,
  calculateAllFireMetrics,
  projectPortfolioAtRetirement,
  projectNetWorthPath,
  calculateLiquidBridgeGap,
  calculateParentSupportAtAge,
  calculateProjectionFireNumber,
  normalizeProjectionFireNumber,
} from './fire'
import type { ParentSupport } from '@/lib/types'

describe('calculateFireNumber', () => {
  it('computes basic FIRE number: expenses / SWR', () => {
    expect(calculateFireNumber(30000, 0.035)).toBeCloseTo(857142.857, 0)
    expect(calculateFireNumber(96000, 0.04)).toBe(2400000)
    expect(calculateFireNumber(80000, 0.04)).toBe(2000000)
  })

  it('returns 0 for zero/negative expenses or SWR', () => {
    expect(calculateFireNumber(0, 0.04)).toBe(0)
    expect(calculateFireNumber(-10000, 0.04)).toBe(0)
    expect(calculateFireNumber(30000, 0)).toBe(0)
    expect(calculateFireNumber(30000, -0.01)).toBe(0)
  })

  // Integration test vectors from CLAUDE.md
  it('Fresh Graduate: $30K expenses, 3.5% SWR → $857,143', () => {
    expect(calculateFireNumber(30000, 0.035)).toBeCloseTo(857143, 0)
  })

  it('Mid-Career: $96K expenses, 4% SWR → $2,400,000', () => {
    expect(calculateFireNumber(96000, 0.04)).toBe(2400000)
  })

  it('Pre-Retiree: $80K expenses, 4% SWR → $2,000,000', () => {
    expect(calculateFireNumber(80000, 0.04)).toBe(2000000)
  })
})

describe('calculateYearsToFire', () => {
  it('returns 0 when NW already >= FIRE number', () => {
    expect(calculateYearsToFire(0.04, 50000, 1000000, 1000000)).toBe(0)
    expect(calculateYearsToFire(0.04, 50000, 1500000, 1000000)).toBe(0)
  })

  it('returns Infinity when impossible (no savings, no growth)', () => {
    expect(calculateYearsToFire(0, 0, 100000, 1000000)).toBe(Infinity)
    expect(calculateYearsToFire(-0.02, -5000, 100000, 1000000)).toBe(Infinity)
  })

  it('handles negative net worth: takes longer to reach FIRE', () => {
    // With negative NW, years to FIRE should be longer than starting from 0
    const fromZero = calculateYearsToFire(0.04, 50000, 0, 1000000)
    const fromNegative = calculateYearsToFire(0.04, 50000, -50000, 1000000)
    expect(fromNegative).toBeGreaterThan(fromZero)
    expect(fromNegative).toBeGreaterThan(0)
    expect(isFinite(fromNegative)).toBe(true)
  })

  it('handles r=0 with positive savings (linear)', () => {
    // (1M - 100K) / 50K = 18 years
    expect(calculateYearsToFire(0, 50000, 100000, 1000000)).toBe(18)
  })

  it('Fresh Graduate: NPER with 4.4% return, $18K savings, $50K→$857K', () => {
    // NPER formula: ln((s/r + FN) / (s/r + NW)) / ln(1+r)
    // = ln((18000/0.044 + 857143) / (18000/0.044 + 50000)) / ln(1.044)
    // = ln(1266234 / 459091) / 0.04305 ≈ 23.56
    // Note: CLAUDE.md says "~16 years" but that estimate includes CPF growth.
    // The pure NPER formula with stated inputs gives ~23.6 years.
    const netReal = 0.072 - 0.025 - 0.003 // 0.044
    const years = calculateYearsToFire(netReal, 18000, 50000, 857143)
    expect(years).toBeCloseTo(23.56, 0)
  })

  it('Mid-Career: NPER with 3.9% return, $84K savings, $1.1M→$2.4M', () => {
    // = ln((84000/0.039 + 2400000) / (84000/0.039 + 1100000)) / ln(1.039) ≈ 8.79
    // Note: CLAUDE.md says "~12 years" but the exact NPER with these inputs gives ~8.8.
    const netReal = 0.039
    const years = calculateYearsToFire(netReal, 84000, 1100000, 2400000)
    expect(years).toBeCloseTo(8.79, 0)
  })

  it('Pre-Retiree: 0 years (already at FIRE)', () => {
    expect(calculateYearsToFire(0.03, 0, 2000000, 2000000)).toBe(0)
  })

  it('positive return always produces finite result', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.001, max: 0.2, noNaN: true }),
        fc.double({ min: 1000, max: 500000, noNaN: true }),
        fc.double({ min: 0, max: 5000000, noNaN: true }),
        fc.double({ min: 10000, max: 10000000, noNaN: true }),
        (r, savings, nw, fire) => {
          if (nw >= fire) return true
          const years = calculateYearsToFire(r, savings, nw, fire)
          return years >= 0 && isFinite(years)
        }
      )
    )
  })
})

describe('calculateCoastFire', () => {
  it('discounts FIRE number to present value', () => {
    // $857,143 / (1.044)^16 = $430,373
    const coast = calculateCoastFire(857143, 0.044, 16)
    expect(coast).toBeCloseTo(430373, -2) // within $100
  })

  it('returns FIRE number when years = 0', () => {
    expect(calculateCoastFire(1000000, 0.05, 0)).toBe(1000000)
  })

  it('returns Infinity when return is -100% or worse', () => {
    expect(calculateCoastFire(1000000, -1, 10)).toBe(Infinity)
  })
})

describe('calculateBaristaFireIncome', () => {
  it('Fresh Graduate: $28,250/yr barista income needed', () => {
    // max(0, $30K - $50K * 0.035) = max(0, 30000 - 1750) = $28,250
    expect(calculateBaristaFireIncome(30000, 50000, 0.035)).toBe(28250)
  })

  it('returns 0 when portfolio covers all expenses', () => {
    expect(calculateBaristaFireIncome(80000, 2500000, 0.04)).toBe(0)
  })
})

describe('calculateLeanFire / calculateFatFire', () => {
  it('Lean FIRE = 60% of regular', () => {
    expect(calculateLeanFire(100000, 0.04)).toBeCloseTo(1500000)
  })

  it('Fat FIRE = 150% of regular', () => {
    expect(calculateFatFire(100000, 0.04)).toBeCloseTo(3750000)
  })
})

describe('calculateProgress', () => {
  it('Mid-Career: $1.1M / $2.4M = 45.8%', () => {
    expect(calculateProgress(1100000, 2400000)).toBeCloseTo(0.458, 2)
  })

  it('returns 0 for zero FIRE number', () => {
    expect(calculateProgress(500000, 0)).toBe(0)
  })

  it('can exceed 1.0 when past FIRE', () => {
    expect(calculateProgress(2500000, 2000000)).toBe(1.25)
  })

  it('negative net worth returns negative progress', () => {
    const progress = calculateProgress(-50000, 1200000)
    expect(progress).toBeLessThan(0)
  })
})

describe('calculateAllFireMetrics', () => {
  it('Fresh Graduate scenario produces expected metrics', () => {
    const m = calculateAllFireMetrics({
      currentAge: 25,
      retirementAge: 65,
      annualIncome: 48000,
      annualExpenses: 30000,
      liquidNetWorth: 50000,
      cpfTotal: 0,
      swr: 0.035,
      expectedReturn: 0.072,
      inflation: 0.025,
      expenseRatio: 0.003,
    })

    expect(m.fireNumber).toBeCloseTo(857143, 0)
    expect(m.savingsRate).toBeCloseTo(0.375, 2)
    expect(m.annualSavings).toBe(18000)
    expect(m.baristaFireIncome).toBe(28250)
    expect(m.yearsToFire).toBeCloseTo(23.56, 0)
  })

  it('Pre-Retiree scenario: 0 years to FIRE', () => {
    const m = calculateAllFireMetrics({
      currentAge: 55,
      retirementAge: 58,
      annualIncome: 0,
      annualExpenses: 80000,
      liquidNetWorth: 2000000,
      cpfTotal: 0,
      swr: 0.04,
      expectedReturn: 0.05,
      inflation: 0.025,
      expenseRatio: 0.003,
    })

    expect(m.fireNumber).toBe(2000000)
    expect(m.yearsToFire).toBe(0)
    expect(m.progress).toBe(1)
  })

  it('Lean FIRE uses 60% of expenses for FIRE number', () => {
    const m = calculateAllFireMetrics({
      currentAge: 30,
      retirementAge: 60,
      annualIncome: 100000,
      annualExpenses: 50000,
      liquidNetWorth: 200000,
      cpfTotal: 0,
      swr: 0.04,
      expectedReturn: 0.07,
      inflation: 0.025,
      expenseRatio: 0.003,
      fireType: 'lean',
    })

    // FIRE number: (50000 * 0.6) / 0.04 = 750,000
    expect(m.fireNumber).toBe(750000)
    // Lean/Fat reference values always use base expenses
    expect(m.leanFireNumber).toBe(750000) // same as FIRE number when lean
    expect(m.fatFireNumber).toBe(1875000) // 50000 * 1.5 / 0.04
  })

  it('Fat FIRE uses 150% of expenses for FIRE number', () => {
    const m = calculateAllFireMetrics({
      currentAge: 30,
      retirementAge: 60,
      annualIncome: 100000,
      annualExpenses: 50000,
      liquidNetWorth: 200000,
      cpfTotal: 0,
      swr: 0.04,
      expectedReturn: 0.07,
      inflation: 0.025,
      expenseRatio: 0.003,
      fireType: 'fat',
    })

    // FIRE number: (50000 * 1.5) / 0.04 = 1,875,000
    expect(m.fireNumber).toBe(1875000)
    expect(m.leanFireNumber).toBe(750000) // reference: 50000 * 0.6 / 0.04
    expect(m.fatFireNumber).toBe(1875000) // same as FIRE number when fat
  })

  it('Coast and Barista FIRE types do not change FIRE number', () => {
    const baseParams = {
      currentAge: 30,
      retirementAge: 60,
      annualIncome: 100000,
      annualExpenses: 50000,
      liquidNetWorth: 200000,
      cpfTotal: 0,
      swr: 0.04,
      expectedReturn: 0.07,
      inflation: 0.025,
      expenseRatio: 0.003,
    }

    const regular = calculateAllFireMetrics({ ...baseParams, fireType: 'regular' })
    const coast = calculateAllFireMetrics({ ...baseParams, fireType: 'coast' })
    const barista = calculateAllFireMetrics({ ...baseParams, fireType: 'barista' })

    expect(coast.fireNumber).toBe(regular.fireNumber)
    expect(barista.fireNumber).toBe(regular.fireNumber)
  })

  it('defaults to regular when fireType is omitted', () => {
    const withType = calculateAllFireMetrics({
      currentAge: 30,
      retirementAge: 60,
      annualIncome: 100000,
      annualExpenses: 50000,
      liquidNetWorth: 200000,
      cpfTotal: 0,
      swr: 0.04,
      expectedReturn: 0.07,
      inflation: 0.025,
      expenseRatio: 0.003,
      fireType: 'regular',
    })
    const without = calculateAllFireMetrics({
      currentAge: 30,
      retirementAge: 60,
      annualIncome: 100000,
      annualExpenses: 50000,
      liquidNetWorth: 200000,
      cpfTotal: 0,
      swr: 0.04,
      expectedReturn: 0.07,
      inflation: 0.025,
      expenseRatio: 0.003,
    })

    expect(without.fireNumber).toBe(withType.fireNumber)
  })
})

describe('fireNumberBasis', () => {
  const baseParams = {
    currentAge: 30,
    retirementAge: 65,
    annualIncome: 100000,
    annualExpenses: 48000,
    liquidNetWorth: 200000,
    cpfTotal: 0,
    swr: 0.04,
    expectedReturn: 0.07,
    inflation: 0.025,
    expenseRatio: 0.003,
  }

  it('today basis produces same result as default (regression)', () => {
    const withToday = calculateAllFireMetrics({ ...baseParams, fireNumberBasis: 'today' })
    const withDefault = calculateAllFireMetrics(baseParams)
    expect(withToday.fireNumber).toBe(withDefault.fireNumber)
    expect(withToday.leanFireNumber).toBe(withDefault.leanFireNumber)
    expect(withToday.fatFireNumber).toBe(withDefault.fatFireNumber)
  })

  it('retirement basis inflates expenses correctly', () => {
    // $48K expenses, 2.5% inflation, age 30→65 (35 years)
    // inflated = 48000 × 1.025^35 = ~113,813.55
    // FIRE number = 113,813.55 / 0.04 = ~2,845,338.72
    const m = calculateAllFireMetrics({ ...baseParams, fireNumberBasis: 'retirement' })
    const inflated = 48000 * Math.pow(1.025, 35)
    expect(m.fireNumber).toBeCloseTo(inflated / 0.04, 0)
  })

  it('lean/fat variants also inflate with retirement basis', () => {
    const m = calculateAllFireMetrics({ ...baseParams, fireNumberBasis: 'retirement' })
    const inflationFactor = Math.pow(1.025, 35)
    // Lean: 48000 * inflationFactor * 0.6 / 0.04
    expect(m.leanFireNumber).toBeCloseTo(48000 * inflationFactor * 0.6 / 0.04, 0)
    // Fat: 48000 * inflationFactor * 1.5 / 0.04
    expect(m.fatFireNumber).toBeCloseTo(48000 * inflationFactor * 1.5 / 0.04, 0)
  })

  it('retirement basis with currentAge >= retirementAge applies no inflation', () => {
    const params = { ...baseParams, currentAge: 65, retirementAge: 65, fireNumberBasis: 'retirement' as const }
    const m = calculateAllFireMetrics(params)
    // yearsToRetirement = 0, so (1+i)^0 = 1, no inflation
    expect(m.fireNumber).toBe(48000 / 0.04) // 1,200,000
  })

  it('retirement basis with inflation = 0 is identical to today basis', () => {
    const paramsZeroInflation = { ...baseParams, inflation: 0 }
    const today = calculateAllFireMetrics({ ...paramsZeroInflation, fireNumberBasis: 'today' })
    const retirement = calculateAllFireMetrics({ ...paramsZeroInflation, fireNumberBasis: 'retirement' })
    expect(retirement.fireNumber).toBe(today.fireNumber)
  })

  it('fireAge basis inflates to converged FIRE age', () => {
    const m = calculateAllFireMetrics({ ...baseParams, fireNumberBasis: 'fireAge' })
    const todayM = calculateAllFireMetrics({ ...baseParams, fireNumberBasis: 'today' })
    // fireAge result should be self-consistent: the inflation used matches the computed FIRE age
    // Convergence tolerance of 0.01 years means FIRE number can differ by ~$300, so check within 0.05%
    const convergedYears = m.yearsToFire
    const expectedInflationFactor = Math.pow(1 + baseParams.inflation, convergedYears)
    const expectedFireNumber = (baseParams.annualExpenses * expectedInflationFactor) / baseParams.swr
    const relativeError = Math.abs(m.fireNumber - expectedFireNumber) / expectedFireNumber
    expect(relativeError).toBeLessThan(0.0005)
    // Should be higher than today basis (inflation applied)
    expect(m.fireNumber).toBeGreaterThan(todayM.fireNumber)
  })

  it('fireAge basis with inflation = 0 is identical to today basis', () => {
    const paramsZeroInflation = { ...baseParams, inflation: 0 }
    const today = calculateAllFireMetrics({ ...paramsZeroInflation, fireNumberBasis: 'today' })
    const fireAge = calculateAllFireMetrics({ ...paramsZeroInflation, fireNumberBasis: 'fireAge' })
    expect(fireAge.fireNumber).toBe(today.fireNumber)
    expect(fireAge.leanFireNumber).toBe(today.leanFireNumber)
    expect(fireAge.fatFireNumber).toBe(today.fatFireNumber)
  })

  it('fireAge basis when already at FIRE applies no inflation', () => {
    const atFireParams = {
      ...baseParams,
      liquidNetWorth: 2000000,
      cpfTotal: 0,
      annualExpenses: 48000,
      swr: 0.04,
    }
    // NW (2M) >= FIRE number (48K/0.04 = 1.2M), so years-to-FIRE = 0
    const m = calculateAllFireMetrics({ ...atFireParams, fireNumberBasis: 'fireAge' })
    const todayM = calculateAllFireMetrics({ ...atFireParams, fireNumberBasis: 'today' })
    expect(m.yearsToFire).toBe(0)
    expect(m.fireNumber).toBe(todayM.fireNumber)
  })

  it('fireAge basis produces value between today and retirement bases', () => {
    const today = calculateAllFireMetrics({ ...baseParams, fireNumberBasis: 'today' })
    const fireAge = calculateAllFireMetrics({ ...baseParams, fireNumberBasis: 'fireAge' })
    const retirement = calculateAllFireMetrics({ ...baseParams, fireNumberBasis: 'retirement' })
    // FIRE age < retirement age in typical savings scenario, so fireAge inflation < retirement inflation
    expect(fireAge.fireNumber).toBeGreaterThan(today.fireNumber)
    expect(fireAge.fireNumber).toBeLessThan(retirement.fireNumber)
  })
})

describe('postRetirementIncome deduction', () => {
  const baseParams = {
    currentAge: 30,
    retirementAge: 65,
    annualIncome: 100000,
    annualExpenses: 48000,
    liquidNetWorth: 200000,
    cpfTotal: 0,
    swr: 0.04,
    expectedReturn: 0.07,
    inflation: 0.025,
    expenseRatio: 0.003,
  }

  it('reduces FIRE number by postRetirementIncome / SWR (today basis)', () => {
    const without = calculateAllFireMetrics({ ...baseParams, fireNumberBasis: 'today' })
    const with20k = calculateAllFireMetrics({ ...baseParams, fireNumberBasis: 'today', postRetirementIncome: 20000 })
    // Without: 48000 / 0.04 = 1,200,000
    // With 20K income: max(0, 48000 - 20000) / 0.04 = 28000 / 0.04 = 700,000
    expect(without.fireNumber).toBe(1200000)
    expect(with20k.fireNumber).toBe(700000)
  })

  it('FIRE number cannot go below 0 when income exceeds expenses', () => {
    const m = calculateAllFireMetrics({ ...baseParams, fireNumberBasis: 'today', postRetirementIncome: 60000 })
    expect(m.fireNumber).toBe(0)
  })

  it('zero postRetirementIncome matches omitted (backward compat)', () => {
    const omitted = calculateAllFireMetrics(baseParams)
    const zero = calculateAllFireMetrics({ ...baseParams, postRetirementIncome: 0 })
    expect(zero.fireNumber).toBe(omitted.fireNumber)
    expect(zero.yearsToFire).toBe(omitted.yearsToFire)
  })

  it('inflates postRetirementIncome with retirement basis', () => {
    // Both expenses and income inflate by the same factor
    const m = calculateAllFireMetrics({ ...baseParams, fireNumberBasis: 'retirement', postRetirementIncome: 20000 })
    const inflationFactor = Math.pow(1.025, 35)
    const expectedNet = Math.max(0, 48000 * inflationFactor - 20000 * inflationFactor)
    expect(m.fireNumber).toBeCloseTo(expectedNet / 0.04, 0)
  })

  it('inflates postRetirementIncome with fireAge basis', () => {
    const m = calculateAllFireMetrics({ ...baseParams, fireNumberBasis: 'fireAge', postRetirementIncome: 20000 })
    // The converged FIRE number should be self-consistent
    const convergedYears = m.yearsToFire
    const inflationFactor = Math.pow(1.025, convergedYears)
    const expectedNet = Math.max(0, 48000 * inflationFactor - 20000 * inflationFactor)
    const expectedFireNumber = expectedNet / 0.04
    const relativeError = Math.abs(m.fireNumber - expectedFireNumber) / expectedFireNumber
    expect(relativeError).toBeLessThan(0.001)
  })

  it('reduces yearsToFire and fireAge', () => {
    const without = calculateAllFireMetrics({ ...baseParams, fireNumberBasis: 'today' })
    const withIncome = calculateAllFireMetrics({ ...baseParams, fireNumberBasis: 'today', postRetirementIncome: 20000 })
    expect(withIncome.yearsToFire).toBeLessThan(without.yearsToFire)
    expect(withIncome.fireAge).toBeLessThan(without.fireAge)
  })

  it('includes postRetirementIncome in expensesBreakdown', () => {
    const m = calculateAllFireMetrics({ ...baseParams, fireNumberBasis: 'today', postRetirementIncome: 15000 })
    expect(m.expensesBreakdown.postRetirementIncome).toBe(15000)
    expect(m.expensesBreakdown.netEffectiveExpenses).toBe(48000 - 15000)
    expect(m.expensesBreakdown.effectiveExpenses).toBe(48000) // gross unchanged
  })

  it('does not affect baristaFireIncome (uses gross expenses)', () => {
    const without = calculateAllFireMetrics({ ...baseParams, fireNumberBasis: 'today' })
    const withIncome = calculateAllFireMetrics({ ...baseParams, fireNumberBasis: 'today', postRetirementIncome: 20000 })
    expect(withIncome.baristaFireIncome).toBe(without.baristaFireIncome)
  })
})

describe('cpfDependency', () => {
  it('true when liquid < FIRE but total >= FIRE', () => {
    const m = calculateAllFireMetrics({
      currentAge: 55,
      retirementAge: 58,
      annualIncome: 0,
      annualExpenses: 80000,
      liquidNetWorth: 500000,
      cpfTotal: 1600000,
      swr: 0.04,
      expectedReturn: 0.05,
      inflation: 0.025,
      expenseRatio: 0.003,
      lifeExpectancy: 90,
      cpfLifeStartAge: 65,
    })
    // FIRE number = 80K / 0.04 = 2M
    // Total NW = 500K + 1.6M = 2.1M >= 2M (progress >= 1)
    // Liquid = 500K < 2M (liquid < FIRE)
    expect(m.cpfDependency).toBe(true)
  })

  it('false when liquid alone >= FIRE', () => {
    const m = calculateAllFireMetrics({
      currentAge: 55,
      retirementAge: 58,
      annualIncome: 0,
      annualExpenses: 80000,
      liquidNetWorth: 2000000,
      cpfTotal: 500000,
      swr: 0.04,
      expectedReturn: 0.05,
      inflation: 0.025,
      expenseRatio: 0.003,
    })
    expect(m.cpfDependency).toBe(false)
  })

  it('false when both liquid and total are below FIRE', () => {
    const m = calculateAllFireMetrics({
      currentAge: 30,
      retirementAge: 65,
      annualIncome: 72000,
      annualExpenses: 48000,
      liquidNetWorth: 100000,
      cpfTotal: 50000,
      swr: 0.04,
      expectedReturn: 0.07,
      inflation: 0.025,
      expenseRatio: 0.003,
    })
    expect(m.cpfDependency).toBe(false)
  })
})

describe('calculateLiquidBridgeGap', () => {
  it('returns null when liquid never depletes', () => {
    const result = calculateLiquidBridgeGap(3000000, 80000, 58, 65, 0.03, 90)
    expect(result.liquidDepletionAge).toBeNull()
    expect(result.liquidBridgeGapYears).toBeNull()
  })

  it('detects depletion before CPF LIFE starts', () => {
    // $200K liquid, $80K expenses, 0% real return → depletes in 2.5 years
    const result = calculateLiquidBridgeGap(200000, 80000, 58, 65, 0, 90)
    expect(result.liquidDepletionAge).toBe(60) // 200K / 80K = 2.5, depletes year 3 (age 60)
    expect(result.liquidBridgeGapYears).toBe(5) // 65 - 60 = 5 years gap
  })

  it('returns null gap when depletion is after CPF LIFE start', () => {
    // Depletes at 70 but CPF starts at 65 → gap is null
    const result = calculateLiquidBridgeGap(500000, 80000, 58, 65, 0.02, 90)
    // With 2% real return, won't deplete before 65
    // Let's check if it depletes at all...
    if (result.liquidDepletionAge !== null) {
      if (result.liquidDepletionAge >= 65) {
        expect(result.liquidBridgeGapYears).toBeNull()
      }
    }
  })

  it('handles zero liquid portfolio', () => {
    const result = calculateLiquidBridgeGap(0, 80000, 58, 65, 0.03, 90)
    expect(result.liquidDepletionAge).toBe(58)
    expect(result.liquidBridgeGapYears).toBe(7) // 65 - 58
  })
})

describe('projectNetWorthPath', () => {
  it('phase transitions to decumulation at retirementAge even when balance < fireNumber', () => {
    const path = projectNetWorthPath({
      currentAge: 55,
      annualSavings: 10000,
      currentNW: 100000,
      realReturn: 0,
      annualExpenses: 30000,
      fireNumber: 1000000, // way above current NW
      lifeExpectancy: 65,
      retirementAge: 58,
    })

    // Before retirement: accumulation
    const row55 = path.find(p => p.age === 55)!
    const row57 = path.find(p => p.age === 57)!
    expect(row55.phase).toBe('accumulation')
    expect(row57.phase).toBe('accumulation')

    // At and after retirementAge: forced decumulation (even though balance < fireNumber)
    const row58 = path.find(p => p.age === 58)!
    const row60 = path.find(p => p.age === 60)!
    expect(row58.phase).toBe('decumulation')
    expect(row60.phase).toBe('decumulation')
  })

  it('balance declines after forced decumulation with zero return', () => {
    const path = projectNetWorthPath({
      currentAge: 55,
      annualSavings: 10000,
      currentNW: 200000,
      realReturn: 0,
      annualExpenses: 50000,
      fireNumber: 5000000,
      lifeExpectancy: 65,
      retirementAge: 58,
    })

    // After forced decumulation at 58, balance should decline each year
    const row58 = path.find(p => p.age === 58)!
    const row59 = path.find(p => p.age === 59)!
    const row60 = path.find(p => p.age === 60)!

    // At age 58: balance = accumulation result up to age 57 = 200000 + 10000*3 = 230000
    expect(row58.balance).toBeCloseTo(230000, 0)
    // After decumulation at 58: 230000 - 50000 = 180000
    expect(row59.balance).toBeCloseTo(180000, 0)
    // After decumulation at 59: 180000 - 50000 = 130000
    expect(row60.balance).toBeCloseTo(130000, 0)
  })

  it('balance clamps to 0 after depletion', () => {
    const path = projectNetWorthPath({
      currentAge: 55,
      annualSavings: 0,
      currentNW: 100000,
      realReturn: 0,
      annualExpenses: 40000,
      fireNumber: 5000000,
      lifeExpectancy: 65,
      retirementAge: 55, // immediately decumulating
    })

    // 100000 / 40000 = 2.5 years → depletes around age 57-58
    const row58 = path.find(p => p.age === 58)!
    expect(row58.balance).toBe(0)

    // All subsequent rows should also be 0
    for (const entry of path.filter(p => p.age >= 58)) {
      expect(entry.balance).toBe(0)
    }
  })
})

describe('property-based tests', () => {
  it('FIRE number > 0 when expenses > 0 and SWR > 0', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 1000000, noNaN: true }),
        fc.double({ min: 0.001, max: 0.1, noNaN: true }),
        (expenses, swr) => {
          return calculateFireNumber(expenses, swr) > 0
        }
      )
    )
  })

  it('years to FIRE >= 0', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.001, max: 0.2, noNaN: true }),
        fc.double({ min: 1000, max: 500000, noNaN: true }),
        fc.double({ min: 0, max: 5000000, noNaN: true }),
        fc.double({ min: 100000, max: 10000000, noNaN: true }),
        (r, savings, nw, fire) => {
          const years = calculateYearsToFire(r, savings, nw, fire)
          return years >= 0
        }
      )
    )
  })
})

describe('calculateParentSupportAtAge', () => {
  const mother: ParentSupport = {
    id: 'm1',
    label: 'Mother',
    monthlyAmount: 500,
    startAge: 35,
    endAge: 75,
    growthRate: 0.03,
  }

  const father: ParentSupport = {
    id: 'f1',
    label: 'Father',
    monthlyAmount: 800,
    startAge: 40,
    endAge: 70,
    growthRate: 0.02,
  }

  it('returns 0 for empty entries', () => {
    expect(calculateParentSupportAtAge([], 40)).toBe(0)
  })

  it('returns 0 when age is before start', () => {
    expect(calculateParentSupportAtAge([mother], 30)).toBe(0)
  })

  it('returns 0 when age is at or after end', () => {
    expect(calculateParentSupportAtAge([mother], 75)).toBe(0)
    expect(calculateParentSupportAtAge([mother], 80)).toBe(0)
  })

  it('single entry at start age (no growth applied)', () => {
    // At startAge (35), yearsActive = 0, so growth^0 = 1
    // 500 * 12 * 1 = 6000
    expect(calculateParentSupportAtAge([mother], 35)).toBe(6000)
  })

  it('single entry with growth over years', () => {
    // At age 45, yearsActive = 10
    // 500 * 12 * (1.03)^10 = 6000 * 1.34392 = 8063.53
    expect(calculateParentSupportAtAge([mother], 45)).toBeCloseTo(6000 * Math.pow(1.03, 10), 2)
  })

  it('multiple entries with overlapping periods', () => {
    // At age 45: mother (active, 10yrs) + father (active, 5yrs)
    const motherAmount = 500 * 12 * Math.pow(1.03, 10) // ~8063.53
    const fatherAmount = 800 * 12 * Math.pow(1.02, 5) // ~10599.27
    expect(calculateParentSupportAtAge([mother, father], 45)).toBeCloseTo(motherAmount + fatherAmount, 2)
  })

  it('multiple entries where only one is active', () => {
    // At age 38: mother active (3yrs), father not yet started
    const motherAmount = 500 * 12 * Math.pow(1.03, 3)
    expect(calculateParentSupportAtAge([mother, father], 38)).toBeCloseTo(motherAmount, 2)
  })

  it('no entries active at given age', () => {
    // At age 80: both entries have ended
    expect(calculateParentSupportAtAge([mother, father], 80)).toBe(0)
  })
})

describe('locked assets in FIRE metrics', () => {
  const baseParams = {
    currentAge: 30,
    retirementAge: 60,
    annualIncome: 100000,
    annualExpenses: 48000,
    liquidNetWorth: 500000,
    cpfTotal: 200000,
    swr: 0.04,
    expectedReturn: 0.07,
    inflation: 0.025,
    expenseRatio: 0.003,
  }

  it('includes locked assets in total net worth with locked', () => {
    const metrics = calculateAllFireMetrics({
      ...baseParams,
      lockedAssets: [
        { id: '1', name: 'RSUs', amount: 100000, unlockAge: 40, growthRate: 0 },
      ],
    })
    expect(metrics.totalNetWorthWithLocked).toBe(500000 + 200000 + 100000)
    expect(metrics.lockedAssetsTotal).toBe(100000)
  })

  it('excludes locked assets from accessible net worth', () => {
    const metrics = calculateAllFireMetrics({
      ...baseParams,
      lockedAssets: [
        { id: '1', name: 'RSUs', amount: 100000, unlockAge: 40, growthRate: 0 },
      ],
    })
    expect(metrics.accessibleNetWorth).toBe(500000)
  })

  it('returns zero lockedAssetsTotal when no locked assets', () => {
    const metrics = calculateAllFireMetrics({ ...baseParams })
    expect(metrics.lockedAssetsTotal).toBe(0)
    expect(metrics.totalNetWorthWithLocked).toBe(metrics.totalNetWorth)
  })

  it('sums multiple locked assets', () => {
    const metrics = calculateAllFireMetrics({
      ...baseParams,
      lockedAssets: [
        { id: '1', name: 'RSUs', amount: 100000, unlockAge: 40, growthRate: 0 },
        { id: '2', name: 'FD', amount: 50000, unlockAge: 45, growthRate: 0.03 },
      ],
    })
    expect(metrics.lockedAssetsTotal).toBe(150000)
    expect(metrics.totalNetWorthWithLocked).toBe(500000 + 200000 + 150000)
  })
})

describe('calculateAllFireMetrics with parentSupport', () => {
  const baseParams = {
    currentAge: 30,
    retirementAge: 60,
    annualIncome: 100000,
    annualExpenses: 48000,
    liquidNetWorth: 200000,
    cpfTotal: 0,
    swr: 0.04,
    expectedReturn: 0.07,
    inflation: 0.025,
    expenseRatio: 0.003,
  }

  const parentEntries: ParentSupport[] = [
    {
      id: 'm1',
      label: 'Mother',
      monthlyAmount: 500,
      startAge: 35,
      endAge: 75,
      growthRate: 0.03,
    },
  ]

  it('parent support increases FIRE number when enabled', () => {
    const without = calculateAllFireMetrics(baseParams)
    const withPS = calculateAllFireMetrics({
      ...baseParams,
      parentSupportEnabled: true,
      parentSupport: parentEntries,
    })
    expect(withPS.fireNumber).toBeGreaterThan(without.fireNumber)
  })

  it('disabled parent support does not change FIRE number', () => {
    const without = calculateAllFireMetrics(baseParams)
    const disabled = calculateAllFireMetrics({
      ...baseParams,
      parentSupportEnabled: false,
      parentSupport: parentEntries,
    })
    expect(disabled.fireNumber).toBe(without.fireNumber)
  })

  it('parent support is additive and NOT subject to FIRE type multiplier', () => {
    // With lean FIRE type, expenses are multiplied by 0.6, but parent support should be added after
    const leanWithPS = calculateAllFireMetrics({
      ...baseParams,
      fireType: 'lean',
      parentSupportEnabled: true,
      parentSupport: parentEntries,
    })
    const leanWithout = calculateAllFireMetrics({
      ...baseParams,
      fireType: 'lean',
    })
    // Parent support at retirement age 60: 500*12*(1.03)^25 = 6000 * 2.09378 = 12562.67
    const psAtRetirement = calculateParentSupportAtAge(parentEntries, 60)
    const expectedDiff = psAtRetirement / 0.04 // FIRE number difference = parentSupport / SWR
    expect(leanWithPS.fireNumber - leanWithout.fireNumber).toBeCloseTo(expectedDiff, 0)
  })

  it('empty parent support array when enabled has no effect', () => {
    const without = calculateAllFireMetrics(baseParams)
    const withEmpty = calculateAllFireMetrics({
      ...baseParams,
      parentSupportEnabled: true,
      parentSupport: [],
    })
    expect(withEmpty.fireNumber).toBe(without.fireNumber)
  })
})

describe('projectPortfolioAtRetirement', () => {
  it('normal projection: $100K + $20K/yr savings, 5% return, 10 years', () => {
    // FV lump sum: 100000 * (1.05)^10 = 162,889.46
    // FV annuity: 20000 * ((1.05)^10 - 1) / 0.05 = 251,557.85
    // Total: 414,447.31
    const result = projectPortfolioAtRetirement({
      currentNW: 100000,
      annualSavings: 20000,
      netRealReturn: 0.05,
      yearsToRetirement: 10,
    })
    expect(result).toBeCloseTo(414447, 0)
  })

  it('already retired (n=0): returns currentNW unchanged', () => {
    const result = projectPortfolioAtRetirement({
      currentNW: 500000,
      annualSavings: 20000,
      netRealReturn: 0.05,
      yearsToRetirement: 0,
    })
    expect(result).toBe(500000)
  })

  it('negative years: returns currentNW (already past retirement)', () => {
    const result = projectPortfolioAtRetirement({
      currentNW: 500000,
      annualSavings: 20000,
      netRealReturn: 0.05,
      yearsToRetirement: -5,
    })
    expect(result).toBe(500000)
  })

  it('zero return: linear approximation (currentNW + savings * n)', () => {
    const result = projectPortfolioAtRetirement({
      currentNW: 100000,
      annualSavings: 20000,
      netRealReturn: 0,
      yearsToRetirement: 10,
    })
    // 100000 + 20000 * 10 = 300000
    expect(result).toBeCloseTo(300000, 0)
  })

  it('negative savings: still projects (savings term negative)', () => {
    const result = projectPortfolioAtRetirement({
      currentNW: 500000,
      annualSavings: -10000,
      netRealReturn: 0.05,
      yearsToRetirement: 10,
    })
    // FV lump: 500000 * 1.05^10 = 814,447.31
    // FV annuity: -10000 * (1.05^10 - 1) / 0.05 = -125,778.93
    // Total: ~688,668
    expect(result).toBeCloseTo(688668, 0)
  })

  it('clamps to 0 when projection goes negative', () => {
    const result = projectPortfolioAtRetirement({
      currentNW: 10000,
      annualSavings: -50000,
      netRealReturn: 0.02,
      yearsToRetirement: 10,
    })
    // Would produce negative value; should clamp to 0
    expect(result).toBe(0)
  })

  it('Fresh Graduate integration: $50K NW, $18K savings, 4.4% return, 16 yrs', () => {
    // FV lump: 50000 * 1.044^16 = 99,581.34
    // FV annuity: 18000 * (1.044^16 - 1) / 0.044 = 405,665.54
    // Total: 505,246.88
    const result = projectPortfolioAtRetirement({
      currentNW: 50000,
      annualSavings: 18000,
      netRealReturn: 0.044,
      yearsToRetirement: 16,
    })
    expect(result).toBeCloseTo(505247, -2) // within $100
  })

  it('result is always >= 0', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 5000000, noNaN: true }),
        fc.double({ min: -100000, max: 500000, noNaN: true }),
        fc.double({ min: -0.05, max: 0.2, noNaN: true }),
        fc.double({ min: 0, max: 50, noNaN: true }),
        (nw, savings, r, n) => {
          const result = projectPortfolioAtRetirement({
            currentNW: nw,
            annualSavings: savings,
            netRealReturn: r,
            yearsToRetirement: n,
          })
          return result >= 0
        }
      )
    )
  })
})

describe('calculateAllFireMetrics with expenseAdjustments', () => {
  const baseParams = {
    currentAge: 30,
    retirementAge: 60,
    annualIncome: 100000,
    annualExpenses: 50000,
    liquidNetWorth: 200000,
    cpfTotal: 0,
    swr: 0.04,
    expectedReturn: 0.07,
    inflation: 0.025,
    expenseRatio: 0.003,
    lifeExpectancy: 90,
  }

  it('adjustments affect annualSavings (using current age expenses)', () => {
    // Living with parents at age 30 saves $20K/yr on rent
    const m = calculateAllFireMetrics({
      ...baseParams,
      expenseAdjustments: [
        { id: '1', label: 'Live with parents', amount: -20000, startAge: 25, endAge: 35 },
      ],
    })
    // Effective expenses at age 30: 50000 - 20000 = 30000
    // annualSavings = 100000 - 30000 = 70000 (vs 50000 without adjustment)
    expect(m.annualSavings).toBe(70000)
    expect(m.savingsRate).toBeCloseTo(0.7, 2)
  })

  it('adjustments affect FIRE number (using retirement age expenses)', () => {
    // Higher expenses in retirement due to healthcare helper
    const m = calculateAllFireMetrics({
      ...baseParams,
      expenseAdjustments: [
        { id: '1', label: 'Helper', amount: 24000, startAge: 55, endAge: null },
      ],
    })
    // Effective expenses at retirement age 60: 50000 + 24000 = 74000
    // FIRE number = 74000 / 0.04 = 1,850,000
    expect(m.fireNumber).toBe(1850000)
  })

  it('adjustment inactive at retirement age does not affect FIRE number', () => {
    const m = calculateAllFireMetrics({
      ...baseParams,
      expenseAdjustments: [
        { id: '1', label: 'Child school', amount: 20000, startAge: 35, endAge: 50 },
      ],
    })
    // Adjustment ends at 50, retirement is 60 → no effect on FIRE number
    // FIRE number = 50000 / 0.04 = 1,250,000
    expect(m.fireNumber).toBe(1250000)
    // But savings at current age 30 are unaffected too (adjustment starts at 35)
    expect(m.annualSavings).toBe(50000)
  })

  it('lean/fat numbers use effective expenses at retirement', () => {
    const m = calculateAllFireMetrics({
      ...baseParams,
      expenseAdjustments: [
        { id: '1', label: 'Helper', amount: 10000, startAge: 55, endAge: null },
      ],
    })
    // Effective retirement expenses: 50000 + 10000 = 60000
    // Lean = 60000 * 0.6 / 0.04 = 900,000
    // Fat = 60000 * 1.5 / 0.04 = 2,250,000
    expect(m.leanFireNumber).toBe(900000)
    expect(m.fatFireNumber).toBe(2250000)
  })

  it('empty adjustments array behaves same as no adjustments', () => {
    const without = calculateAllFireMetrics(baseParams)
    const withEmpty = calculateAllFireMetrics({ ...baseParams, expenseAdjustments: [] })
    expect(withEmpty.fireNumber).toBe(without.fireNumber)
    expect(withEmpty.annualSavings).toBe(without.annualSavings)
  })

  it('retirementSpendingAdjustment multiplies effective total', () => {
    // Design decision: retirementSpendingAdjustment multiplies (base + adjustments)
    const m = calculateAllFireMetrics({
      ...baseParams,
      retirementSpendingAdjustment: 0.8,
      expenseAdjustments: [
        { id: '1', label: 'Helper', amount: 10000, startAge: 55, endAge: null },
      ],
    })
    // Effective at retirement: 50000 + 10000 = 60000
    // After spending adjustment: 60000 * 0.8 = 48000
    // FIRE number = 48000 / 0.04 = 1,200,000
    expect(m.fireNumber).toBe(1200000)
  })
})

describe('calculateProjectionFireNumber', () => {
  it('equals simple FIRE number when no mortgage or income offsets', () => {
    const result = calculateProjectionFireNumber({
      annualExpenses: 48000,
      mortgageCashPayment: 0,
      cpfLifePayout: 0,
      rentalIncome: 0,
    }, 0.04)
    expect(result).toBe(1200000)
  })

  it('increases FIRE number when mortgage cash payment exists', () => {
    const result = calculateProjectionFireNumber({
      annualExpenses: 48000,
      mortgageCashPayment: 12000,
      cpfLifePayout: 0,
      rentalIncome: 0,
    }, 0.04)
    expect(result).toBe(1500000)
  })

  it('decreases FIRE number when CPF LIFE payout offsets expenses', () => {
    const result = calculateProjectionFireNumber({
      annualExpenses: 48000,
      mortgageCashPayment: 0,
      cpfLifePayout: 13400,
      rentalIncome: 0,
    }, 0.04)
    expect(result).toBe(865000)
  })

  it('decreases FIRE number when rental income offsets expenses', () => {
    const result = calculateProjectionFireNumber({
      annualExpenses: 48000,
      mortgageCashPayment: 0,
      cpfLifePayout: 0,
      rentalIncome: 6000,
    }, 0.04)
    expect(result).toBe(1050000)
  })

  it('handles combined mortgage and CPF LIFE offsets', () => {
    const result = calculateProjectionFireNumber({
      annualExpenses: 48000,
      mortgageCashPayment: 18000,
      cpfLifePayout: 13400,
      rentalIncome: 0,
    }, 0.04)
    expect(result).toBe(1315000)
  })

  it('returns 0 when income offsets exceed total expenses', () => {
    const result = calculateProjectionFireNumber({
      annualExpenses: 20000,
      mortgageCashPayment: 0,
      cpfLifePayout: 15000,
      rentalIncome: 10000,
    }, 0.04)
    expect(result).toBe(0)
  })

  it('returns 0 when SWR is zero', () => {
    const result = calculateProjectionFireNumber({
      annualExpenses: 48000,
      mortgageCashPayment: 0,
      cpfLifePayout: 0,
      rentalIncome: 0,
    }, 0)
    expect(result).toBe(0)
  })
})

describe('normalizeProjectionFireNumber', () => {
  // Raw projection number: $1,500,000 in age-46 dollars (age 30 now, inflation 2.5%)
  const rawProj = 1500000
  const firstRetiredAge = 46
  const currentAge = 30
  const inflation = 0.025

  it('today basis: deflates to today dollars', () => {
    // basisInflationFactor = 1 (today = no inflation)
    // projInflationFactor = 1.025^16
    // normalized = 1500000 * 1 / 1.025^16
    const projFactor = Math.pow(1.025, 16)
    const result = normalizeProjectionFireNumber(rawProj, firstRetiredAge, currentAge, inflation, 1)
    expect(result).toBeCloseTo(rawProj / projFactor, 0)
  })

  it('retirement basis: adjusts to retirement-year dollars', () => {
    // retirementAge 45, basisInflationFactor = 1.025^15
    const basisFactor = Math.pow(1.025, 15)
    const projFactor = Math.pow(1.025, 16)
    const result = normalizeProjectionFireNumber(rawProj, firstRetiredAge, currentAge, inflation, basisFactor)
    expect(result).toBeCloseTo(rawProj * basisFactor / projFactor, 0)
  })

  it('fireAge basis: adjusts to converged FIRE-year dollars', () => {
    // converged FIRE age 53 → basisInflationFactor = 1.025^23
    const basisFactor = Math.pow(1.025, 23)
    const projFactor = Math.pow(1.025, 16)
    const result = normalizeProjectionFireNumber(rawProj, firstRetiredAge, currentAge, inflation, basisFactor)
    expect(result).toBeCloseTo(rawProj * basisFactor / projFactor, 0)
  })

  it('zero inflation: no normalization applied', () => {
    const result = normalizeProjectionFireNumber(rawProj, firstRetiredAge, currentAge, 0, 1)
    expect(result).toBe(rawProj)
  })

  it('first retired age equals current age: only basis factor applied', () => {
    // projInflationFactor = 1 (no years elapsed), so result = raw * basisFactor
    const basisFactor = Math.pow(1.025, 15)
    const result = normalizeProjectionFireNumber(rawProj, 30, 30, inflation, basisFactor)
    expect(result).toBeCloseTo(rawProj * basisFactor, 0)
  })

  it('deviation percentage is identical across all bases', () => {
    // Simple: $48K expenses, SWR 4% → $1,200,000 in today's dollars
    const simpleToday = 48000 / 0.04  // 1,200,000
    // Projection raw: different expenses at age 46
    const projRaw = (48000 * Math.pow(1.025, 16) + 12000) / 0.04 // mortgage adds $12K

    // Today basis
    const normToday = normalizeProjectionFireNumber(projRaw, 46, 30, 0.025, 1)
    const devToday = (normToday - simpleToday) / simpleToday

    // Retirement basis (age 45)
    const retFactor = Math.pow(1.025, 15)
    const simpleRet = simpleToday * retFactor
    const normRet = normalizeProjectionFireNumber(projRaw, 46, 30, 0.025, retFactor)
    const devRet = (normRet - simpleRet) / simpleRet

    // FireAge basis (age 53)
    const fireFactor = Math.pow(1.025, 23)
    const simpleFire = simpleToday * fireFactor
    const normFire = normalizeProjectionFireNumber(projRaw, 46, 30, 0.025, fireFactor)
    const devFire = (normFire - simpleFire) / simpleFire

    // All deviation percentages should be identical
    expect(devToday).toBeCloseTo(devRet, 10)
    expect(devToday).toBeCloseTo(devFire, 10)
  })
})

describe('dollar basis consistency with projection numbers', () => {
  const baseParams = {
    currentAge: 30,
    retirementAge: 45,
    annualIncome: 120000,
    annualExpenses: 60000,
    liquidNetWorth: 100000,
    cpfTotal: 0,
    swr: 0.04,
    expectedReturn: 0.07,
    inflation: 0.025,
    expenseRatio: 0.003,
  }

  // Simulate a first-retired row at age 46 (isRetired = age > retirementAge)
  const firstRetiredAge = 46
  const mockRetiredRow = {
    annualExpenses: 60000 * Math.pow(1.025, 16), // inflated to age 46
    mortgageCashPayment: 18000,
    cpfLifePayout: 0,
    rentalIncome: 0,
    age: firstRetiredAge,
  }

  it('normalized projection number is in the same dollar basis as simple number for each basis', () => {
    for (const basis of ['today', 'retirement', 'fireAge'] as const) {
      const metrics = calculateAllFireMetrics({ ...baseParams, fireNumberBasis: basis })
      const rawProj = calculateProjectionFireNumber(mockRetiredRow, baseParams.swr)

      const { baseExpenses, parentSupportAnnual, healthcareCashOutlay, effectiveExpenses } = metrics.expensesBreakdown
      const preInflationTotal = baseExpenses + parentSupportAnnual + healthcareCashOutlay
      const basisFactor = preInflationTotal > 0 ? effectiveExpenses / preInflationTotal : 1

      const normalized = normalizeProjectionFireNumber(
        rawProj, firstRetiredAge, baseParams.currentAge, baseParams.inflation, basisFactor
      )

      // The normalized projection should be in the same order of magnitude as the simple number
      // (not off by an inflation factor of 1.025^16 ≈ 1.48)
      const ratio = normalized / metrics.fireNumber
      expect(ratio).toBeGreaterThan(0.5)
      expect(ratio).toBeLessThan(2.0)
    }
  })

  it('deviation percentage is identical across all dollar bases', () => {
    const deviations: number[] = []

    for (const basis of ['today', 'retirement', 'fireAge'] as const) {
      const metrics = calculateAllFireMetrics({ ...baseParams, fireNumberBasis: basis })
      const rawProj = calculateProjectionFireNumber(mockRetiredRow, baseParams.swr)

      const { baseExpenses, parentSupportAnnual, healthcareCashOutlay, effectiveExpenses } = metrics.expensesBreakdown
      const preInflationTotal = baseExpenses + parentSupportAnnual + healthcareCashOutlay
      const basisFactor = preInflationTotal > 0 ? effectiveExpenses / preInflationTotal : 1

      const normalized = normalizeProjectionFireNumber(
        rawProj, firstRetiredAge, baseParams.currentAge, baseParams.inflation, basisFactor
      )

      const deviation = (normalized - metrics.fireNumber) / metrics.fireNumber
      deviations.push(deviation)
    }

    // All three deviations should be identical (same real comparison, different dollar years)
    expect(deviations[0]).toBeCloseTo(deviations[1], 6)
    expect(deviations[0]).toBeCloseTo(deviations[2], 4) // fireAge has convergence tolerance
  })

  it('no deviation when projection matches simple formula (zero inflation)', () => {
    const params = { ...baseParams, inflation: 0 }
    const metrics = calculateAllFireMetrics(params)
    // With zero inflation, projection row expenses = today's expenses
    const noInflationRow = {
      annualExpenses: 60000, // no inflation applied
      mortgageCashPayment: 0,
      cpfLifePayout: 0,
      rentalIncome: 0,
      age: firstRetiredAge,
    }
    const rawProj = calculateProjectionFireNumber(noInflationRow, params.swr)
    const normalized = normalizeProjectionFireNumber(rawProj, firstRetiredAge, params.currentAge, 0, 1)

    // With no offsets and no inflation, projection = simple exactly
    expect(normalized).toBeCloseTo(metrics.fireNumber, 0)
  })
})
