import { describe, it, expect } from 'vitest'
import {
  computeQuickEstimate,
  buildHealthInputs,
  parseUrlParams,
  buildSearchParams,
  type QuickEstimateInputs,
  type QuickHealthInputs,
} from './quickEstimate'
import { QUICK_ESTIMATE_DEFAULTS } from '@/lib/data/quickEstimateDefaults'

function makeInputs(overrides: Partial<QuickEstimateInputs> = {}): QuickEstimateInputs {
  return {
    monthlyIncome: 7000,
    monthlyExpenses: 4000,
    currentSavings: 100_000,
    currentAge: 30,
    expectedReturn: QUICK_ESTIMATE_DEFAULTS.nominalReturn,
    swr: QUICK_ESTIMATE_DEFAULTS.swr,
    ...overrides,
  }
}

// ── computeQuickEstimate ──────────────────────────────────────────────────

describe('computeQuickEstimate', () => {
  it('computes a basic FIRE estimate', () => {
    const result = computeQuickEstimate(makeInputs())
    expect(result.status).toBe('ok')
    expect(result.fireNumber).toBeGreaterThan(0)
    expect(result.yearsToFire).toBeGreaterThan(0)
    expect(result.yearsToFire).toBeLessThan(100)
    expect(result.fireAge).toBe(result.yearsToFire + 30)
    expect(result.savingsRate).toBeCloseTo(3 / 7, 4)
    expect(result.trajectory.length).toBeGreaterThan(0)
  })

  it('returns FIRE number = annualExpenses / swr', () => {
    const result = computeQuickEstimate(makeInputs({ monthlyExpenses: 5000, swr: 0.04 }))
    expect(result.fireNumber).toBe(60000 / 0.04)
  })

  it('uses real return (nominal - inflation) for years-to-fire', () => {
    const result = computeQuickEstimate(makeInputs())
    expect(result.netRealReturn).toBeCloseTo(0.05 - 0.025, 10)
  })

  it('returns no-income status when income is zero', () => {
    const result = computeQuickEstimate(makeInputs({ monthlyIncome: 0 }))
    expect(result.status).toBe('no-income')
    expect(result.yearsToFire).toBe(Infinity)
  })

  it('returns negative-savings when expenses exceed income and savings cannot cover', () => {
    const result = computeQuickEstimate(makeInputs({ monthlyIncome: 3000, monthlyExpenses: 4000 }))
    expect(result.status).toBe('negative-savings')
    expect(result.yearsToFire).toBe(Infinity)
  })

  it('returns ok when expenses exceed income but savings + returns can reach FIRE', () => {
    const result = computeQuickEstimate(makeInputs({
      monthlyIncome: 7500,
      monthlyExpenses: 10000,
      currentSavings: 2_000_000,
    }))
    // FIRE number = $120k/0.035 = $3.4M. $2M grows via 2.5% real return
    // despite -$30k annual cash flow. Investment returns outpace the bleed.
    expect(result.status).toBe('ok')
    expect(result.yearsToFire).toBeGreaterThan(0)
    expect(result.yearsToFire).toBeLessThan(100)
  })

  it('returns already-fire when savings exceed FIRE number', () => {
    const result = computeQuickEstimate(makeInputs({ currentSavings: 5_000_000 }))
    expect(result.status).toBe('already-fire')
    expect(result.yearsToFire).toBe(0)
  })

  it('returns unreachable when years to fire exceeds 100', () => {
    // Very low savings rate relative to expenses
    const result = computeQuickEstimate(makeInputs({
      monthlyIncome: 4100,
      monthlyExpenses: 4000,
      currentSavings: 0,
      expectedReturn: 0.025, // net real return = 0
    }))
    // With 0% real return, 1200/yr savings, and 1,371,428 fire number → 1143 years
    expect(result.status).toBe('unreachable')
    expect(result.yearsToFire).toBe(Infinity)
  })

  it('computes trajectory from current age to life expectancy', () => {
    const result = computeQuickEstimate(makeInputs({ currentAge: 40 }))
    expect(result.trajectory[0].age).toBe(40)
    expect(result.trajectory[result.trajectory.length - 1].age).toBe(90)
  })

  it('handles zero expenses gracefully (FIRE number = 0)', () => {
    const result = computeQuickEstimate(makeInputs({ monthlyExpenses: 0 }))
    expect(result.fireNumber).toBe(0)
    // With fireNumber 0, already at FIRE if savings > 0... but calculateFireNumber returns 0
    // and currentSavings (100k) >= 0 but we need fireNumber > 0 for already-fire
    expect(result.status).toBe('ok')
  })

  it('handles zero return gracefully', () => {
    const result = computeQuickEstimate(makeInputs({ expectedReturn: 0.025 }))
    // netRealReturn = 0 → linear savings formula
    expect(result.netRealReturn).toBeCloseTo(0, 10)
    expect(result.status).toBe('ok')
    expect(result.yearsToFire).toBeGreaterThan(0)
    expect(isFinite(result.yearsToFire)).toBe(true)
  })
})

