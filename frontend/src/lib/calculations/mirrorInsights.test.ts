import { describe, it, expect } from 'vitest'
import {
  computeMirrorInsights,
  getMedianSavingsRate,
  type MirrorInsightInputs,
  type MirrorId,
} from './mirrorInsights'
import { getMethodologyTooltip } from './mirrorCopy'

function makeInsightInputs(overrides: Partial<MirrorInsightInputs> = {}): MirrorInsightInputs {
  return {
    currentAge: 30,
    retirementAge: 55,
    monthlyIncome: 7000,
    monthlyExpenses: 4000,
    currentSavings: 100_000,
    cpfOA: 50_000,
    cpfSA: 30_000,
    hasCpf: true,
    propertyValue: 500_000,
    hasProperty: true,
    hasIncome: true,
    expectedReturn: 0.05,
    swr: 0.035,
    ...overrides,
  }
}

describe('getMedianSavingsRate', () => {
  it('derives a positive savings rate for a typical age band', () => {
    const rate = getMedianSavingsRate(30)
    expect(rate).toBeGreaterThan(0)
    expect(rate).toBeLessThan(1)
  })

  it('returns a rate for edge ages (below 20, above 64)', () => {
    // Age 18 maps to 20-24 bracket where degree salary < median expenses, so rate is 0
    expect(getMedianSavingsRate(18)).toBeGreaterThanOrEqual(0)
    expect(getMedianSavingsRate(70)).toBeGreaterThan(0)
  })
})

describe('computeMirrorInsights', () => {
  it('returns 5 insight objects', () => {
    const insights = computeMirrorInsights(makeInsightInputs())
    expect(insights).toHaveLength(5)
  })

  it('moment 1 (savingsPower) has positive yearsPerExtra10Pct and boostMonthly', () => {
    const insights = computeMirrorInsights(makeInsightInputs())
    const m1 = insights.find((i) => i.id === 'savings-power')!
    expect(m1).toBeDefined()
    expect(m1.data.yearsPerExtra10Pct).toBeGreaterThan(0)
    expect(m1.data.boostMonthly).toBeGreaterThan(0)
  })

  it('moment 1 boost scales with income', () => {
    const lowIncome = computeMirrorInsights(makeInsightInputs({ monthlyIncome: 3000 }))
    const highIncome = computeMirrorInsights(makeInsightInputs({ monthlyIncome: 15000 }))
    const m1Low = lowIncome.find((i) => i.id === 'savings-power')!
    const m1High = highIncome.find((i) => i.id === 'savings-power')!
    expect(m1High.data.boostMonthly).toBeGreaterThan(m1Low.data.boostMonthly)
  })

  it('moment 2 shows benchmark when savings rate beats median', () => {
    const insights = computeMirrorInsights(
      makeInsightInputs({ monthlyIncome: 12000, monthlyExpenses: 3000 })
    )
    const m2 = insights.find((i) => i.id === 'savings-rate')!
    expect(m2.data.showBenchmark).toBe(true)
    expect(m2.data.savingsRate).toBeCloseTo(75.0, 0)
  })

  it('moment 1 is suppressed when hasIncome is false', () => {
    const insights = computeMirrorInsights(
      makeInsightInputs({ hasIncome: false, monthlyIncome: 0 })
    )
    const m1 = insights.find((i) => i.id === 'savings-power')!
    expect(m1).toBeDefined()
    expect(m1.suppressed).toBe(true)
  })

  it('moment 2 suppresses benchmark when savings rate below median', () => {
    const insights = computeMirrorInsights(
      makeInsightInputs({ monthlyIncome: 4000, monthlyExpenses: 3500 })
    )
    const m2 = insights.find((i) => i.id === 'savings-rate')!
    expect(m2.data.showBenchmark).toBe(false)
  })

  it('moment 2 suppresses benchmark when expenses exceed income', () => {
    const insights = computeMirrorInsights(
      makeInsightInputs({ monthlyIncome: 3000, monthlyExpenses: 4000 })
    )
    const m2 = insights.find((i) => i.id === 'savings-rate')!
    expect(m2.data.showBenchmark).toBe(false)
    expect(m2.data.negativeSavings).toBe(true)
  })

  it('moment 3 (cpfRunway) is suppressed for foreigners', () => {
    const insights = computeMirrorInsights(makeInsightInputs({ hasCpf: false }))
    const m3 = insights.find((i) => i.id === 'cpf-runway')!
    expect(m3.suppressed).toBe(true)
  })

  it('moment 3 excludes cpfMA from runway calculation', () => {
    const insights = computeMirrorInsights(makeInsightInputs())
    const m3 = insights.find((i) => i.id === 'cpf-runway')!
    const annualExpenses = 4000 * 12
    const expectedYears = (50_000 + 30_000) / annualExpenses
    expect(m3.data.cpfYears).toBeCloseTo(expectedYears, 1)
  })

  it('moment 4 (netWorth) omits property slice when no property', () => {
    const insights = computeMirrorInsights(makeInsightInputs({ hasProperty: false }))
    const m4 = insights.find((i) => i.id === 'net-worth')!
    expect(m4.data.propertyPercent).toBe(0)
  })

  it('moment 5 (fullSnapshot) computes a fireAge', () => {
    const insights = computeMirrorInsights(makeInsightInputs())
    const m5 = insights.find((i) => i.id === 'full-snapshot')!
    expect(m5.suppressed).toBe(false)
    expect(m5.data.fireAge).toBeGreaterThan(0)
    expect(m5.data.fireNumber).toBeGreaterThan(0)
    expect(m5.data.topInsight).toBeTruthy()
  })

  it('moment 5 (fullSnapshot) is suppressed when FIRE is unreachable', () => {
    const insights = computeMirrorInsights(
      makeInsightInputs({ monthlyIncome: 1000, monthlyExpenses: 4000, currentSavings: 0, cpfOA: 0, cpfSA: 0 })
    )
    const m5 = insights.find((i) => i.id === 'full-snapshot')!
    expect(m5.suppressed).toBe(true)
    expect(m5.data.fireAge).toBe(0)
  })
})

describe('getMethodologyTooltip', () => {
  const allIds: MirrorId[] = ['savings-power', 'savings-rate', 'cpf-runway', 'net-worth', 'full-snapshot']

  it('returns non-empty text for every MirrorId', () => {
    for (const id of allIds) {
      const tooltip = getMethodologyTooltip(id)
      expect(tooltip.text).toBeTruthy()
    }
  })

  it('returns source for savings-rate with benchmark', () => {
    const tooltip = getMethodologyTooltip('savings-rate', { showBenchmark: true })
    expect(tooltip.source).toBeTruthy()
  })

  it('returns no source for savings-rate without benchmark', () => {
    const tooltip = getMethodologyTooltip('savings-rate', { showBenchmark: false })
    expect(tooltip.source).toBeUndefined()
  })
})
