import { describe, it, expect } from 'vitest'
import { resolveEffectiveIncome, computeBaseProjection } from './effectiveIncome'
import type { IncomeProjectionRow } from '@/lib/types'
import type { IncomeProjectionParams } from '@/lib/calculations/income'

// ============================================================
// resolveEffectiveIncome
// ============================================================

/** Minimal row helper — only the fields resolveEffectiveIncome cares about */
const row = (totalGross: number, isRetired = false) =>
  ({ totalGross, isRetired } as IncomeProjectionRow)

describe('resolveEffectiveIncome', () => {
  const profile = { annualIncome: 84000 }

  // ---- legacy (no baseProjection) ----

  it('returns profile.annualIncome when projection is null', () => {
    expect(resolveEffectiveIncome(profile, null)).toBe(84000)
  })

  it('returns profile.annualIncome when projection is undefined', () => {
    expect(resolveEffectiveIncome(profile, undefined)).toBe(84000)
  })

  it('returns profile.annualIncome when projection is empty', () => {
    expect(resolveEffectiveIncome(profile, [])).toBe(84000)
  })

  it('returns row-0 totalGross when projection has data (no baseProjection)', () => {
    const projection = [row(96000), row(100000)]
    expect(resolveEffectiveIncome(profile, projection)).toBe(96000)
  })

  it('legacy path: returns projection row-0 when baseProjection is absent', () => {
    const projection = [row(80000), row(90000), row(100000)]
    expect(resolveEffectiveIncome(profile, projection, undefined)).toBe(80000)
  })

  it('legacy path: returns projection row-0 when baseProjection is empty', () => {
    const projection = [row(80000), row(90000), row(100000)]
    expect(resolveEffectiveIncome(profile, projection, [])).toBe(80000)
  })

  // ---- Option B amortization ----

  it('amortizes loss when baseProjection provided (career break at row-0)', () => {
    // With events: rows 0-1 at $50K (career break), rows 2-4 at $100K
    const withEvents = [
      row(50000),
      row(50000),
      row(100000),
      row(100000),
      row(100000),
    ]
    // Without events: all 5 rows at $100K
    const withoutEvents = [
      row(100000),
      row(100000),
      row(100000),
      row(100000),
      row(100000),
    ]
    // totalWith = 400K, totalWithout = 500K, avgAnnualLoss = 100K/5 = 20K
    // baseRow0 = 100K, effective = 100K - 20K = 80K
    expect(resolveEffectiveIncome(profile, withEvents, withoutEvents)).toBe(80000)
  })

  it('returns baseRow0 when events do not reduce income (projections identical)', () => {
    const projection = [row(100000), row(110000), row(120000)]
    const base = [row(100000), row(110000), row(120000)]
    // avgAnnualLoss = 0, effective = baseRow0 - 0 = 100K
    expect(resolveEffectiveIncome(profile, projection, base)).toBe(100000)
  })

  it('clamps to zero when events eliminate all income', () => {
    // With events: all working rows at $0
    const withEvents = [row(0), row(0), row(0)]
    // Without events: all at $100K
    const withoutEvents = [row(100000), row(100000), row(100000)]
    // avgAnnualLoss = 100K, baseRow0 = 100K → 100K - 100K = 0
    expect(resolveEffectiveIncome(profile, withEvents, withoutEvents)).toBe(0)
  })

  it('does not clamp upward when events increase income (promotion modeled as event)', () => {
    // With events: all rows at $120K (raise from life event)
    const withEvents = [row(120000), row(120000), row(120000)]
    // Without events: all at $100K
    const withoutEvents = [row(100000), row(100000), row(100000)]
    // avgAnnualLoss = (300K - 360K) / 3 = -20K (negative → income increase)
    // baseRow0 = 100K, effective = 100K - (-20K) = 120K
    const result = resolveEffectiveIncome(profile, withEvents, withoutEvents)
    expect(result).toBeGreaterThan(100000)
    expect(result).toBe(120000)
  })

  it('handles incomeImpact > 1 (event more than doubles some years)', () => {
    // With events: rows at $250K, $250K, $100K (big bonus year from event)
    const withEvents = [row(250000), row(250000), row(100000)]
    // Without events: all at $100K
    const withoutEvents = [row(100000), row(100000), row(100000)]
    // avgAnnualLoss = (300K - 600K) / 3 = -100K → effective = 100K + 100K = 200K
    const result = resolveEffectiveIncome(profile, withEvents, withoutEvents)
    expect(result).toBe(200000)
  })

  it('falls back to row0Income when base projection has zero working years', () => {
    // All base rows are retired
    const withEvents = [row(80000), row(90000)]
    const withoutEvents = [row(100000, true), row(100000, true)]
    // workingWithout is empty → return row0Income = 80K
    expect(resolveEffectiveIncome(profile, withEvents, withoutEvents)).toBe(80000)
  })

  it('falls back to row0Income when projection has zero working years', () => {
    // All with-events rows are retired
    const withEvents = [row(0, true), row(0, true)]
    const withoutEvents = [row(100000), row(100000)]
    // workingWith is empty → return row0Income = 0
    expect(resolveEffectiveIncome(profile, withEvents, withoutEvents)).toBe(0)
  })
})

