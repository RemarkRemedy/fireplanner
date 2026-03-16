import { describe, it, expect } from 'vitest'
import {
  computeHealthRatios,
  computeRatioValue,
  classifyRatio,
  type HealthRatioInputs,
} from './healthCheck'

const freshGraduate: HealthRatioInputs = {
  cashSavings: 5_000,
  grossMonthlyIncome: 4_000,
  netMonthlyIncome: 3_200,
  monthlyExpenses: 2_500,
  totalMonthlyDebtPayments: 0,
  nonMortgageDebtMonthlyPayment: 0,
  totalDebt: 0,
  totalAssets: 10_000,
  netWorth: 10_000,
  investedAssets: 5_000,
}

const midCareerWithMortgage: HealthRatioInputs = {
  cashSavings: 30_000,
  grossMonthlyIncome: 10_000,
  netMonthlyIncome: 7_500,
  monthlyExpenses: 5_000,
  totalMonthlyDebtPayments: 3_500,
  nonMortgageDebtMonthlyPayment: 1_000,
  totalDebt: 600_000,
  totalAssets: 1_200_000,
  netWorth: 600_000,
  investedAssets: 400_000,
}

const overLeveraged: HealthRatioInputs = {
  cashSavings: 2_000,
  grossMonthlyIncome: 6_000,
  netMonthlyIncome: 4_800,
  monthlyExpenses: 4_500,
  totalMonthlyDebtPayments: 3_500,
  nonMortgageDebtMonthlyPayment: 1_500,
  totalDebt: 500_000,
  totalAssets: 600_000,
  netWorth: 100_000,
  investedAssets: 3_000,
}

const fireAchieved: HealthRatioInputs = {
  cashSavings: 500_000,
  grossMonthlyIncome: 15_000,
  netMonthlyIncome: 11_000,
  monthlyExpenses: 4_000,
  totalMonthlyDebtPayments: 0,
  nonMortgageDebtMonthlyPayment: 0,
  totalDebt: 0,
  totalAssets: 3_000_000,
  netWorth: 3_000_000,
  investedAssets: 2_000_000,
}

describe('computeRatioValue', () => {
  it('computes emergency fund in months', () => {
    expect(computeRatioValue('emergency-fund', freshGraduate)).toBeCloseTo(2.0)
  })
  it('computes savings ratio (net income basis)', () => {
    expect(computeRatioValue('savings-ratio', freshGraduate)).toBeCloseTo(0.21875)
  })
  it('computes TDSR', () => {
    expect(computeRatioValue('tdsr', midCareerWithMortgage)).toBeCloseTo(0.35)
  })
  it('computes non-mortgage DSR', () => {
    expect(computeRatioValue('non-mortgage-dsr', midCareerWithMortgage)).toBeCloseTo(0.10)
  })
  it('computes debt-to-asset ratio', () => {
    expect(computeRatioValue('debt-to-asset', midCareerWithMortgage)).toBeCloseTo(0.50)
  })
  it('computes liquid-to-nw ratio', () => {
    expect(computeRatioValue('liquid-to-nw', midCareerWithMortgage)).toBeCloseTo(0.05)
  })
  it('computes investment-to-nw ratio', () => {
    expect(computeRatioValue('investment-to-nw', midCareerWithMortgage)).toBeCloseTo(0.6667, 3)
  })
  it('computes solvency ratio', () => {
    expect(computeRatioValue('solvency', midCareerWithMortgage)).toBeCloseTo(0.50)
  })
  it('returns null for zero income (savings ratio)', () => {
    expect(computeRatioValue('savings-ratio', { ...freshGraduate, netMonthlyIncome: 0 })).toBeNull()
  })
  it('returns null for zero expenses (emergency fund)', () => {
    expect(computeRatioValue('emergency-fund', { ...freshGraduate, monthlyExpenses: 0 })).toBeNull()
  })
  it('returns null for zero net worth (liquid-to-nw)', () => {
    expect(computeRatioValue('liquid-to-nw', { ...freshGraduate, netWorth: 0 })).toBeNull()
  })
  it('returns null for zero assets (solvency)', () => {
    expect(computeRatioValue('solvency', { ...freshGraduate, totalAssets: 0 })).toBeNull()
  })
  it('returns negative ratio for negative net worth (liquid-to-nw)', () => {
    const value = computeRatioValue('liquid-to-nw', { ...freshGraduate, netWorth: -50_000 })
    // cashSavings (5000) / netWorth (-50000) = -0.1
    expect(value).toBeCloseTo(-0.1)
  })
  it('returns negative ratio for negative net worth (investment-to-nw)', () => {
    const value = computeRatioValue('investment-to-nw', { ...freshGraduate, netWorth: -50_000 })
    // investedAssets (5000) / netWorth (-50000) = -0.1
    expect(value).toBeCloseTo(-0.1)
  })
  it('negative NW liquid-to-nw includes recovery estimate in message', () => {
    const result = computeHealthRatios({
      ...freshGraduate,
      netWorth: -50_000,
      netMonthlyIncome: 3_200,
      monthlyExpenses: 2_500,
    })
    const liquidRatio = result.ratios.find((r) => r.id === 'liquid-to-nw')!
    expect(liquidRatio.status).toBe('red')
    expect(liquidRatio.message).toContain('months to positive NW')
    // 50000 / 700 ≈ 72 months
    expect(liquidRatio.message).toContain('72')
  })
})

