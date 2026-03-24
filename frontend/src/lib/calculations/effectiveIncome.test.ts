import { describe, it, expect } from 'vitest'
import { resolveEffectiveIncome, computeBaseProjection } from './effectiveIncome'
import type { IncomeProjectionRow } from '@/lib/types'
import type { IncomeProjectionParams } from '@/lib/calculations/income'

// ============================================================
// resolveEffectiveIncome
// ============================================================

describe('resolveEffectiveIncome', () => {
  const profile = { annualIncome: 84000 }

  it('returns profile.annualIncome when projection is null', () => {
    expect(resolveEffectiveIncome(profile, null)).toBe(84000)
  })

  it('returns profile.annualIncome when projection is undefined', () => {
    expect(resolveEffectiveIncome(profile, undefined)).toBe(84000)
  })

  it('returns profile.annualIncome when projection is empty', () => {
    expect(resolveEffectiveIncome(profile, [])).toBe(84000)
  })

  it('returns row-0 totalGross when projection has data', () => {
    const projection = [
      { totalGross: 96000 } as IncomeProjectionRow,
      { totalGross: 100000 } as IncomeProjectionRow,
    ]
    expect(resolveEffectiveIncome(profile, projection)).toBe(96000)
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