// ============================================================
// computeBaseProjection
// ============================================================

/** Minimal valid IncomeProjectionParams for testing gating logic */
const baseParams: IncomeProjectionParams = {
  currentAge: 35,
  retirementAge: 65,
  lifeExpectancy: 85,
  salaryModel: 'simple',
  annualSalary: 84000,
  salaryGrowthRate: 0.03,
  bonusMonths: 0,
  realisticPhases: [],
  promotionJumps: [],
  momEducation: 'degree',
  momAdjustment: 0,
  employerCpfEnabled: true,
  incomeStreams: [],
  lifeEvents: [],
  lifeEventsEnabled: true,
  annualExpenses: 36000,
  inflation: 0.025,
  personalReliefs: 0,
  srsAnnualContribution: 0,
  initialCpfOA: 50000,
  initialCpfSA: 30000,
  initialCpfMA: 20000,
  residencyStatus: 'citizen',
}

const sampleLifeEvent = {
  id: 'test-event',
  name: 'Career break',
  startAge: 40,
  endAge: 42,
  incomeImpact: -0.5,
  affectedStreamIds: [],
  savingsPause: false,
  cpfPause: false,
}

describe('computeBaseProjection', () => {
  it('returns null when lifeEventsEnabled is false', () => {
    const params: IncomeProjectionParams = {
      ...baseParams,
      lifeEventsEnabled: false,
      lifeEvents: [sampleLifeEvent],
    }
    expect(computeBaseProjection(params)).toBeNull()
  })

  it('returns null when lifeEventsEnabled is true but lifeEvents is empty', () => {
    const params: IncomeProjectionParams = {
      ...baseParams,
      lifeEventsEnabled: true,
      lifeEvents: [],
    }
    expect(computeBaseProjection(params)).toBeNull()
  })

  it('returns a non-empty projection when life events are present and enabled', () => {
    const params: IncomeProjectionParams = {
      ...baseParams,
      lifeEventsEnabled: true,
      lifeEvents: [sampleLifeEvent],
    }
    const result = computeBaseProjection(params)
    expect(result).not.toBeNull()
    expect(result!.length).toBeGreaterThan(0)
    // The base projection has lifeEventsEnabled: false — salary should NOT be impacted
    // at the event age (row at age 40 should show full salary, not reduced)
    const rowAtEventAge = result!.find((r) => r.age === 40)
    expect(rowAtEventAge).toBeDefined()
    // With life events disabled, salary at 40 should be higher than 0
    expect(rowAtEventAge!.salary).toBeGreaterThan(0)
  })
})