describe('classifyRatio', () => {
  it('classifies emergency fund: 2 months → red', () => {
    expect(classifyRatio('emergency-fund', 2.0)).toBe('red')
  })
  it('classifies emergency fund: 4 months → amber', () => {
    expect(classifyRatio('emergency-fund', 4.0)).toBe('amber')
  })
  it('classifies emergency fund: 6 months → green', () => {
    expect(classifyRatio('emergency-fund', 6.0)).toBe('green')
  })
  it('classifies TDSR: 35% → green (boundary)', () => {
    expect(classifyRatio('tdsr', 0.35)).toBe('green')
  })
  it('classifies TDSR: 53.8% → red (not amber)', () => {
    expect(classifyRatio('tdsr', 0.538)).toBe('red')
  })
  it('returns null for null value', () => {
    expect(classifyRatio('tdsr', null)).toBeNull()
  })
})

describe('computeHealthRatios', () => {
  it('fresh graduate: low emergency fund, no debt, low investments', () => {
    const result = computeHealthRatios(freshGraduate)
    const byId = Object.fromEntries(result.ratios.map((r) => [r.id, r]))
    expect(byId['emergency-fund'].status).toBe('red')
    expect(byId['savings-ratio'].status).toBe('green')
    expect(byId['tdsr'].status).toBe('green')
    expect(byId['non-mortgage-dsr'].status).toBe('green')
    expect(byId['debt-to-asset'].status).toBe('green')
    expect(byId['liquid-to-nw'].status).toBe('green')
    expect(byId['investment-to-nw'].status).toBe('green')
    expect(byId['solvency'].status).toBe('green')
  })
  it('over-leveraged: multiple red flags', () => {
    const result = computeHealthRatios(overLeveraged)
    expect(result.redCount).toBeGreaterThanOrEqual(4)
    expect(result.overallStatus).toBe('red')
  })
  it('FIRE-achieved: all green', () => {
    const result = computeHealthRatios(fireAchieved)
    expect(result.greenCount).toBe(8)
    expect(result.overallStatus).toBe('green')
  })
  it('greenCount + amberCount + redCount + nullCount === 8', () => {
    const result = computeHealthRatios(midCareerWithMortgage)
    expect(result.greenCount + result.amberCount + result.redCount + result.nullCount).toBe(8)
  })
  it('no NaN or undefined in any ratio value', () => {
    for (const fixture of [freshGraduate, midCareerWithMortgage, overLeveraged, fireAchieved]) {
      const result = computeHealthRatios(fixture)
      for (const ratio of result.ratios) {
        if (ratio.value !== null) {
          expect(Number.isNaN(ratio.value)).toBe(false)
          expect(ratio.value).toBeDefined()
        }
      }
    }
  })
  it('no debt: TDSR and non-mortgage DSR show green with message', () => {
    const result = computeHealthRatios(freshGraduate)
    const tdsr = result.ratios.find((r) => r.id === 'tdsr')!
    expect(tdsr.status).toBe('green')
    expect(tdsr.message).toMatch(/no debt/i)
  })

  describe('emergency fund target override', () => {
    it('uses default 6-month threshold when no override', () => {
      // freshGraduate has 5000 / 2500 = 2.0 months → red (below 3)
      const result = computeHealthRatios(freshGraduate)
      const ef = result.ratios.find((r) => r.id === 'emergency-fund')!
      expect(ef.status).toBe('red')
    })

    it('overrides greenBound to custom target', () => {
      // With target=2, greenBound=2, amberBound=1. 2.0 months → green
      const result = computeHealthRatios(freshGraduate, { emergencyFundTarget: 2 })
      const ef = result.ratios.find((r) => r.id === 'emergency-fund')!
      expect(ef.status).toBe('green')
      expect(ef.meta.thresholds.greenBound).toBe(2)
      expect(ef.meta.thresholds.amberBound).toBe(1)
    })

    it('classifies amber correctly with custom target', () => {
      // With target=4, greenBound=4, amberBound=2. 2.0 months → amber
      const result = computeHealthRatios(freshGraduate, { emergencyFundTarget: 4 })
      const ef = result.ratios.find((r) => r.id === 'emergency-fund')!
      expect(ef.status).toBe('amber')
    })

    it('classifies red correctly with stricter custom target', () => {
      // With target=12, greenBound=12, amberBound=6. 2.0 months → red
      const result = computeHealthRatios(freshGraduate, { emergencyFundTarget: 12 })
      const ef = result.ratios.find((r) => r.id === 'emergency-fund')!
      expect(ef.status).toBe('red')
    })
  })
})