// ── buildHealthInputs ─────────────────────────────────────────────────────

describe('buildHealthInputs', () => {
  const stage1 = makeInputs()
  const stage2: QuickHealthInputs = { cashSavings: 30_000, outstandingDebt: 50_000 }

  it('maps monthly income to both gross and net', () => {
    const h = buildHealthInputs(stage1, stage2)
    expect(h.grossMonthlyIncome).toBe(7000)
    expect(h.netMonthlyIncome).toBe(7000)
  })

  it('computes net worth = savings - debt', () => {
    const h = buildHealthInputs(stage1, stage2)
    expect(h.netWorth).toBe(100_000 - 50_000)
  })

  it('computes invested assets = savings - cash', () => {
    const h = buildHealthInputs(stage1, stage2)
    expect(h.investedAssets).toBe(100_000 - 30_000)
  })

  it('uses 10yr repayment heuristic for debt payments', () => {
    const h = buildHealthInputs(stage1, stage2)
    expect(h.totalMonthlyDebtPayments).toBeCloseTo(50_000 / 120, 2)
    expect(h.nonMortgageDebtMonthlyPayment).toBeCloseTo(50_000 / 120, 2)
  })

  it('handles zero debt', () => {
    const h = buildHealthInputs(stage1, { cashSavings: 30_000, outstandingDebt: 0 })
    expect(h.totalMonthlyDebtPayments).toBe(0)
    expect(h.totalDebt).toBe(0)
    expect(h.netWorth).toBe(100_000)
  })

  it('clamps invested assets to 0 when cash > savings', () => {
    const h = buildHealthInputs(stage1, { cashSavings: 200_000, outstandingDebt: 0 })
    expect(h.investedAssets).toBe(0)
  })
})

// ── URL Param Parsing ─────────────────────────────────────────────────────

describe('parseUrlParams', () => {
  it('parses valid params', () => {
    const params = new URLSearchParams('income=7000&expenses=4000&savings=100000&age=30&return=5&swr=3.5')
    const result = parseUrlParams(params)
    expect(result.income).toBe(7000)
    expect(result.expenses).toBe(4000)
    expect(result.savings).toBe(100000)
    expect(result.age).toBe(30)
    expect(result.return).toBe(5)
    expect(result.swr).toBe(3.5)
  })

  it('clamps out-of-range values', () => {
    const params = new URLSearchParams('income=999999999&age=5&return=50&swr=0.5')
    const result = parseUrlParams(params)
    expect(result.income).toBe(1_000_000)
    expect(result.age).toBe(18)
    expect(result.return).toBe(30)
    expect(result.swr).toBe(1)
  })

  it('ignores NaN values', () => {
    const params = new URLSearchParams('income=abc&age=xyz')
    const result = parseUrlParams(params)
    expect(result.income).toBeUndefined()
    expect(result.age).toBeUndefined()
  })

  it('returns empty object for no params', () => {
    const result = parseUrlParams(new URLSearchParams())
    expect(result).toEqual({})
  })
})

describe('buildSearchParams', () => {
  it('builds params from inputs', () => {
    const inputs = makeInputs()
    const params = buildSearchParams(inputs)
    expect(params.get('income')).toBe('7000')
    expect(params.get('expenses')).toBe('4000')
    expect(params.get('savings')).toBe('100000')
    // age=30 is default, should still be omitted
    expect(params.get('age')).toBeNull()
  })

  it('omits default return and swr', () => {
    const inputs = makeInputs()
    const params = buildSearchParams(inputs)
    expect(params.get('return')).toBeNull()
    expect(params.get('swr')).toBeNull()
  })

  it('includes non-default return and swr', () => {
    const inputs = makeInputs({ expectedReturn: 0.06, swr: 0.04 })
    const params = buildSearchParams(inputs)
    expect(params.get('return')).toBe('6')
    expect(params.get('swr')).toBe('4')
  })
})
